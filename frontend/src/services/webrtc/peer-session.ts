import type { RtcSignal } from "@/services/realtime/chat-events";
import {
  type ConnectionQuality,
  type QualitySample,
  sampleStats,
  toQuality,
} from "./connection-quality";

export type PeerState = "connecting" | "connected" | "reconnecting" | "failed" | "closed";

export interface PeerSessionOptions {
  /** The polite peer yields on offer collisions (perfect negotiation). The callee is polite. */
  readonly polite: boolean;
  readonly iceServers: RTCIceServer[];
  /** Force TURN relay so the partner never learns this device's IP address. */
  readonly relayOnly: boolean;
  readonly localStream: MediaStream;
  readonly sendSignal: (signal: RtcSignal) => void;
  readonly onRemoteStream: (stream: MediaStream) => void;
  readonly onStateChange: (state: PeerState) => void;
}

/** How long a disconnected connection may try to recover before restarting ICE. */
const DISCONNECT_GRACE_MS = 3000;

/**
 * One WebRTC call. Uses the "perfect negotiation" pattern, so both sides can add tracks at any time
 * and offer collisions resolve themselves. Recovers from network changes with an ICE restart.
 */
export class PeerSession {
  readonly #connection: RTCPeerConnection;
  #makingOffer = false;
  #ignoreOffer = false;
  #disconnectTimer: number | undefined;
  #previousSample: QualitySample | null = null;
  #closed = false;

  constructor(private readonly options: PeerSessionOptions) {
    this.#connection = new RTCPeerConnection({
      iceServers: options.iceServers,
      iceTransportPolicy: options.relayOnly ? "relay" : "all",
    });
    const connection = this.#connection;

    for (const track of options.localStream.getTracks())
      connection.addTrack(track, options.localStream);

    connection.ontrack = ({ streams }) => {
      const [stream] = streams;
      if (stream) options.onRemoteStream(stream);
    };
    connection.onicecandidate = ({ candidate }) => {
      if (!candidate) return;
      options.sendSignal({
        candidate: {
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid,
          sdpMLineIndex: candidate.sdpMLineIndex,
          usernameFragment: candidate.usernameFragment,
        },
      });
    };
    connection.onnegotiationneeded = () => {
      void this.negotiate();
    };
    connection.onconnectionstatechange = () => {
      this.handleConnectionState();
    };
  }

  async handleSignal(signal: RtcSignal): Promise<void> {
    if (this.#closed) return;
    const connection = this.#connection;
    if ("description" in signal) {
      const description = signal.description;
      const collision =
        description.type === "offer" &&
        (this.#makingOffer || connection.signalingState !== "stable");
      this.#ignoreOffer = !this.options.polite && collision;
      if (this.#ignoreOffer) return;

      await connection.setRemoteDescription(description);
      if (description.type === "offer") {
        await connection.setLocalDescription();
        this.sendLocalDescription();
      }
      return;
    }

    try {
      await connection.addIceCandidate(signal.candidate);
    } catch (error) {
      if (!this.#ignoreOffer) throw error;
    }
  }

  /** Swaps the outgoing camera or microphone without renegotiating. */
  async replaceTrack(track: MediaStreamTrack): Promise<void> {
    const sender = this.#connection
      .getSenders()
      .find((candidate) => candidate.track?.kind === track.kind);
    await sender?.replaceTrack(track);
  }

  async measureQuality(): Promise<ConnectionQuality> {
    const sample = sampleStats(await this.#connection.getStats());
    const quality = toQuality(this.#previousSample, sample);
    this.#previousSample = sample;
    return quality;
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    window.clearTimeout(this.#disconnectTimer);
    this.#connection.ontrack = null;
    this.#connection.onicecandidate = null;
    this.#connection.onnegotiationneeded = null;
    this.#connection.onconnectionstatechange = null;
    this.#connection.close();
    this.options.onStateChange("closed");
  }

  private async negotiate(): Promise<void> {
    try {
      this.#makingOffer = true;
      await this.#connection.setLocalDescription();
      this.sendLocalDescription();
    } finally {
      this.#makingOffer = false;
    }
  }

  private sendLocalDescription(): void {
    const description = this.#connection.localDescription;
    if (description && (description.type === "offer" || description.type === "answer")) {
      this.options.sendSignal({ description: { type: description.type, sdp: description.sdp } });
    }
  }

  private handleConnectionState(): void {
    const state = this.#connection.connectionState;
    window.clearTimeout(this.#disconnectTimer);

    if (state === "connected") {
      this.options.onStateChange("connected");
    } else if (state === "disconnected") {
      this.options.onStateChange("reconnecting");
      this.#disconnectTimer = window.setTimeout(
        () => this.#connection.restartIce(),
        DISCONNECT_GRACE_MS,
      );
    } else if (state === "failed") {
      this.options.onStateChange("reconnecting");
      this.#connection.restartIce();
    } else if (state === "new" || state === "connecting") {
      this.options.onStateChange("connecting");
    }
  }
}
