import type { BanTarget } from "../../../domain/moderation/ban.js";

/**
 * Socket.IO room names. Every socket joins its subject, device and network rooms, so anything
 * (including the workers, through the Redis emitter) can reach or disconnect a person by any of them.
 */
export const subjectRoom = (subjectId: string) => `subject:${subjectId}`;
export const deviceRoom = (deviceId: string) => `device:${deviceId}`;
export const networkRoom = (networkHash: string) => `net:${networkHash}`;
export const subnetRoom = (subnetHash: string) => `subnet:${subnetHash}`;

export function roomForBanTarget(target: BanTarget): string {
  switch (target.kind) {
    case "account":
      return subjectRoom(target.value);
    case "device":
      return deviceRoom(target.value);
    case "ip":
      return networkRoom(target.value);
    case "subnet":
      return subnetRoom(target.value);
  }
}

/** Server-to-client event telling a person they were banned, just before they are disconnected. */
export const BANNED_EVENT = "moderation:banned";

/** Server-to-client event carrying a moderator warning; the person keeps chatting. */
export const WARNING_EVENT = "moderation:warning";
