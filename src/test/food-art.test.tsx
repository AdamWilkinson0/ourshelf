import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import { FoodArt } from "@/components/food-art";

const groceries = {
  "orange-juice": "Fresh orange juice",
  crisps: "Cheese & onion crisps",
  "peanut-butter": "Crunchy peanut butter",
  jam: "Strawberry jam",
  honey: "Runny honey",
  pasta: "Fusilli pasta",
  sauce: "Tomato purée",
  tinned: "Tin of tuna",
  juice: "Apple juice",
  oil: "Extra virgin olive oil",
  "ice-cream": "Vanilla ice cream",
  biscuits: "Chocolate chip cookies",
  chocolate: "Milk chocolate bar",
  cereal: "Corn flakes",
  bacon: "Smoked back bacon",
  sausage: "Pork sausages",
  chicken: "Chicken breast fillets",
  steak: "Lean beef mince",
  prawns: "King prawns",
  salmon: "Salmon fillets",
  fish: "Cod fillets",
  eggs: "Free range eggs",
  yoghurt: "Greek yogurt",
  milk: "Semi-skimmed milk",
  cheese: "Mature Cheddar",
  butter: "Unsalted butter",
  onion: "Red onions",
  garlic: "Garlic bulb",
  tomato: "Cherry tomatoes",
  lettuce: "Romaine hearts",
  greens: "Baby spinach",
  carrot: "Organic carrots",
  potato: "Maris Piper potatoes",
  pepper: "Green bell pepper",
  cucumber: "Mini cucumbers",
  broccoli: "Tenderstem broccoli",
  mushroom: "Chestnut mushrooms",
  avocado: "Hass avocados",
  corn: "Sweetcorn",
  beans: "Butter beans",
  apple: "Granny Smith apples",
  pear: "Conference pears",
  banana: "Fairtrade bananas",
  orange: "Easy peel clementines",
  lemon: "Unwaxed lemons",
  lime: "Fresh limes",
  strawberry: "British strawberries",
  berries: "Frozen blueberries",
  bread: "Sourdough loaf",
  rice: "Basmati rice",
  flour: "Self-raising flour",
  tea: "English breakfast tea",
};

it("renders a distinct filled icon for each common grocery", () => {
  const entries = Object.entries(groceries);
  const { container } = render(
    <>
      {entries.map(([key, name]) => (
        <FoodArt key={key} name={name} />
      ))}
    </>,
  );
  expect(entries.length).toBeGreaterThanOrEqual(30);
  expect(
    Array.from(container.querySelectorAll("[data-food-icon]"), (icon) =>
      icon.getAttribute("data-food-icon"),
    ),
  ).toEqual(entries.map(([key]) => key));
  expect(new Set(Array.from(container.querySelectorAll("svg"), (svg) => svg.innerHTML)).size).toBe(
    entries.length,
  );
  expect(container.querySelectorAll('svg[stroke="currentColor"]')).toHaveLength(entries.length);
});

it("normalises scanned names, handles word boundaries, and falls back for unknown items", () => {
  const { container, rerender } = render(<FoodArt name="  ORANGE–JUICE 1L  " />);
  const icon = () => container.querySelector("[data-food-icon]");
  expect(icon()).toHaveAttribute("data-food-icon", "orange-juice");
  rerender(<FoodArt name="Egg noodles" />);
  expect(icon()).toHaveAttribute("data-food-icon", "pasta");
  rerender(<FoodArt name="Eggplant" />);
  expect(icon()).toHaveAttribute("data-food-icon", "groceries");
  rerender(<FoodArt name="Green bell pepper" />);
  expect(icon()).toHaveStyle("--food-skin: #a6c48c");
});
