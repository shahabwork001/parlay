import { isIPv4, isIPv6 } from "node:net";
import type { BanTarget } from "../../../domain/moderation/ban.js";
import type { KeyedHasher } from "../identity/ports.js";

/**
 * Who is connecting, as moderation sees them: ids plus keyed hashes of the network address, so
 * IP and subnet bans work without storing raw addresses.
 */
export interface AccessIdentity {
  readonly kind: "user" | "anonymous";
  readonly subjectId: string;
  readonly deviceId: string;
  readonly networkHash: string;
  readonly subnetHash: string;
}

/** The /24 of an IPv4 address or the /64 of an IPv6 address, in a canonical form. */
export function subnetOf(ip: string): string {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  const address = mapped?.[1] ?? ip;
  if (isIPv4(address)) return `${address.split(".").slice(0, 3).join(".")}.0/24`;
  if (isIPv6(address)) return `${expandIPv6(address).slice(0, 4).join(":")}::/64`;
  return address;
}

function expandIPv6(address: string): string[] {
  const [head = "", tail = ""] = address.split("::");
  const headParts = head ? head.split(":") : [];
  const tailParts = tail ? tail.split(":") : [];
  const missing = address.includes("::") ? 8 - headParts.length - tailParts.length : 0;
  return [...headParts, ...Array<string>(missing).fill("0"), ...tailParts].map((part) =>
    part.toLowerCase().replace(/^0+(?=.)/, ""),
  );
}

export function networkHashes(ip: string, hasher: KeyedHasher): { networkHash: string; subnetHash: string } {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  const address = mapped?.[1] ?? ip;
  return { networkHash: hasher.hash("ip", address), subnetHash: hasher.hash("ip", subnetOf(address)) };
}

/** Everything a ban could match for this identity. */
export function banTargetsFor(identity: AccessIdentity): BanTarget[] {
  const targets: BanTarget[] = [{ kind: "device", value: identity.deviceId }];
  if (identity.kind === "user") targets.unshift({ kind: "account", value: identity.subjectId });
  if (identity.networkHash) targets.push({ kind: "ip", value: identity.networkHash });
  if (identity.subnetHash) targets.push({ kind: "subnet", value: identity.subnetHash });
  return targets;
}

/** What an automatic ban covers: the account (if any) and the device, never shared networks. */
export function personalTargets(
  identity: Pick<AccessIdentity, "kind" | "subjectId" | "deviceId">,
): BanTarget[] {
  const targets: BanTarget[] = [{ kind: "device", value: identity.deviceId }];
  if (identity.kind === "user") targets.unshift({ kind: "account", value: identity.subjectId });
  return targets;
}
