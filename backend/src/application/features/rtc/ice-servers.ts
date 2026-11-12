/** WebRTC ICE server configuration handed to browsers (shape of RTCIceServer). */
export interface IceServer {
  readonly urls: readonly string[];
  readonly username?: string;
  readonly credential?: string;
}

export interface IceServerConfiguration {
  readonly iceServers: readonly IceServer[];
  /** Seconds until the TURN credentials expire; clients should fetch new ones before then. */
  readonly ttlSeconds: number;
}

/**
 * Issues STUN/TURN servers for one participant. TURN credentials are short-lived and bound to the
 * participant, so a leaked credential cannot be reused for long.
 */
export interface IceServerProvider {
  issue(subjectId: string): IceServerConfiguration;
}
