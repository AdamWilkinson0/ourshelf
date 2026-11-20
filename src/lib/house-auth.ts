import { createClient } from "@supabase/supabase-js";

const url = import.meta.env["VITE_SUPABASE_URL"];
const key =
  import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] || import.meta.env["VITE_SUPABASE_ANON_KEY"];

export const sharedHousesConfigured = Boolean(url && key);
let client: ReturnType<typeof createClient> | undefined;
export function houseAuth() {
  if (!url || !key) throw Error("Shared houses are unavailable. Try the Clifton House demo.");
  return (client ??= createClient(url, key, { auth: { flowType: "pkce" } }));
}

const pendingInvite = "shelf-life.pending-invite";
export function readPendingInvite() {
  const url = new URL(location.href);
  const token = new URLSearchParams(url.hash.slice(1)).get("invite");
  if (token !== null) {
    const valid = /^[a-f0-9]{64}$/.test(token);
    if (valid)
      localStorage.setItem(
        pendingInvite,
        JSON.stringify({ token, expiresAt: Date.now() + 3600000 }),
      );
    else localStorage.removeItem(pendingInvite);
    url.hash = "";
    history.replaceState(history.state, "", url);
    return valid ? token : "invalid";
  }
  const cached = localStorage.getItem(pendingInvite);
  if (!cached) return null;
  try {
    const pending = JSON.parse(cached);
    if (pending.expiresAt > Date.now() && /^[a-f0-9]{64}$/.test(pending.token))
      return pending.token;
  } catch {
    // Clear malformed data left by a previous browser session.
  }
  clearPendingInvite();
  return null;
}
export function clearPendingInvite() {
  localStorage.removeItem(pendingInvite);
}
export function houseInviteUrl(token: string) {
  return new URL("/#invite=" + token, location.origin).href;
}
