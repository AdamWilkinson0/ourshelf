import { z } from "zod";
import { askingPrice, choreDetails, choreId, foodDraft, type House } from "./household";

export const houseId = z.string().uuid();
export const displayName = z.string().trim().min(1).max(40);
export const houseName = z.string().trim().min(1).max(60);
const inviteToken = z.string().regex(/^[a-f0-9]{64}$/);
export const sharedAction = z.discriminatedUnion("type", [
  z.object({ type: z.literal("add"), rows: z.array(foodDraft).min(1).max(100) }),
  z.object({
    type: z.literal("edit"),
    id: houseId,
    status: z.enum(["private", "shareable", "used"]),
    price: z.number().int().min(0).max(1000000),
  }),
  z.object({ type: z.literal("request"), id: houseId }),
  z.object({ type: z.literal("respond"), id: houseId, accept: z.boolean() }),
  z.object({ type: z.literal("chore"), name: z.string().max(60) }),
  z.object({ type: z.literal("logChore"), id: choreId }),
  choreDetails.extend({ type: z.literal("saveChore"), id: choreId.optional() }),
  z.object({ type: z.literal("deleteChore"), id: choreId }),
  z.object({ type: z.literal("removeChoreLog"), id: houseId }),
]);

export const houseCommand = z.discriminatedUnion("type", [
  z.object({ type: z.literal("list") }),
  z.object({ type: z.literal("name"), name: displayName }),
  z.object({ type: z.literal("create"), name: houseName }),
  z.object({ type: z.literal("read"), id: houseId }),
  z.object({ type: z.literal("scanGrant"), id: houseId }),
  z.object({ type: z.literal("act"), id: houseId, action: sharedAction }),
  z.object({ type: z.literal("invite"), id: houseId }),
  z.object({ type: z.literal("revoke"), id: houseId }),
  z.object({ type: z.literal("inspect"), token: inviteToken }),
  z.object({ type: z.literal("join"), token: inviteToken }),
]);

export type HouseCommand = z.infer<typeof houseCommand>;
export type HouseSummary = { id: string; name: string; role: "owner" | "member" };
export type SharedKitchen = {
  house: House;
  today: string;
  revision: number;
};
export type HouseReplies = {
  list: { name: string | null; houses: HouseSummary[] };
  name: { name: string };
  create: { id: string };
  read: SharedKitchen;
  scanGrant: { grant: string };
  act: SharedKitchen;
  invite: { token: string; expiresAt: string };
  revoke: null;
  inspect: { id: string; name: string; joined: boolean };
  join: { id: string };
};
export type HouseReply = HouseReplies[keyof HouseReplies];

export function visibleKitchen(house: House, actor: string, today: string): House {
  const involved = house.requests.filter(
    (request) => request.buyer === actor || request.owner === actor,
  );
  return {
    ...house,
    active: actor,
    food: house.food.filter((item) => item.owner === actor || askingPrice(item, today) !== null),
    requests: involved,
  };
}
