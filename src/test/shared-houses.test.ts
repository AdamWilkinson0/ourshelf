import { describe, expect, it } from "vitest";
import { seed, update, type House } from "@/lib/household";
import { houseCommand, visibleKitchen } from "@/lib/shared-houses";

describe("shared house boundaries", () => {
  const today = "2026-11-20";

  it("projects only the viewer’s food and other food available today", () => {
    const house = seed(today);
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
    const current: House = { ...seed(today), active: "adam" };
    const house = update(current, { type: "request", id: "milk" }, new Date(today), today);
    expect(visibleKitchen(house, "adam", today).requests).toHaveLength(1);
    expect(visibleKitchen(house, "maya", today).requests).toHaveLength(1);
    expect(visibleKitchen(house, "leo", today).requests).toHaveLength(0);
  });

  it("allows shared actions without permitting demo identity switches or resets", () => {
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
  });
});
