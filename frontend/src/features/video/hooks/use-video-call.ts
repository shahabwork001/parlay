"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "@/features/chat/hooks/use-chat";
import { useChatStore } from "@/features/chat/store/chat-store";
import { useSettingsStore } from "@/features/settings/store/settings-store";
import { rtcRepository } from "@/repositories/rtc-repository";
import {
  type AvailableDevices,
  classifyMediaError,
  listDevices,
  type MediaErrorKind,
  openLocalMedia,
  stopStream,
} from "@/services/media/media-devices";
import type { MediaState, RtcSignal } from "@/services/realtime/chat-events";
import { ContentScreener, createBlurredTrack } from "@/services/safety/content-screener";
import { captureStreamFrame } from "@/services/media/snapshot";
import { type ConnectionQuality, UNKNOWN_QUALITY } from "@/services/webrtc/connection-quality";
import { PeerSession, type PeerState } from "@/services/webrtc/peer-session";

/** On-device screening of the person's own video: running, flagged (blurred for the partner) or not possible here. */
export type ScreeningState = "idle" | "active" | "flagged" | "unavailable";

export type PreflightState =
  | { readonly status: "requesting" | "ready" }
  | { readonly status: "error"; readonly kind: MediaErrorKind };

const QUALITY_INTERVAL_MS = 2000;
const ICE_CACHE_MS = 30 * 60 * 1000;
const NO_DEVICES: AvailableDevices = { cameras: [], microphones: [] };

/**
 * Video call on top of the chat session: camera preflight, one RTCPeerConnection per match, partner
 * media state, mute/camera toggles, device switching and connection quality.
 */
