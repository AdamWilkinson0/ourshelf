import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Kitchen } from "@/components/kitchen";
import { ScanScreen } from "@/components/scan-screen";
import { houseSchema, seed } from "@/lib/household";
import { scan } from "@/lib/scanner";

vi.mock("@/lib/scanner", () => ({ scan: vi.fn() }));

afterEach(() => {
  cleanup();
  localStorage.clear();
  Reflect.deleteProperty(navigator, "locks");
  vi.clearAllMocks();
});

it("keeps concurrent demo writes from different profiles without relying on storage events", async () => {
  let tail = Promise.resolve();
  const request = vi.fn((_key: string, write: () => void) => {
    const operation = tail.then(write);
    tail = operation.catch(() => {});
    return operation;
  });
  Object.defineProperty(navigator, "locks", { value: { request }, configurable: true });
  const key = "shelf-life.house.v1";
  const base = seed();
  localStorage.setItem(key, JSON.stringify({ ...base, active: "adam" }));
  const first = within(render(<Kitchen tab="scan" go={vi.fn()} />).container);
  localStorage.setItem(key, JSON.stringify({ ...base, active: "leo" }));
  const second = within(render(<Kitchen tab="scan" go={vi.fn()} />).container);
  for (const [tab, food] of [
    [first, "Bread"],
    [second, "Apples"],
  ] as const) {
    fireEvent.click(tab.getByRole("button", { name: "Enter manually" }));
    fireEvent.change(tab.getByLabelText("Food name"), { target: { value: food } });
    fireEvent.click(tab.getByRole("button", { name: "Save to My Food" }));
  }
  await waitFor(() => {
    const saved = houseSchema.parse(JSON.parse(localStorage.getItem(key)!));
    expect(saved.food.slice(-2).map(({ name, owner }) => [name, owner])).toEqual([
      ["Bread", "adam"],
      ["Apples", "leo"],
    ]);
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
