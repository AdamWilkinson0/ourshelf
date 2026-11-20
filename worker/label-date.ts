import { dateSchema } from "../src/lib/household";

const months = "JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC".split(" ");

const labelText = /^(?:USE\s+BY|BEST\s+BEFORE(?:\s+END)?)\s*[:-]?\s*/i;

export function printedDate(raw: string): string | null {
  const value = raw.trim().replace(labelText, "").toUpperCase();
  const numeric = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(value);
  const named = /^(\d{1,2})\s+([A-Z]{3})\s+(\d{2}|\d{4})$/.exec(value);
  const parts = numeric ?? named;
  const [, day, month, year] = parts ?? [];
  if (!day || !month || !year) return null;
  const monthNumber = numeric ? Number(month) : months.indexOf(month) + 1;
  const iso = [
    year.length === 2 ? "20" + year : year,
    String(monthNumber).padStart(2, "0"),
    day.padStart(2, "0"),
  ].join("-");
  const parsed = dateSchema.safeParse(iso);
  return parsed.success ? parsed.data : null;
}
