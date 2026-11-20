import { shifted, type Draft, type Food, type House } from "@/lib/household";

export function haulFixture(today: string): Draft[] {
  return [
    ["Greek yoghurt", "500 g", 1],
    ["Carrots", "1 bag", 3],
    ["Milk", "2 pints", 5],
  ].map(([name, quantity, offset]) => ({
    name: String(name),
    quantity: String(quantity),
    date: shifted(today, Number(offset)),
    date_confidence: "estimated",
    date_type: null,
  }));
}
export function houseFixture(today: string): House {
  const members = [
    { id: "adam", name: "Adam", colour: "sage", opening: 25 },
    { id: "maya", name: "Maya", colour: "peach", opening: 30 },
    { id: "leo", name: "Leo", colour: "lilac", opening: 20 },
  ];
  const food: Food[] = [];
  function add(id: string, name: string, quantity: string, owner: string, days: number, price = 0) {
    food.push({
      id,
      name,
      quantity,
      owner,
      date: shifted(today, days),
      date_type: name === "Milk" || name === "Greek yoghurt" ? "use_by" : "best_before",
      date_confidence: "read",
      price,
      status: price ? "shareable" : "private",
    });
  }
  add("spinach", "Baby spinach", "1 bag", "adam", 1);
  add("tomatoes", "Cherry tomatoes", "250 g", "adam", 3);
  add("eggs", "Free range eggs", "6 eggs", "adam", 8, 5);
  add("yoghurt", "Greek yoghurt", "500 g", "maya", 1);
  add("milk", "Milk", "2 pints", "maya", 5, 6);
  add("lemons", "Lemons", "3 lemons", "leo", 2);
  add("pasta", "Fusilli pasta", "500 g", "leo", 60, 4);
  return { version: 1, active: null, members, food, requests: [], ledger: [] };
}
