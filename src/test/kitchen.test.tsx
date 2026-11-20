import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Kitchen } from "@/components/kitchen";
import { ScanScreen } from "@/components/scan-screen";
import { houseFixture } from "./household-fixtures";
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

it("discloses the photo transfer and requires the full date before saving a yearless label", async () => {
  vi.mocked(scan).mockResolvedValue({ raw_text: "19 NOV", date_type: "use_by", date: null });
  const save = vi.fn();
  const authorize = vi.fn();
  const screen = render(<ScanScreen today="2026-11-20" onSave={save} authorizeScan={authorize} />);
  expect(screen.getByText(/sends your photo to Google Gemini/)).toBeInTheDocument();
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