export function useVideoCall() {
  const sessionId = useChatStore((state) => state.sessionId);
  const role = useChatStore((state) => state.role);
  const screenNudity = useChatStore((state) => state.screenNudity);
  const relayOnly = useSettingsStore((state) => state.relayOnly);
  const nsfwThreshold = useChatStore((state) => state.nsfwThreshold);

  const [preflight, setPreflight] = useState<PreflightState>({ status: "requesting" });
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [peerState, setPeerState] = useState<PeerState | null>(null);
  const [partnerMedia, setPartnerMedia] = useState<MediaState>({ audio: true, video: true });
  const [localMedia, setLocalMedia] = useState<MediaState>({ audio: true, video: true });
  const [quality, setQuality] = useState<ConnectionQuality>(UNKNOWN_QUALITY);
  const [devices, setDevices] = useState<AvailableDevices>(NO_DEVICES);
  const [flaggedSessionId, setFlaggedSessionId] = useState<string | null>(null);
  const [screeningUnavailable, setScreeningUnavailable] = useState(false);

  const peerRef = useRef<PeerSession | null>(null);
  const pendingSignalsRef = useRef<RtcSignal[]>([]);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localMediaRef = useRef(localMedia);
  const iceCacheRef = useRef<{ servers: RTCIceServer[]; fetchedAt: number } | null>(null);
  const screenerRef = useRef<ContentScreener | null>(null);
  const thresholdRef = useRef(nsfwThreshold);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  const deliverSignal = useCallback((signal: RtcSignal) => {
    const peer = peerRef.current;
    if (peer) void peer.handleSignal(signal).catch(() => undefined);
    else pendingSignalsRef.current.push(signal);
  }, []);

  const chat = useChat("video", {
    autoJoin: false,
    onSignal: deliverSignal,
    onMediaState: setPartnerMedia,
  });
  const { sendSignal, sendMediaState, flagContent, reportRtcOutcome } = chat;
  useEffect(() => {
    if (peerState === "connected" || peerState === "failed") reportRtcOutcome(peerState);
  }, [peerState, reportRtcOutcome]);

  useEffect(() => {
    thresholdRef.current = nsfwThreshold;
    screenerRef.current?.setThreshold(nsfwThreshold);
  }, [nsfwThreshold]);

  useEffect(() => {
    remoteStreamRef.current = remoteStream;
  }, [remoteStream]);

  /**
   * Opens camera and microphone with the saved device choice. Resolves to `apply` (use the result)
   * and `discard` (release it), so callers can drop a result that arrives after unmount.
   */
  const acquireMedia = useCallback(async (): Promise<{
    apply: () => void;
    discard: () => void;
  }> => {
    try {
      const { cameraId, microphoneId } = useSettingsStore.getState();
      const stream = await openLocalMedia({ cameraId, microphoneId });
      const available = await listDevices();
      return {
        apply: () => {
          stopStream(localStreamRef.current);
          localStreamRef.current = stream;
          setLocalStream(stream);
          setDevices(available);
          setPreflight({ status: "ready" });
        },
        discard: () => stopStream(stream),
      };
    } catch (error) {
      return {
        apply: () => setPreflight({ status: "error", kind: classifyMediaError(error) }),
        discard: () => undefined,
      };
    }
  }, []);

  const requestMedia = useCallback(() => {
    setPreflight({ status: "requesting" });
    void acquireMedia().then((result) => result.apply());
  }, [acquireMedia]);

  useEffect(() => {
    let active = true;
    void acquireMedia().then((result) => (active ? result.apply() : result.discard()));
    return () => {
      active = false;
      stopStream(localStreamRef.current);
      localStreamRef.current = null;
    };
  }, [acquireMedia]);

  const iceServers = useCallback(async () => {
    const cached = iceCacheRef.current;
    if (cached && Date.now() - cached.fetchedAt < ICE_CACHE_MS) return cached.servers;
    const servers = await rtcRepository.getIceServers();
    iceCacheRef.current = { servers, fetchedAt: Date.now() };
    return servers;
  }, []);

  // One peer connection per matched session; torn down when the session ends or changes.
  useEffect(() => {
    const stream = localStreamRef.current;
    if (!sessionId || !role || !stream) return;
    let cancelled = false;
    setPartnerMedia({ audio: true, video: true });
    setQuality(UNKNOWN_QUALITY);

    void iceServers().then((servers) => {
      if (cancelled) return;
      const peer = new PeerSession({
        polite: role === "callee",
        iceServers: servers,
        relayOnly,
        localStream: stream,
        sendSignal,
        onRemoteStream: setRemoteStream,
        onStateChange: setPeerState,
      });
      peerRef.current = peer;
      for (const signal of pendingSignalsRef.current.splice(0))
        void peer.handleSignal(signal).catch(() => undefined);
      sendMediaState(localMediaRef.current);
    });

    return () => {
      cancelled = true;
      peerRef.current?.close();
      peerRef.current = null;
      pendingSignalsRef.current = [];
      setRemoteStream(null);
      setPeerState(null);
    };
  }, [sessionId, role, relayOnly, iceServers, sendSignal, sendMediaState]);

  // Screen the person's own camera for the whole chat. Frames are classified on the device only.
  useEffect(() => {
    const stream = localStreamRef.current;
    if (!sessionId || !stream || !screenNudity) return;
    const screener = new ContentScreener(thresholdRef.current, {
      onChange: (flagged, score) => {
        setFlaggedSessionId(flagged ? sessionId : null);
        if (flagged) flagContent(score);
      },
      onUnavailable: () => setScreeningUnavailable(true),
    });
    screenerRef.current = screener;
    screener.start(stream);
    return () => {
      screener.stop();
      screenerRef.current = null;
    };
  }, [sessionId, flagContent, screenNudity]);

  const screening: ScreeningState = screeningUnavailable
    ? "unavailable"
    : !sessionId || !screenNudity
      ? "idle"
      : flaggedSessionId === sessionId
        ? "flagged"
        : "active";

  // While flagged, the partner receives a blurred copy of the camera instead of the camera itself.
  useEffect(() => {
    const stream = localStreamRef.current;
    const peer = peerRef.current;
    if (screening !== "flagged" || !stream || !peer || peerState === null) return;
    const blurred = createBlurredTrack(stream);
    if (blurred) void peer.replaceTrack(blurred.track);
    return () => {
      const camera = stream.getVideoTracks()[0];
      if (camera) void peer.replaceTrack(camera).catch(() => undefined);
      blurred?.stop();
    };
  }, [screening, peerState]);

  /** A still frame of the partner's video for a report, or null in text-only moments. */
  const capturePartnerFrame = useCallback(() => captureStreamFrame(remoteStreamRef.current), []);

  useEffect(() => {
    if (peerState !== "connected") return;
    const timer = window.setInterval(() => {
      void peerRef.current
        ?.measureQuality()
        .then(setQuality)
        .catch(() => undefined);
    }, QUALITY_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [peerState]);

  const updateLocalMedia = useCallback(
    (next: MediaState) => {
      for (const track of localStreamRef.current?.getAudioTracks() ?? [])
        track.enabled = next.audio;
      for (const track of localStreamRef.current?.getVideoTracks() ?? [])
        track.enabled = next.video;
      localMediaRef.current = next;
      setLocalMedia(next);
      sendMediaState(next);
    },
    [sendMediaState],
  );

  const toggleMicrophone = useCallback(
    () => updateLocalMedia({ ...localMediaRef.current, audio: !localMediaRef.current.audio }),
    [updateLocalMedia],
  );
  const toggleCamera = useCallback(
    () => updateLocalMedia({ ...localMediaRef.current, video: !localMediaRef.current.video }),
    [updateLocalMedia],
  );

  /** Switches one device live: new track into the preview and the call, old track stopped. */
  const switchDevice = useCallback(async (kind: "camera" | "microphone", deviceId: string) => {
    const settings = useSettingsStore.getState();
    if (kind === "camera") settings.setCamera(deviceId);
    else settings.setMicrophone(deviceId);
    const stream = localStreamRef.current;
    if (!stream) return;

    const replacement = await navigator.mediaDevices.getUserMedia(
      kind === "camera"
        ? { video: { deviceId: { exact: deviceId } } }
        : { audio: { deviceId: { exact: deviceId } } },
    );
    const [track] = kind === "camera" ? replacement.getVideoTracks() : replacement.getAudioTracks();
    if (!track) return;
    track.enabled = kind === "camera" ? localMediaRef.current.video : localMediaRef.current.audio;

    const previous = kind === "camera" ? stream.getVideoTracks() : stream.getAudioTracks();
    for (const old of previous) {
      stream.removeTrack(old);
      old.stop();
    }
    stream.addTrack(track);
    // While flagged the partner keeps getting the blurred copy, which follows the new camera.
    if (kind === "microphone" || !screenerRef.current?.flagged)
      await peerRef.current?.replaceTrack(track);
    setLocalStream(new MediaStream(stream.getTracks()));
  }, []);

  return {
    chat,
    preflight,
    requestMedia,
    localStream,
    remoteStream,
    peerState,
    partnerMedia,
    localMedia,
    quality,
    devices,
    toggleMicrophone,
    toggleCamera,
    switchDevice,
    screening,
    capturePartnerFrame,
  };
}
