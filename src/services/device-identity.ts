const STORAGE_KEY = "parley.device-id";

function persistentDeviceId(): string {
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.localStorage.setItem(STORAGE_KEY, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

/** Stable, low-entropy browser traits. Combined with the stored id they survive casual id resets. */
function browserTraits(): string {
  return [
    navigator.userAgent,
    navigator.language,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    String(navigator.hardwareConcurrency),
  ].join("|");
}

const toBase64Url = (buffer: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

/**
 * A one-way SHA-256 fingerprint of this browser, sent so moderation can enforce device bans for
 * anonymous users. The server hashes it again with a secret before storing it; the raw traits are
 * never sent or stored.
 */
export async function getDeviceFingerprint(): Promise<string> {
  const material = new TextEncoder().encode(`${persistentDeviceId()}|${browserTraits()}`);
  return toBase64Url(await crypto.subtle.digest("SHA-256", material));
}
