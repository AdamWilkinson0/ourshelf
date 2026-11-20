import { describe, it, expect } from "vitest";
import {
  askingPrice,
  balance,
  daysLeft,
  foodDraft,
  houseSchema,
  update,
  type Action,
  type House,
} from "../lib/household";
import { haulFixture, houseFixture } from "./household-fixtures";
const now = new Date(2026, 10, 20, 12);
const today = "2026-11-20";
const act = (h: House, a: Action, date = now) => update(h, a, date);
const as = (h: House, id: string): House => ({ ...h, active: id });
function setup(id = "adam") {
  return as(houseFixture(today), id);
}
function request(h: House, id: string) {
  return act(h, { type: "request", id });
}
function accept(h: House, index = 0, date = now) {
  return act(h, { type: "respond", id: h.requests[index]!.id, accept: true }, date);
}
describe("household", () => {
  it("handles inclusive calendar-day windows, past dates and used food", () => {
    const f = houseFixture(today).food[0]!;
    for (const [date, price] of [
      ["2026-11-19", null],
      [today, 0],
      ["2026-11-21", 0],
      ["2026-11-22", 0],
      ["2026-11-23", null],
    ] as const)
      expect(askingPrice({ ...f, date }, today)).toBe(price);
    expect(askingPrice({ ...f, status: "used" }, today)).toBeNull();
    expect(daysLeft("2026-03-30", "2026-03-28")).toBe(2);
  });
  it("transfers ownership for free and closes competing requests", () => {
    let h = request(setup(), "yoghurt");
    h = request(as(h, "leo"), "yoghurt");
    h = accept(as(h, "maya"));
    expect(h.requests.map((r) => r.status)).toEqual(["accepted", "closed"]);
    expect(h.food.find((f) => f.id === "yoghurt")?.owner).toBe("adam");
    expect(balance(h, "adam")).toBe(25);
    expect(h.ledger[0]?.amount).toBe(0);
    expect(() => accept(h)).toThrow();
  });
  it("moves the agreed price exactly once and preserves book totals", () => {
    let h = request(setup(), "milk");
    h = as(h, "maya");
    h = act(h, { type: "edit", id: "milk", status: "shareable", price: 18 });
    h = accept(h);
    expect(balance(h, "adam")).toBe(19);
    expect(balance(h, "maya")).toBe(36);
    expect(h.food.find((f) => f.id === "milk")).toMatchObject({
      owner: "adam",
      status: "private",
      price: 0,
    });
    expect(() => accept(h)).toThrow();
  });
  it("rechecks the expiry window and remaining balance before accepting", () => {
    const h = as(request(setup(), "milk"), "maya");
    expect(accept(h, 0, new Date(2026, 10, 23, 12)).ledger[0]?.amount).toBe(0);
    expect(() => accept(h, 0, new Date(2026, 10, 26, 12))).toThrow();
    h.members[0]!.opening = 0;
    expect(() => accept(h)).toThrow();
    expect(h.ledger).toHaveLength(0);
  });
  it("rejects self, duplicate and private requests and supports declines", () => {
    const h = request(setup(), "milk");
    expect(() => request(h, "milk")).toThrow();
    expect(() => request(h, "spinach")).toThrow();
    expect(() => request(as(h, "leo"), "tomatoes")).toThrow();
    const denied = act(as(h, "maya"), { type: "respond", id: h.requests[0]!.id, accept: false });
    expect(denied.food).toEqual(h.food);
    expect(denied.ledger).toHaveLength(0);
    expect(denied.requests[0]?.status).toBe("declined");
  });
  it("closes pending requests when food is used or made private outside the window", () => {
    const h = as(request(setup(), "milk"), "maya");
    for (const status of ["private", "used"] as const)
      expect(act(h, { type: "edit", id: "milk", status, price: 0 }).requests[0]?.status).toBe(
        "closed",
      );
  });
  it("earns chore points and preserves them through serialization", () => {
    const h = act(setup(), { type: "chore", name: "Take out the bins" });
    expect(balance(h, "adam")).toBe(35);
    expect(houseSchema.parse(JSON.parse(JSON.stringify(h)))).toEqual(h);
  });
  it("adds a reviewed haul atomically and validates calendar dates", () => {
    const h = setup();
    const rows = haulFixture(today);
    expect(act(h, { type: "add", rows }).food).toHaveLength(h.food.length + 3);
    for (const date of ["0", "2026-02-31", ""])
      expect(foodDraft.safeParse({ ...rows[0], date }).success).toBe(false);
    expect(() =>
      act(h, { type: "add", rows: [rows[0]!, { ...rows[1]!, quantity: "" }] }),
    ).toThrow();
    expect(h.food).toHaveLength(7);
  });
});
