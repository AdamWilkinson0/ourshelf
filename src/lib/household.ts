import { z } from "zod";

export function localDate(at = new Date()) {
  return [
    at.getFullYear(),
    String(at.getMonth() + 1).padStart(2, "0"),
    String(at.getDate()).padStart(2, "0"),
  ].join("-");
}
const houseCalendar = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export function houseDate(at = new Date()) {
  return houseCalendar.format(at);
}
export function shifted(date: string, days: number) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function daysLeft(date: string, today: string) {
  return (Date.parse(date) - Date.parse(today)) / 86400000;
}
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) =>
      Number.isFinite(Date.parse(s + "T00:00:00Z")) &&
      new Date(s + "T00:00:00Z").toISOString().startsWith(s),
    "Choose a valid date",
  );
const points = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const foodDraft = z.object({
  name: z.string().trim().min(1).max(120),
  quantity: z.string().trim().min(1).max(80),
  date: dateSchema,
  date_type: z.enum(["use_by", "best_before"]).nullable(),
  date_confidence: z.enum(["read", "estimated", "manual"]),
});
export type Draft = z.infer<typeof foodDraft>;
const itemSchema = foodDraft.extend({
  id: z.string(),
  owner: z.string(),
  status: z.enum(["private", "shareable", "used"]),
  price: points,
});
export type Food = z.infer<typeof itemSchema>;
const memberSchema = z.object({
  id: z.string(),
  name: z.string(),
  colour: z.string(),
  opening: points,
});
export type Member = z.infer<typeof memberSchema>;
const requestSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  owner: z.string(),
  buyer: z.string(),
  price: points,
  status: z.enum(["pending", "accepted", "declined", "closed"]),
});
export type FoodRequest = z.infer<typeof requestSchema>;
const entrySchema = z.object({
  id: z.string(),
  time: z.string().datetime(),
  from: z.string().nullable(),
  to: z.string(),
  amount: points,
  label: z.string(),
  kind: z.enum(["food", "chore"]),
});
export const houseSchema = z.object({
  version: z.literal(1),
  active: z.string().nullable(),
  members: z.array(memberSchema).min(1),
  food: z.array(itemSchema),
  requests: z.array(requestSchema),
  ledger: z.array(entrySchema),
});
export type House = z.infer<typeof houseSchema>;
export const chores = [
  { name: "Take out the bins", points: 10 },
  { name: "Wash the dishes", points: 5 },
  { name: "Wipe the surfaces", points: 5 },
  { name: "Hoover the house", points: 15 },
  { name: "Clean the bathroom", points: 20 },
];
export function balance(h: House, id: string, opening = true, since = "") {
  return (
    (opening ? (h.members.find((m) => m.id === id)?.opening ?? 0) : 0) +
    h.ledger
      .filter((e) => e.time >= since)
      .reduce((n, e) => n + (e.to === id ? e.amount : 0) - (e.from === id ? e.amount : 0), 0)
  );
}
export function askingPrice(food: Food, today: string): number | null {
  return food.status === "shareable" && daysLeft(food.date, today) >= 0 ? food.price : null;
}
export type Action =
  | { type: "add"; rows: Draft[] }
  | { type: "edit"; id: string; status: Food["status"]; price: number }
  | { type: "request"; id: string }
  | { type: "respond"; id: string; accept: boolean }
  | { type: "chore"; name: string };
export function update(
  state: House,
  action: Action,
  now = new Date(),
  today = localDate(now),
): House {
  const h = structuredClone(state);
  const uid = () => crypto.randomUUID();
  const me = h.active;
  if (!me) throw Error("Your house membership is unavailable.");
  if (action.type === "add") {
    if (!action.rows.length) throw Error("Add at least one item.");
    for (const row of action.rows) {
      const parsed = foodDraft.safeParse(row);
      if (!parsed.success) throw Error("Give every item a name, quantity and valid date.");
      h.food.push({ ...parsed.data, id: uid(), owner: me, status: "shareable", price: 0 });
    }
  } else if (action.type === "chore") {
    const chore = chores.find((c) => c.name === action.name);
    if (!chore) throw Error("Choose a chore.");
    h.ledger.push({
      id: uid(),
      time: now.toISOString(),
      from: null,
      to: me,
      amount: chore.points,
      label: chore.name,
      kind: "chore",
    });
  } else if (action.type === "edit") {
    const f = h.food.find((f) => f.id === action.id && f.owner === me && f.status !== "used");
    if (!f || !points.safeParse(action.price).success)
      throw Error("Choose a whole, non-negative points price.");
    f.price = action.price;
    f.status = action.status;
    if (askingPrice(f, today) === null)
      h.requests
        .filter((r) => r.itemId === f.id && r.status === "pending")
        .forEach((r) => (r.status = "closed"));
  } else if (action.type === "request") {
    const f = h.food.find((f) => f.id === action.id);
    const price = f ? askingPrice(f, today) : null;
    if (!f || f.owner === me || price === null) throw Error("This food is unavailable.");
    if (h.requests.some((r) => r.itemId === f.id && r.buyer === me && r.status === "pending"))
      throw Error("Already requested.");
    if (balance(h, me) < price) throw Error("Log a chore to earn enough points.");
    h.requests.push({
      id: uid(),
      itemId: f.id,
      buyer: me,
      owner: f.owner,
      status: "pending",
      price,
    });
  } else {
    const r = h.requests.find(
      (r) => r.id === action.id && r.owner === me && r.status === "pending",
    );
    if (!r) throw Error("This request is already closed.");
    if (!action.accept) {
      r.status = "declined";
      return h;
    }
    const f = h.food.find((f) => f.id === r.itemId && f.owner === me);
    const currentPrice = f ? askingPrice(f, today) : null;
    if (!f || currentPrice === null) throw Error("This food is no longer available.");
    const charge = currentPrice === 0 ? 0 : r.price;
    if (balance(h, r.buyer) < charge)
      throw Error("Your housemate needs more points for this request.");
    r.status = "accepted";
    r.price = charge;
    h.ledger.push({
      id: uid(),
      time: now.toISOString(),
      from: r.buyer,
      to: me,
      amount: charge,
      label: f.name,
      kind: "food",
    });
    h.requests
      .filter((other) => other.itemId === f.id && other.status === "pending")
      .forEach((other) => (other.status = "closed"));
    f.owner = r.buyer;
    f.status = "private";
    f.price = 0;
  }
  return h;
}
