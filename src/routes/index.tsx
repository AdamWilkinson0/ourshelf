import { createFileRoute } from "@tanstack/react-router";
import { HouseholdHome } from "@/components/household-home";
import { tabs, type Tab } from "@/lib/navigation";
export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): { view?: Tab; demo?: boolean } => ({
    ...(tabs.includes(s["view"] as Tab) ? { view: s["view"] as Tab } : {}),
    ...(s["demo"] === true ? { demo: true } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Shelf Life" },
      { name: "description", content: "Your shared kitchen for food, chores and house points." },
      { property: "og:title", content: "Shelf Life" },
    ],
  }),
  component: Index,
});
function Index() {
  const { view, demo } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <HouseholdHome
      tab={view ?? "food"}
      demo={demo === true}
      go={(view) => void navigate({ search: (previous) => ({ ...previous, view }) })}
      setDemo={(enabled) =>
        void navigate({ search: enabled ? { demo: true } : { view: "profile" } })
      }
    />
  );
}
