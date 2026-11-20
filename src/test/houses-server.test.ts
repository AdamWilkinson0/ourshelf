// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { handleHouse } from "@/lib/houses.server";
import { verifyScanGrant } from "@/lib/scan-grant";

const { getRequestHeader, getUser, from, membership } = vi.hoisted(() => ({
  getRequestHeader: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  membership: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { getUser }, from }),
}));
vi.mock("@tanstack/react-start/server", () => ({ getRequestHeader }));

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});

it("issues scan grants only after validating the signed-in member of the requested house", async () => {
  const id = crypto.randomUUID();
  const user = crypto.randomUUID();
  const secret = "s".repeat(43);
  vi.stubEnv("SUPABASE_URL", "https://supabase.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role");
  vi.stubEnv("SCAN_GRANT_SECRET", secret);
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: membership,
  };
  from.mockReturnValue(query);
  const command = { type: "scanGrant", id } as const;
  getRequestHeader.mockReturnValue(undefined);
  expect(await handleHouse(command)).toMatchObject({ ok: false });
  expect(getUser).not.toHaveBeenCalled();

  getRequestHeader.mockReturnValue("Bearer test-session");
  getUser.mockResolvedValue({ data: { user: { id: user } }, error: null });
  membership.mockResolvedValue({ data: null, error: null });
  expect(await handleHouse(command)).toMatchObject({ ok: false });
  expect(query.eq.mock.calls).toEqual([
    ["house_id", id],
    ["user_id", user],
  ]);

  membership.mockResolvedValue({ data: { role: "member" }, error: null });
  const result = await handleHouse(command);
  expect(result.ok).toBe(true);
  if (!result.ok || !result.data || !("grant" in result.data))
    throw new Error("Expected scan grant");
  expect(await verifyScanGrant(secret, "Bearer " + result.data.grant)).toBe(user);
});
