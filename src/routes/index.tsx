import { createFileRoute } from "@tanstack/react-router";
import { Kitchen } from "@/components/kitchen";
import { tabs, type Tab } from "@/lib/navigation";
export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): { view?: Tab } =>
    tabs.includes(s["view"] as Tab) ? { view: s["view"] as Tab } : {},
  head: () => ({
    meta: [
      { title: "Shelf Life · Clifton House" },
      { name: "description", content: "Your shared kitchen for food, chores and house points." },
      { property: "og:title", content: "Shelf Life · Clifton House" },
    ],
  }),
  component: Index,
});
function Index() {
  const { view } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <Kitchen
      tab={view ?? "food"}
      go={(v) => void navigate({ search: v === "food" ? {} : { view: v } })}
    />
  );
}
