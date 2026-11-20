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
  ListChecks,
  MoreHorizontal,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import {
  askingPrice,
  balance,
  chores,
  daysLeft,
  houseSchema,
  localDate,
  seed,
  shifted,
  update,
  type Action,
  type Food,
  type House,
} from "@/lib/household";
import { Avatar, Brand, Empty, FoodArt, HomeLabel, Modal } from "./kitchen-ui";
import { SharingScreen } from "./sharing-screen";
import { LeaderboardScreen } from "./leaderboard-screen";
import { ScanScreen } from "./scan-screen";
import { sharedAction, type SharedKitchen } from "@/lib/shared-houses";
import type { z } from "zod";
import { nav, type Tab } from "@/lib/navigation";
const key = "shelf-life.house.v1";
function loadHouse() {
  const raw = localStorage.getItem(key);
  return raw ? houseSchema.parse(JSON.parse(raw)) : seed();
}
import { label, shortDate, timing } from "@/lib/food-label";
function ProfileList({ h, select }: { h: House; select: (id: string) => void }) {
  return (
    <div className="profile-list">
      {h.members.map((m) => (
        <button key={m.id} className="profile-choice" onClick={() => select(m.id)}>
          <Avatar member={m} />
          <strong>{m.name}</strong>
          <span className="member-balance">{balance(h, m.id)} pts</span>
          <ChevronRight size={18} />
        </button>
      ))}
    </div>
  );
}
function Welcome({ h, select }: { h: House; select: (id: string) => void }) {
  return (
    <main className="welcome">
      <div className="welcome-img">
        <picture>
          <source media="(max-width: 760px)" srcSet="/images/kitchen-sky-wide.webp" />
          <img
            src="/images/kitchen-sky.webp"
            alt="Hand-drawn kitchen in the sky: an open fridge full of food floating in clouds, a milk-carton rocket and a grocery bag on a parachute"
          />
        </picture>
      </div>
      <section className="welcome-body">
        <div className="mini-title">
          <span className="live-dot" />
          Shared kitchen
        </div>
        <h1>
          Who’s in the
          <br />
          <em>kitchen?</em>
        </h1>
        <p>Choose your profile to open your shelf.</p>
        <ProfileList h={h} select={select} />
      </section>
    </main>
  );
}
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
  const freeDay = shifted(food.date, -2);
  const visibility =
    daysLeft(food.date, today) < 0
      ? "Past its date. Hidden from the sharing feed."
      : freeDay <= today
        ? "In its free-sharing window now."
        : "Free for the house from " + shortDate(freeDay) + ".";
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
          Sharing before the free window
          <select value={status} onChange={(e) => setStatus(e.target.value as Food["status"])}>
            <option value="private">Private</option>
            <option value="shareable">Share with housemates</option>
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
  leaveDemo,
}: {
  tab: Tab;
  go: (v: Tab) => void;
  shared?: {
    state: SharedKitchen;
    name: string;
    profile: ReactNode;
    act: (action: z.infer<typeof sharedAction>) => Promise<void>;
    authorizeScan: () => Promise<string>;
  };
  leaveDemo?: () => void;
}) {
  const [demoHouse, setHouse] = useState<House | null>(null);
  const latest = useRef<House | null>(null);
  const sessionOnly = useRef(false);
  const [demoToday, setToday] = useState("");
  const h = shared?.state.house ?? demoHouse;
  const today = shared?.state.today ?? demoToday;
  const houseName = shared?.name ?? "Your house";
  const isShared = Boolean(shared);
  const writing = useRef(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [modal, setModal] = useState<"chores" | "switch" | "reset" | null>(null);
  const [editing, setEditing] = useState<Food | null>(null);
  const [filter, setFilter] = useState("All food");
  useEffect(() => {
    if (isShared) return;
    function refresh(preserveProfile = false) {
      try {
        const saved = loadHouse();
        latest.current = preserveProfile
          ? { ...saved, active: latest.current?.active ?? null }
          : saved;
      } catch {
        latest.current = seed();
        setMsg("Saved kitchen unavailable. Using demo data.");
      }
      setHouse(latest.current);
      setToday(localDate());
    }
    const sync = (e: StorageEvent) => {
      if (!sessionOnly.current && (e.key === key || e.key === null)) refresh(true);
    };
    refresh();
    window.addEventListener("storage", sync);
    const tick = () => setToday(localDate());
    const interval = setInterval(tick, 30000);
    window.addEventListener("focus", tick);
    return () => {
      window.removeEventListener("storage", sync);
      clearInterval(interval);
      window.removeEventListener("focus", tick);
    };
  }, [isShared]);
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
      if (shared) {
        await shared.act(sharedAction.parse(a));
        setMsg(notice);
        return true;
      }
      const apply = (persistent: boolean) => {
        const current = latest.current;
        if (!current) return false;
        let base = current;
        if (persistent) {
          try {
            base = { ...loadHouse(), active: current.active };
          } catch {
            // Continue from this tab's last usable state.
          }
        }
        const next = update(base, a);
        if (persistent) {
          try {
            localStorage.setItem(key, JSON.stringify(next));
          } catch {
            sessionOnly.current = true;
          }
        }
        latest.current = next;
        setHouse(next);
        setToday(localDate());
        setMsg(
          persistent && !sessionOnly.current ? notice : "Changes are saved for this tab only.",
        );
        return true;
      };
      if (navigator.locks && !sessionOnly.current)
        return await navigator.locks.request(key, () => apply(!sessionOnly.current));
      sessionOnly.current = true;
      return apply(false);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Couldn’t save the change.");
      return false;
    } finally {
      setSaving(false);
      writing.current = false;
    }
  }
  function navigate(v: Tab) {
    setModal(null);
    setEditing(null);
    go(v);
    window.scrollTo(0, 0);
  }
  async function choose(id: string) {
    if (await run({ type: "switch", id }, "")) {
      setFilter("All food");
      navigate("food");
    }
  }
  const me = h?.members.find((m) => m.id === h.active);
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
          <HomeLabel name="Your house" />
        </div>
      </header>
    );
  }
  if (!h)
    return (
      <>
        {header()}
        <main className="loading" role="status">
          Opening the kitchen…
        </main>
      </>
    );
  if (!me)
    return (
      <>
        {header()}
        <Welcome h={h} select={choose} />
        {leaveDemo && (
          <div className="narrow demo-exit">
            <button className="btn secondary" onClick={leaveDemo}>
              Back to shared houses
            </button>
          </div>
        )}
        {toast}
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
  const openChores = () => setModal("chores");
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
            {...(shared && import.meta.env["VITE_SCAN_API_URL"]
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
          <LeaderboardScreen h={h} me={me} today={today} openChores={openChores} />
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
                {houseName} · {balance(h, me.id)} points
              </p>
              {!shared && (
                <button className="btn primary" onClick={() => setModal("switch")}>
                  <UsersRound size={18} />
                  Switch housemate
                </button>
              )}
            </div>
            {shared ? (
              shared.profile
            ) : (
              <section className="section-gap">
                <h2>Household demo</h2>
                <p>
                  Food and points are saved in this browser. Reset to restore the three original
                  shelves.
                </p>
                <button className="btn secondary" onClick={() => setModal("reset")}>
                  Reset demo data
                </button>
                {leaveDemo && (
                  <button className="btn secondary house-create" onClick={leaveDemo}>
                    Back to shared houses
                  </button>
                )}
              </section>
            )}
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
      {modal === "switch" && (
        <Modal
          title="Who’s in the kitchen?"
          description="Choose a housemate to open their shelf."
          close={() => setModal(null)}
        >
          <ProfileList h={h} select={choose} />
        </Modal>
      )}
      {modal === "chores" && (
        <Modal
          title="Log a chore"
          description={"What did you finish, " + me.name + "?"}
          close={() => setModal(null)}
        >
          <div className="profile-list">
            {chores.map((c) => (
              <button
                className="profile-choice"
                key={c.name}
                disabled={saving}
                onClick={async () => {
                  if (
                    await run(
                      { type: "chore", name: c.name },
                      "Chore logged. +" + c.points + " points.",
                    )
                  )
                    setModal(null);
                }}
              >
                <ListChecks size={19} />
                <strong>{c.name}</strong>
                <span className="member-balance">+{c.points} pts</span>
              </button>
            ))}
          </div>
        </Modal>
      )}
      {modal === "reset" && (
        <Modal
          title="Reset this kitchen?"
          description="This clears food changes, requests and chore history for all three profiles on this browser."
          close={() => setModal(null)}
        >
          <button
            className="btn primary"
            onClick={() => {
              run({ type: "reset" }, "Demo restored.");
              navigate("food");
            }}
          >
            Reset demo data
          </button>
          <button className="btn secondary" onClick={() => setModal(null)}>
            Keep my kitchen
          </button>
        </Modal>
      )}
      {toast}
    </>
  );
}
