import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  CalendarDays,
  Camera,
  Check,
  ChevronRight,
  Coins,
  HandHeart,
  Leaf,
  MoreHorizontal,
  UserRound,
  X,
} from "lucide-react";
import { askingPrice, balance, daysLeft, type Action, type Food } from "@/lib/household";
import { Avatar, Brand, Empty, Modal } from "./kitchen-ui";
import { FoodArt } from "./food-art";
import { SharingScreen } from "./sharing-screen";
import { LeaderboardScreen } from "./leaderboard-screen";
import { ScanScreen } from "./scan-screen";
import { sharedAction, type SharedKitchen } from "@/lib/shared-houses";
import type { z } from "zod";
import { nav, type Tab } from "@/lib/navigation";
import { label, shortDate, timing } from "@/lib/food-label";
function FoodRow({
  food,
  today,
  children,
}: {
  food: Food;
  today: string;
  children?: React.ReactNode;
}) {
  const when = timing(food, today);
  return (
    <div className="food-row">
      <FoodArt name={food.name} />
      <div className="food-info">
        <strong>{food.name}</strong>
        <small>{food.quantity + " · " + label(food) + " " + shortDate(food.date)}</small>
      </div>
      <span className={"expiry " + when.colour}>
        <i />
        {when.text}
      </span>
      {children}
    </div>
  );
}
function FoodSettings({
  food,
  today,
  close,
  run,
  saving,
}: {
  food: Food;
  today: string;
  close: () => void;
  run: (a: Action, msg: string) => Promise<boolean>;
  saving: boolean;
}) {
  const [status, setStatus] = useState(food.status);
  const [price, setPrice] = useState(String(food.price));
  const visibility =
    status === "private"
      ? "Only visible to you."
      : daysLeft(food.date, today) < 0
        ? "Past its date. Hidden from Up for Grabs."
        : "Set the price to 0 to share for free.";
  return (
    <Modal
      title={food.name}
      description={
        food.quantity +
        " · " +
        label(food) +
        " " +
        shortDate(food.date) +
        " · " +
        { estimated: "Estimated date", read: "Read from label", manual: "Entered by hand" }[
          food.date_confidence
        ]
      }
      close={close}
    >
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await run(
              {
                type: "edit",
                id: food.id,
                status,
                price: status === "shareable" ? Number(price) : 0,
              },
              "Sharing settings saved.",
            )
          )
            close();
        }}
      >
        <label>
          Sharing
          <select value={status} onChange={(e) => setStatus(e.target.value as Food["status"])}>
            <option value="private">Private</option>
            <option value="shareable">Up for Grabs</option>
          </select>
        </label>
        {status === "shareable" && (
          <label>
            Asking price in points
            <input
              required
              type="number"
              min="0"
              step="1"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>
        )}
        <p className="hint">
          <Leaf size={17} />
          {visibility}
        </p>
        <button className="btn primary" disabled={saving}>
          Save settings
        </button>
        <button
          type="button"
          className="btn secondary"
          disabled={saving}
          onClick={async () => {
            if (
              await run({ type: "edit", id: food.id, status: "used", price: 0 }, "Marked as used.")
            )
              close();
          }}
        >
          <Check size={16} />
          Mark as used
        </button>
      </form>
    </Modal>
  );
}
export function Kitchen({
  tab,
  go,
  shared,
}: {
  tab: Tab;
  go: (v: Tab) => void;
  shared: {
    state: SharedKitchen;
    name: string;
    profile: ReactNode;
    act: (action: z.infer<typeof sharedAction>) => Promise<void>;
    authorizeScan: () => Promise<string>;
  };
}) {
  const { house: h, today } = shared.state;
  const writing = useRef(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [editing, setEditing] = useState<Food | null>(null);
  const [filter, setFilter] = useState("All food");
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 5500);
    return () => clearTimeout(t);
  }, [msg]);
  async function run(a: Action, notice: string) {
    if (writing.current) return false;
    writing.current = true;
    setSaving(true);
    try {
      await shared.act(sharedAction.parse(a));
      setMsg(notice);
      return true;
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Couldn’t save the change.");
      return false;
    } finally {
      setSaving(false);
      writing.current = false;
    }
  }
  function navigate(v: Tab) {
    setEditing(null);
    go(v);
    window.scrollTo(0, 0);
  }
  const me = h.members.find((m) => m.id === h.active);
  const toast = msg && (
    <div className="toast" role="status">
      {msg}
      <button aria-label="Dismiss message" onClick={() => setMsg("")}>
        <X size={15} />
      </button>
    </div>
  );
  function header() {
    return (
      <header className="site-head">
        <div className="topbar">
          <Brand />
        </div>
      </header>
    );
  }
  if (!me)
    return (
      <>
        {header()}
        <main className="loading" role="alert">
          Your house membership is unavailable.
        </main>
      </>
    );
  const mine = h.food
    .filter((f) => f.owner === me.id && f.status !== "used")
    .sort((a, b) => a.date.localeCompare(b.date));
  const available = h.food
    .filter((f) => f.owner !== me.id && askingPrice(f, today) !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
  const soon = mine.filter((f) => daysLeft(f.date, today) >= 0 && daysLeft(f.date, today) <= 2);
  const incoming = h.requests.filter((r) => r.owner === me.id && r.status === "pending");
  const visible =
    filter === "All food"
      ? mine
      : filter === "Use soon"
        ? soon
        : mine.filter((f) => askingPrice(f, today) !== null);
  return (
    <>
      {header()}
      <main className="app-main" key={me.id}>
        {tab === "food" && (
          <>
            <div className="shelf-hero">
              <div className="hero-text">
                <h1>{me.name}’s kitchen</h1>
                <p>
                  {mine.length} {mine.length === 1 ? "item" : "items"} on your shelf · {soon.length}{" "}
                  to use soon
                </p>
              </div>
              <img className="hero-art" src="/images/shelf-hero-art.webp" alt="" />
              <button className="btn hero-btn" onClick={() => navigate("scan")}>
                <Camera size={17} />
                Scan shopping
              </button>
            </div>
            {incoming.length > 0 && (
              <button className="request-alert" onClick={() => navigate("grabs")}>
                <HandHeart size={20} />
                {incoming.length} incoming {incoming.length === 1 ? "request" : "requests"}
                <ArrowRight size={17} />
              </button>
            )}
            <div className="dashboard">
              <section>
                <div className="section-title">
                  <h2>On your shelf</h2>
                  <span className="subtle">
                    <CalendarDays size={14} />
                    Expiry order
                  </span>
                </div>
                <div className="filters">
                  {["All food", "Use soon", "Sharing"].map((k) => (
                    <button
                      key={k}
                      aria-pressed={filter === k}
                      className={filter === k ? "selected" : ""}
                      onClick={() => setFilter(k)}
                    >
                      {k}
                    </button>
                  ))}
                </div>
                <div className="panel list-panel">
                  {visible.length ? (
                    visible.map((f) => (
                      <FoodRow key={f.id} food={f} today={today}>
                        <button
                          className="icon-btn"
                          aria-label={"Manage " + f.name}
                          onClick={() => setEditing(f)}
                        >
                          <MoreHorizontal size={18} />
                        </button>
                      </FoodRow>
                    ))
                  ) : (
                    <Empty art>No food here yet.</Empty>
                  )}
                </div>
              </section>
              <aside>
                <div className="section-title">
                  <h2>Around the house</h2>
                </div>
                <div className="house-card">
                  <span className="round-icon">
                    <HandHeart />
                  </span>
                  <h3>Up for grabs</h3>
                  <p>
                    {available.length} {available.length === 1 ? "item" : "items"} shared by your
                    housemates.
                  </p>
                  <button className="text-btn" onClick={() => navigate("grabs")}>
                    Browse food <ArrowRight size={16} />
                  </button>
                </div>
                <button className="mini-card" onClick={() => navigate("board")}>
                  <Coins />
                  <span>Your balance</span>
                  <strong>{balance(h, me.id)} pts</strong>
                  <ChevronRight size={16} />
                </button>
              </aside>
            </div>
          </>
        )}
        {tab === "grabs" && (
          <SharingScreen
            h={h}
            me={me}
            today={today}
            available={available}
            incoming={incoming}
            run={run}
            saving={saving}
          />
        )}
        {tab === "scan" && (
          <ScanScreen
            saving={saving}
            today={today}
            {...(import.meta.env["VITE_SCAN_API_URL"]
              ? { authorizeScan: shared.authorizeScan }
              : {})}
            onSave={async (rows) => {
              if (await run({ type: "add", rows }, rows.length + " items saved to your shelf.")) {
                setFilter("All food");
                navigate("food");
              }
            }}
          />
        )}
        {tab === "board" && (
          <LeaderboardScreen h={h} me={me} today={today} run={run} saving={saving} />
        )}
        {tab === "profile" && (
          <section className="narrow">
            <div className="page-title">
              <UserRound />
              <h1>Profile</h1>
            </div>
            <div className="panel profile-card">
              <Avatar member={me} />
              <h2>{me.name}</h2>
              <p>
                {shared.name} · {balance(h, me.id)} points
              </p>
            </div>
            {shared.profile}
          </section>
        )}
      </main>
      <nav aria-label="Kitchen" className="bottom-nav">
        <div>
          {nav.map(({ tab: v, label, icon: Icon }) => (
            <button
              key={v}
              aria-current={tab === v ? "page" : undefined}
              className={(v === "scan" ? "nav-scan " : "") + (tab === v ? "active" : "")}
              onClick={() => navigate(v)}
            >
              <span>
                <Icon size={21} />
              </span>
              {label}
            </button>
          ))}
        </div>
      </nav>
      {editing && (
        <FoodSettings
          food={editing}
          today={today}
          close={() => setEditing(null)}
          run={run}
          saving={saving}
        />
      )}
      {toast}
    </>
  );
}
