import { z } from "zod";

const identity = z.string().uuid();
const lifetime = 60;
const encoder = new TextEncoder();

export const scanSecret = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

function signingKey(secret: string, use: "sign" | "verify") {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [use],
  );
}

export async function issueScanGrant(secret: string, user: string) {
  const expires = Math.floor(Date.now() / 1000) + lifetime;
  const payload = String(expires) + "." + user;
  const key = await signingKey(secret, "sign");
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const hex = Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return payload + "." + hex;
}

export async function verifyScanGrant(secret: string, authorization: string | null) {
  const match = authorization?.match(/^Bearer (\d{10})\.([a-f0-9-]{36})\.([a-f0-9]{64})$/i);
  if (!match) return null;
  const [, expires, user, hex] = match;
  const now = Math.floor(Date.now() / 1000);
  if (
    !expires ||
    !user ||
    !hex ||
    !identity.safeParse(user).success ||
    Number(expires) <= now ||
    Number(expires) > now + lifetime + 5
  )
    return null;
  const signature = Uint8Array.from(hex.match(/../g)!, (byte) => Number.parseInt(byte, 16));
  const valid = await crypto.subtle.verify(
    "HMAC",
    await signingKey(secret, "verify"),
    signature,
    encoder.encode(expires + "." + user),
  );
  return valid ? user : null;
}
