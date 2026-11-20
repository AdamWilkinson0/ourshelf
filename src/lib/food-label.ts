import { daysLeft, type Food } from "./household";
export function shortDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
export function timing(f: Food, today: string) {
  const days = daysLeft(f.date, today);
  return {
    text: days < 0 ? "Past date" : days === 0 ? "Today" : days === 1 ? "Tomorrow" : days + " days",
    colour: days <= 1 ? "red" : days <= 3 ? "amber" : "green",
  };
}
export function label(food: Food) {
  if (food.date_confidence === "estimated") return "Estimated";
  if (food.date_type === "use_by") return "Use by";
  return food.date_type === "best_before" ? "Best before" : "Dated";
}
