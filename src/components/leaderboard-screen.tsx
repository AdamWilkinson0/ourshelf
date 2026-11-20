import { useState } from "react";
import { ChevronRight, HandHeart, ListChecks, Trophy } from "lucide-react";
import { balance, choresFor, type Action, type House, type Member } from "@/lib/household";
import { ChoreEditor, ChorePicker, MemberChoreHistory } from "./chore-screens";
import { Avatar, Empty } from "./kitchen-ui";

type View = { type: "log" | "manage" | "add" } | { type: "edit" | "profile"; id: string } | null;

export function LeaderboardScreen({
  h,
  me,
  today,
  run,
  saving,
}: {
  h: House;
  me: Member;
  today: string;
  run: (action: Action, notice: string) => Promise<boolean>;
  saving: boolean;
}) {
  const [view, setView] = useState<View>(null);
  function show(next: View) {
    setView(next);
    window.scrollTo(0, 0);
  }
  if (view?.type === "profile") {
    const member = h.members.find((m) => m.id === view.id);
    if (member)
      return (
        <MemberChoreHistory
          key={member.id}
          h={h}
          member={member}
          ownProfile={member.id === me.id}
          back={() => show(null)}
          run={run}
          saving={saving}
        />
      );
  }
  if (view?.type === "add" || view?.type === "edit") {
    const id = view.type === "edit" ? view.id : undefined;
    return (
      <ChoreEditor
        id={id}
        chore={choresFor(h).find((c) => c.id === id)}
        back={() => show({ type: "manage" })}
        run={run}
        saving={saving}
      />
    );
  }
  const memberName = (id: string) => h.members.find((m) => m.id === id)?.name ?? "Former housemate";
  const week = new Date(today + "T00:00:00");
  week.setDate(week.getDate() - ((week.getDay() + 6) % 7));
  const weekly = (m: Member) => balance(h, m.id, false, week.toISOString());
  const weeklyRank = [...h.members].sort((a, b) => weekly(b) - weekly(a));
  const showBadges = weekly(weeklyRank[0]!) !== weekly(weeklyRank[weeklyRank.length - 1]!);
  const ranks = [...h.members].sort(
    (a, b) => balance(h, b.id) - balance(h, a.id) || a.name.localeCompare(b.name),
  );
  return (
    <section className="content-page">
      <div className="page-title">
        <Trophy />
        <h1>Leaderboard</h1>
      </div>
      <div className="points-banner">
        <div>
          <span>Your house points</span>
          <h2>
            {balance(h, me.id)} <small>pts</small>
          </h2>
        </div>
        <button className="btn secondary" onClick={() => setView({ type: "log" })}>
          <ListChecks size={19} />
          Log chore
        </button>
      </div>
      <h2>House ranking</h2>
      <div className="panel list-panel">
        {ranks.map((m, i) => (
          <button
            className="rank-row"
            key={m.id}
            aria-label={`View ${m.name}’s chore history`}
            onClick={() => show({ type: "profile", id: m.id })}
          >
            <span className="rank-number">{i + 1}</span>
            <Avatar member={m} />
            <span>
              <strong>{m.name}</strong>
              {showBadges &&
                (weekly(m) === weekly(weeklyRank[0]!) ||
                  weekly(m) === weekly(weeklyRank[weeklyRank.length - 1]!)) && (
                  <small>
                    {weekly(m) === weekly(weeklyRank[0]!) ? "Weekly MVP" : "Weekly Freeloader"}
                  </small>
                )}
            </span>
            <b>{balance(h, m.id)} pts</b>
            <ChevronRight size={16} />
          </button>
        ))}
      </div>
      <section className="section-gap">
        <h2>House activity</h2>
        <div className="panel list-panel">
          {h.ledger.length ? (
            [...h.ledger].reverse().map((e) => (
              <div className="activity" key={e.id}>
                <div>
                  {e.kind === "chore" ? <ListChecks /> : <HandHeart />}
                  <span>
                    <strong>{e.label}</strong>
                    <small>
                      {e.from
                        ? memberName(e.to) + " shared with " + memberName(e.from)
                        : memberName(e.to) + " completed a chore"}
                    </small>
                  </span>
                </div>
                <b>
                  {e.amount === 0 ? "Free" : (e.kind === "chore" ? "+" : "") + e.amount + " pts"}
                </b>
              </div>
            ))
          ) : (
            <Empty>Log your first chore or share food to start the activity feed.</Empty>
          )}
        </div>
      </section>
      {(view?.type === "log" || view?.type === "manage") && (
        <ChorePicker
          h={h}
          me={me}
          managing={view.type === "manage"}
          close={() => setView(null)}
          toggle={() => setView({ type: view.type === "log" ? "manage" : "log" })}
          add={() => show({ type: "add" })}
          edit={(id) => show({ type: "edit", id })}
          run={run}
          saving={saving}
        />
      )}
    </section>
  );
}
