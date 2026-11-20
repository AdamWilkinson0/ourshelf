import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Blank Template" },
      { name: "description", content: "A clean blank starting point." },
      { property: "og:title", content: "Blank Template" },
      { property: "og:description", content: "A clean blank starting point." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return <main className="min-h-screen bg-background" />;
}
