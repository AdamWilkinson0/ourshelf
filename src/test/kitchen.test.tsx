import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { Kitchen } from "@/components/kitchen";
import { ScanScreen } from "@/components/scan-screen";
import { houseFixture } from "./household-fixtures";
import { update, type House } from "@/lib/household";
import type { Tab } from "@/lib/navigation";
import { scan } from "@/lib/scanner";

vi.mock("@/lib/scanner", () => ({ scan: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("saves manually entered food to the signed-in house", async () => {
  const today = "2026-11-20";
  const act = vi.fn().mockResolvedValue(undefined);
  const go = vi.fn();
  const screen = render(
    <Kitchen
      tab="scan"
      go={go}
      shared={{
        state: { house: { ...houseFixture(today), active: "adam" }, today, revision: 0 },
        name: "Oak House",
        profile: null,
        act,
        authorizeScan: vi.fn(),
      }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Enter manually" }));
  fireEvent.change(screen.getByLabelText("Food name"), { target: { value: "Bread" } });
  fireEvent.click(screen.getByRole("button", { name: "Save to My Food" }));
  await waitFor(() => expect(go).toHaveBeenCalledWith("food"));
  expect(act).toHaveBeenCalledWith({
    type: "add",
    rows: [
      {
        name: "Bread",
        quantity: "1 pack",
        date: today,
        date_confidence: "manual",
        date_type: null,
      },
    ],
  });
});

it("lets the owner change the price of newly saved food and make it private", async () => {
  const today = "2026-11-20";
  const now = new Date(today);
  function SignedInKitchen() {
    const [tab, setTab] = useState<Tab>("scan");
    const [house, setHouse] = useState<House>(() => ({
      ...houseFixture(today),
      food: [],
      active: "adam",
    }));
    return (
      <Kitchen
        tab={tab}
        go={setTab}
        shared={{
          state: { house, today, revision: 0 },
          name: "Oak House",
          profile: null,
          act: async (action) => setHouse((current) => update(current, action, now, today)),
          authorizeScan: vi.fn(),
        }}
      />
    );
  }

  const app = render(<SignedInKitchen />);
  fireEvent.click(app.getByRole("button", { name: "Enter manually" }));
  fireEvent.change(app.getByLabelText("Food name"), { target: { value: "Bread" } });
  fireEvent.click(app.getByRole("button", { name: "Save to My Food" }));
  await app.findByRole("button", { name: "Manage Bread" });

  const manageBread = () => fireEvent.click(app.getByRole("button", { name: "Manage Bread" }));
  const sharing = () => app.getByRole("combobox", { name: "Sharing" });
  const price = () => app.getByRole("spinbutton", { name: "Asking price in points" });
  const save = async () => {
    fireEvent.click(app.getByRole("button", { name: "Save settings" }));
    await waitFor(() => expect(app.queryByRole("dialog")).not.toBeInTheDocument());
  };

  manageBread();
  expect(sharing()).toHaveValue("shareable");
  expect(price()).toHaveValue(0);
  fireEvent.change(price(), { target: { value: "5" } });
  await save();

  manageBread();
  expect(price()).toHaveValue(5);
  fireEvent.change(sharing(), { target: { value: "private" } });
  expect(app.getByText("Only visible to you.")).toBeInTheDocument();
  await save();

  fireEvent.click(app.getByRole("button", { name: /^Sharing$/ }));
  expect(app.queryByRole("button", { name: "Manage Bread" })).not.toBeInTheDocument();
  fireEvent.click(app.getByRole("button", { name: "All food" }));
  expect(app.getByRole("button", { name: "Manage Bread" })).toBeInTheDocument();
});

it("requires the full date before saving a yearless label", async () => {
  vi.mocked(scan).mockResolvedValue({ raw_text: "19 NOV", date_type: "use_by", date: null });
  const save = vi.fn();
  const authorize = vi.fn();
  const screen = render(<ScanScreen today="2026-11-20" onSave={save} authorizeScan={authorize} />);
  fireEvent.click(screen.getByRole("button", { name: "Enter manually" }));
  fireEvent.change(screen.getByLabelText("Food name"), { target: { value: "Milk" } });
  fireEvent.change(screen.getByLabelText("Snap date"), {
    target: { files: [new File(["test photo"], "milk.jpg", { type: "image/jpeg" })] },
  });
  await screen.findByText(/enter the full date, including the year/);
  const date = screen.getByLabelText("Date");
  expect(date).toHaveValue("");
  expect(date).toBeInvalid();
  fireEvent.click(screen.getByRole("button", { name: "Save to My Food" }));
  expect(save).not.toHaveBeenCalled();
  fireEvent.change(date, { target: { value: "2026-11-19" } });
  fireEvent.click(screen.getByRole("button", { name: "Save to My Food" }));
  expect(save).toHaveBeenCalledWith([
    expect.objectContaining({ date: "2026-11-19", date_confidence: "manual" }),
  ]);
});

it("manages the chore list and limits history deletion to the active housemate", async () => {
  const today = "2026-11-20";
  const now = new Date(today);
  const base = update(
    { ...houseFixture(today), active: "maya" },
    { type: "logChore", id: "dishes" },
    now,
    today,
  );

  function SignedInChores() {
    const [house, setHouse] = useState<House>({ ...base, active: "adam" });
    return (
      <Kitchen
        tab="board"
        go={vi.fn()}
        shared={{
          state: { house, today, revision: 0 },
          name: "Oak House",
          profile: null,
          act: async (action) => setHouse((current) => update(current, action, now, today)),
          authorizeScan: vi.fn(),
        }}
      />
    );
  }

  const screen = render(<SignedInChores />);

  fireEvent.click(await screen.findByRole("button", { name: "Log chore" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Edit" }));
  fireEvent.click(screen.getByRole("button", { name: "Edit Take out the bins" }));
  fireEvent.change(screen.getByLabelText("Chore name"), { target: { value: "Put out recycling" } });
  fireEvent.change(screen.getByLabelText("Points"), { target: { value: "12" } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  fireEvent.click(await screen.findByRole("button", { name: "Add a chore" }));
  fireEvent.change(screen.getByLabelText("Chore name"), { target: { value: "Water the plants" } });
  fireEvent.change(screen.getByLabelText("Points"), { target: { value: "4" } });
  fireEvent.click(screen.getByRole("button", { name: "Add chore" }));
  fireEvent.click(await screen.findByRole("button", { name: "Edit Water the plants" }));
  fireEvent.click(screen.getByRole("button", { name: "Delete chore" }));
  fireEvent.click(screen.getByRole("button", { name: "Remove from list" }));
  fireEvent.click(await screen.findByRole("button", { name: "Done" }));
  expect(screen.queryByRole("button", { name: /Water the plants/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Put out recycling.*12 pts/ }));

  fireEvent.click(await screen.findByRole("button", { name: "View Maya’s chore history" }));
  expect(screen.getByText("Wash the dishes")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Delete/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Back to leaderboard" }));
  fireEvent.click(screen.getByRole("button", { name: "View Adam’s chore history" }));
  fireEvent.click(screen.getByRole("button", { name: "Delete logged chore Put out recycling" }));
  fireEvent.click(screen.getByRole("button", { name: "Delete log" }));
  expect(await screen.findByText("No chores logged yet.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Back to leaderboard" }));
  expect(screen.getByRole("heading", { name: "25 pts" })).toBeInTheDocument();
});
