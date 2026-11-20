import { createClient } from "@supabase/supabase-js";
import { getRequestHeader } from "@tanstack/react-start/server";
import { houseDate, houseSchema, update, type House } from "./household";
import {
  visibleKitchen,
  type HouseCommand,
  type HouseReply,
  type HouseSummary,
} from "./shared-houses";

import { issueScanGrant, scanSecret } from "./scan-grant";

class HouseError extends Error {}

function backend() {
  const url = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
  const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !serviceKey)
    throw new HouseError("Shared houses are unavailable. Try again shortly.");
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
type Backend = ReturnType<typeof backend>;
async function tokenHash(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function requireData<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw result.error;
  return result.data;
}
function requireRow<T>(result: { data: T; error: unknown }): NonNullable<T> {
  const data = requireData(result);
  if (data == null) throw Error("Required database record is missing");
  return data;
}
async function membership(db: Backend, user: string, id: string) {
  return requireData(
    await db
      .from("shelf_members")
      .select("role")
      .eq("house_id", id)
      .eq("user_id", user)
      .maybeSingle(),
  );
}
async function readKitchen(db: Backend, id: string, user: string) {
  const [row, members] = await Promise.all([
    db.from("shelf_houses").select("revision, kitchen").eq("id", id).single(),
    db
      .from("shelf_members")
      .select("user_id, profile:shelf_profiles!inner(display_name)")
      .eq("house_id", id)
      .order("user_id"),
  ]);
  const state = requireRow(row);
  const colours = ["sage", "peach", "lilac"];
  const roster = requireRow(members).map((member, index) => ({
    id: member.user_id as string,
    name: (member.profile as unknown as { display_name: string }).display_name,
    opening: 0,
    colour: colours[index % colours.length],
  }));
  const house = houseSchema.parse({ ...state.kitchen, version: 1, active: user, members: roster });
  return { house, revision: Number(state.revision) };
}
function kitchenColumns(house: House) {
  return {
    food: house.food,
    requests: house.requests,
    ledger: house.ledger,
    choreTemplates: house.choreTemplates,
  };
}
async function dispatch(db: Backend, user: string, command: HouseCommand): Promise<HouseReply> {
  switch (command.type) {
    case "list": {
      const [profile, memberships] = await Promise.all([
        db.from("shelf_profiles").select("display_name").eq("id", user).maybeSingle(),
        db
          .from("shelf_members")
          .select("role, house:shelf_houses!inner(id,name)")
          .eq("user_id", user),
      ]);
      const houses = requireRow(memberships)
        .map((entry) => ({
          ...(entry.house as unknown as Pick<HouseSummary, "id" | "name">),
          role: entry.role as HouseSummary["role"],
        }))
        .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
      return { name: requireData(profile)?.display_name ?? null, houses };
    }
    case "name": {
      requireData(
        await db
          .from("shelf_profiles")
          .upsert(
            { id: user, display_name: command.name },
            { onConflict: "id", ignoreDuplicates: true },
          ),
      );
      const row = requireRow(
        await db.from("shelf_profiles").select("display_name").eq("id", user).single(),
      );
      return { name: row.display_name };
    }
    case "create": {
      const id = requireData(
        await db.rpc("shelf_create_house", { p_user: user, p_name: command.name }),
      );
      return { id };
    }
    case "inspect":
    case "join": {
      const hash = await tokenHash(command.token);
      if (command.type === "join") {
        const id = requireData(await db.rpc("shelf_redeem_invite", { p_user: user, p_hash: hash }));
        if (!id)
          throw new HouseError(
            "This link has expired or been revoked. Ask the owner for a new invitation.",
          );
        return { id };
      }
      const invite = requireData(
        await db
          .from("shelf_invites")
          .select("house_id, expires_at, revoked_at, house:shelf_houses!inner(name)")
          .eq("token_hash", hash)
          .maybeSingle(),
      );
      const joined = Boolean(invite && (await membership(db, user, invite.house_id)));
      if (
        !invite ||
        (!joined && (invite.revoked_at || Date.parse(invite.expires_at) <= Date.now()))
      ) {
        throw new HouseError(
          "This link has expired or been revoked. Ask the owner for a new invitation.",
        );
      }
      return {
        id: invite.house_id,
        name: (invite.house as unknown as { name: string }).name,
        joined,
      };
    }
    case "invite":
    case "revoke": {
      if ((await membership(db, user, command.id))?.role !== "owner") {
        throw new HouseError("Only the house owner can manage invitations.");
      }
      const token =
        command.type === "invite"
          ? Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
              byte.toString(16).padStart(2, "0"),
            ).join("")
          : null;
      const expiresAt = requireData(
        await db.rpc("shelf_change_invite", {
          p_user: user,
          p_house: command.id,
          p_hash: token ? await tokenHash(token) : null,
        }),
      );
      return token ? { token, expiresAt } : null;
    }
    case "scanGrant": {
      if (!(await membership(db, user, command.id)))
        throw new HouseError("You don’t belong to this house.");
      const secret = scanSecret.safeParse(process.env["SCAN_GRANT_SECRET"]);
      if (!secret.success) throw new HouseError("Live scanning is unavailable.");
      return { grant: await issueScanGrant(secret.data, user) };
    }
    case "read":
    case "act": {
      if (!(await membership(db, user, command.id)))
        throw new HouseError("You don’t belong to this house.");
      const now = new Date();
      const today = houseDate(now);
      for (let attempt = 0; attempt < 3; attempt++) {
        const current = await readKitchen(db, command.id, user);
        if (command.type === "read")
          return { ...current, today, house: visibleKitchen(current.house, user, today) };
        let house;
        try {
          house = update(current.house, command.action, now, today);
        } catch (error) {
          throw new HouseError(
            error instanceof Error ? error.message : "That change is unavailable.",
          );
        }
        const revision = current.revision + 1;
        const written = requireData(
          await db
            .from("shelf_houses")
            .update({ kitchen: kitchenColumns(house), revision })
            .eq("id", command.id)
            .eq("revision", current.revision)
            .select("revision")
            .maybeSingle(),
        );
        if (written) return { house: visibleKitchen(house, user, today), revision, today };
      }
      throw new HouseError("The house changed at the same time. Refresh and try again.");
    }
  }
}

export async function handleHouse(
  command: HouseCommand,
): Promise<{ ok: true; data: HouseReply } | { ok: false; message: string }> {
  try {
    const token = getRequestHeader("Authorization")?.match(/^Bearer (\S+)$/i)?.[1];
    if (!token) throw new HouseError("Sign in to use shared houses.");
    const db = backend();
    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user) throw new HouseError("Your sign-in expired. Sign in again.");
    return { ok: true, data: await dispatch(db, data.user.id, command) };
  } catch (error) {
    if (error instanceof HouseError) return { ok: false, message: error.message };
    console.error(
      "Shared house request failed",
      command.type,
      error && typeof error === "object" && "code" in error ? error.code : "unknown",
    );
    return { ok: false, message: "Couldn’t load or update shared houses. Try again shortly." };
  }
}
