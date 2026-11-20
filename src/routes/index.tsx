import { createFileRoute } from "@tanstack/react-router";
import { HouseholdHome } from "@/components/household-home";
import { tabs, type Tab } from "@/lib/navigation";
export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): { view?: Tab } =>
    tabs.includes(s["view"] as Tab) ? { view: s["view"] as Tab } : {},
  head: () => ({
    meta: [
      { title: "OurShelf" },
      { name: "description", content: "Your shared kitchen for food, chores and house points." },
      { property: "og:title", content: "OurShelf" },
    ],
  }),
  component: Index,
});
function Index() {
  const { view } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <HouseholdHome
      tab={view ?? "food"}
      go={(view) => void navigate({ search: (previous) => ({ ...previous, view }) })}
    />
  );
}
