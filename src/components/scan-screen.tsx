import { useState } from "react";
import { Camera, ImagePlus, ListPlus, ScanLine, Trash2, Plus, ShoppingBasket } from "lucide-react";
import { foodDraft, localDate, sampleHaul, type Draft } from "@/lib/household";
import { scan } from "@/lib/scanner";
import { PhotoInput } from "./kitchen-ui";
type Row = Draft & { key: string };
function rows(items: Draft[]): Row[] {
  return items.map((item) => ({ ...item, key: crypto.randomUUID() }));
}
const newItem = (): Draft => ({
  name: "",
  quantity: "1 pack",
  date: localDate(),
  date_confidence: "manual",
  date_type: null,
});
export function ScanScreen({ onSave }: { onSave: (items: Draft[]) => void }) {
  const [draft, setDraft] = useState<Row[]>([]);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [sample, setSample] = useState(false);
  function change(key: string, patch: Partial<Draft>) {
    setDraft((old) => old.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  async function haul(file: File) {
    setNote("");
    setBusy("haul");
    setSample(false);
    try {
      const result = await scan(file, "haul");
      setDraft(rows(result.items));
      if (!result.items.length)
        setNote("No groceries found. Try another photo or add an item manually.");
    } catch {
      setNote("Live scan unavailable. Try the sample haul or enter your food manually.");
    } finally {
      setBusy("");
    }
  }
  async function closeup(file: File, key: string) {
    setNote("");
    setBusy(key);
    try {
      const result = await scan(file, "date");
      if (result.date) {
        change(key, { date: result.date, date_type: result.date_type, date_confidence: "read" });
        setNote("Label read: " + result.raw_text);
      } else setNote("Couldn’t read that label. Try a closer photo or enter the printed date.");
    } catch {
      setNote("Couldn’t scan that label. Your date is unchanged. Retry or enter the printed date.");
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="narrow">
      <div className="page-title">
        <ScanLine />
        <h1>Scan shopping</h1>
      </div>
      {!draft.length ? (
        <div className="scan-start panel">
          <div className="scan-frame">
            <ShoppingBasket size={64} strokeWidth={1.3} />
          </div>
          <h2>Add your haul</h2>
          <p>Start with one photo of your shopping. You can check each label before saving.</p>
          <div className="action-row">
            <PhotoInput label="Take a photo" camera disabled={!!busy} onFile={haul}>
              <Camera size={17} />
            </PhotoInput>
            <PhotoInput label="Upload photo" disabled={!!busy} onFile={haul}>
              <ImagePlus size={17} />
            </PhotoInput>
          </div>
          <div className="scan-alternatives">
            <button
              disabled={!!busy}
              onClick={() => {
                setDraft(rows(sampleHaul(localDate())));
                setSample(true);
                setNote("");
              }}
            >
              Try sample haul
            </button>
            <button
              disabled={!!busy}
              onClick={() => {
                setDraft(rows([newItem()]));
                setNote("");
                setSample(false);
              }}
            >
              <ListPlus size={17} /> Enter manually
            </button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy && draft.every((r) => foodDraft.safeParse(r).success)) onSave(draft);
            else setNote("Check each name, quantity and date.");
          }}
        >
          <div className="section-title">
            <h2>{sample ? "Review sample haul" : "Review your haul"}</h2>
            <span>{draft.length} items</span>
          </div>
          <div className="stack">
            {draft.map((r, i) => (
              <fieldset key={r.key} disabled={!!busy} className="panel review-card">
                <legend className="sr-only">Item {i + 1}</legend>
                <div className="section-title">
                  <span className="tag">
                    {r.date_confidence === "read"
                      ? "Read from label"
                      : r.date_confidence === "estimated"
                        ? "Estimated date"
                        : "Entered by hand"}
                  </span>
                  <button
                    type="button"
                    aria-label={"Remove item " + (i + 1)}
                    className="icon-btn"
                    onClick={() => setDraft((old) => old.filter((a) => a.key !== r.key))}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
                <div className="form-grid">
                  <label>
                    Food name
                    <input
                      required
                      maxLength={120}
                      value={r.name}
                      onChange={(e) => change(r.key, { name: e.target.value })}
                    />
                  </label>
                  <label>
                    Quantity
                    <input
                      required
                      maxLength={80}
                      value={r.quantity}
                      onChange={(e) => change(r.key, { quantity: e.target.value })}
                    />
                  </label>
                  <label>
                    Date
                    <input
                      type="date"
                      required
                      value={r.date}
                      onChange={(e) =>
                        change(r.key, { date: e.target.value, date_confidence: "manual" })
                      }
                    />
                  </label>
                  <label>
                    Label type
                    <select
                      value={r.date_type ?? ""}
                      onChange={(e) =>
                        change(r.key, { date_type: (e.target.value || null) as Draft["date_type"] })
                      }
                    >
                      <option value="">Unspecified</option>
                      <option value="use_by">Use by</option>
                      <option value="best_before">Best before</option>
                    </select>
                  </label>
                </div>
                <PhotoInput
                  label={busy === r.key ? "Reading label…" : "Snap date"}
                  camera
                  disabled={!!busy}
                  onFile={(f) => closeup(f, r.key)}
                >
                  <Camera size={16} />
                </PhotoInput>
              </fieldset>
            ))}
          </div>
          <div className="action-row form-footer">
            <button
              disabled={!!busy}
              type="button"
              className="btn secondary"
              onClick={() => setDraft((old) => [...old, ...rows([newItem()])])}
            >
              <Plus size={16} />
              Add item
            </button>
            <button disabled={!!busy} className="btn primary">
              Save to My Food
            </button>
          </div>
        </form>
      )}
      <p role="status" className={note || busy ? "notice" : "sr-only"}>
        {busy ? "Reading photo…" : note}
      </p>
    </section>
  );
}
