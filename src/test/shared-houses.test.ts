import { describe, expect, it } from "vitest";
import { askingPrice, update, type House } from "@/lib/household";
import { houseCommand, visibleKitchen } from "@/lib/shared-houses";

import { haulFixture, houseFixture } from "./household-fixtures";

describe("shared house boundaries", () => {
  const today = "2026-11-20";

  it("projects only the viewer’s food and other food available today", () => {
    const house = houseFixture(today);
    const view = visibleKitchen(house, "leo", today);
    expect(view.active).toBe("leo");
    expect(view.food.map((food) => food.id)).toEqual([
      "spinach",
      "eggs",
      "yoghurt",
      "milk",
      "lemons",
      "pasta",
    ]);
    expect(house.active).toBeNull();
  });

  it("limits request details to the buyer and owner", () => {
    const current: House = { ...houseFixture(today), active: "adam" };
    const house = update(current, { type: "request", id: "milk" }, new Date(today), today);
    expect(visibleKitchen(house, "adam", today).requests).toHaveLength(1);
    expect(visibleKitchen(house, "maya", today).requests).toHaveLength(1);
    expect(visibleKitchen(house, "leo", today).requests).toHaveLength(0);
  });

  it("shows new food as free to housemates and honours the owner's price and privacy changes", () => {
    const now = new Date(today);
    const initial = { ...houseFixture(today), food: [], active: "adam" };
    const house = update(initial, { type: "add", rows: haulFixture(today) }, now, today);
    const [yoghurt] = house.food;
    const id = yoghurt!.id;
    expect(visibleKitchen(house, "leo", today).food).toEqual(house.food);
    expect(house.food.every((item) => item.status === "shareable" && item.price === 0)).toBe(true);

    const priced = update(house, { type: "edit", id, status: "shareable", price: 4 }, now, today);
    const leo = visibleKitchen(priced, "leo", today);
    expect(
      askingPrice(
        leo.food.find((item) => item.id === id)!,
        today,
      ),
    ).toBe(4);
    const requested = update({ ...priced, active: "leo" }, { type: "request", id }, now, today);
    expect(requested.requests[0]?.price).toBe(4);

    const hidden = update(
      { ...requested, active: "adam" },
      { type: "edit", id, status: "private", price: 0 },
      now,
      today,
    );
    expect(visibleKitchen(hidden, "adam", today).food.some((item) => item.id === id)).toBe(true);
    expect(visibleKitchen(hidden, "leo", today).food.some((item) => item.id === id)).toBe(false);
    expect(visibleKitchen(hidden, "leo", today).requests[0]?.status).toBe("closed");
    expect(() => update({ ...hidden, active: "leo" }, { type: "request", id }, now, today)).toThrow(
      "This food is unavailable.",
    );
  });

  it("allows shared actions without permitting client identity switches or resets", () => {
    const id = "00000000-0000-4000-8000-000000000001";
    for (const type of ["switch", "reset"]) {
      expect(houseCommand.safeParse({ type: "act", id, action: { type, id } }).success).toBe(false);
    }
    expect(
      houseCommand.safeParse({
        type: "act",
        id,
        action: { type: "chore", name: "Take out the bins" },
      }).success,
    ).toBe(true);
    for (const action of [
      { type: "logChore", id: "bins" },
      { type: "saveChore", id: "bins", name: "Recycling", points: 12 },
      { type: "deleteChore", id: "bins" },
      { type: "removeChoreLog", id },
    ]) {
      expect(houseCommand.safeParse({ type: "act", id, action }).success).toBe(true);
    }
  });
});
