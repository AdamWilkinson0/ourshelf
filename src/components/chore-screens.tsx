import { useState, type FormEvent } from "react";
import { ArrowLeft, ListChecks, Pencil, Plus } from "lucide-react";
import {
  choresFor,
  type Action,
  type ChoreTemplate,
  type House,
  type Member,
} from "@/lib/household";
import { Avatar, Empty, Modal } from "./kitchen-ui";

type ChoreActions = {
  run: (action: Action, notice: string) => Promise<boolean>;
  saving: boolean;
};

export function ChorePicker({
  h,
  me,
  managing,
  close,
  toggle,
  add,
  edit,
  run,
  saving,
}: ChoreActions & {
  h: House;
  me: Member;
  managing: boolean;
  close: () => void;
  toggle: () => void;
  add: () => void;
  edit: (id: string) => void;
}) {
  const choices = choresFor(h);
  return (
    <Modal
      title={managing ? "Edit chores" : "Log a chore"}
      description={
        managing ? "Manage the chore list for your house." : `What did you finish, ${me.name}?`
      }
      close={close}
      titleAction={
        <button className="btn primary" disabled={saving} onClick={toggle}>
          {!managing && <Pencil size={15} />}
          {managing ? "Done" : "Edit"}
        </button>
      }
    >
      {choices.length ? (
        <div className="profile-list">
          {choices.map((chore) =>
            managing ? (
              <div className="profile-choice chore-option" key={chore.id}>
                <div>
                  <strong>{chore.name}</strong>
                  <small>{chore.points} pts</small>
                </div>
                <button
                  className="btn secondary"
                  aria-label={`Edit ${chore.name}`}
                  onClick={() => edit(chore.id)}
                >
                  Edit
                </button>
              </div>
            ) : (
              <button
                className="profile-choice chore-option"
                key={chore.id}
                disabled={saving}
                onClick={async () => {
                  if (await run({ type: "logChore", id: chore.id }, "Chore logged.")) close();
                }}
              >
                <ListChecks size={19} />
                <strong>{chore.name}</strong>
                <span className="member-balance">+{chore.points} pts</span>
              </button>
            ),
          )}
        </div>
      ) : (
        <Empty>There are no chores on this house’s list yet.</Empty>
      )}
      {managing && (
        <button className="btn primary" onClick={add}>
          <Plus size={17} /> Add a chore
        </button>
      )}
    </Modal>
  );
}

export function ChoreEditor({
  id,
  chore,
  back,
  run,
  saving,
}: ChoreActions & {
  id: string | undefined;
  chore: ChoreTemplate | undefined;
  back: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const name = String(fields.get("name") ?? "");
    const points = Number(fields.get("points"));
    if (await run({ type: "saveChore", id, name, points }, id ? "Chore updated." : "Chore added."))
      back();
  }

  return (
    <section className="narrow chore-screen">
      <button type="button" className="text-btn" onClick={back}>
        <ArrowLeft size={17} /> Back to chores
      </button>
      <div className="page-title">
        <ListChecks />
        <h1>{id ? "Edit chore" : "Add a chore"}</h1>
      </div>
      {id && !chore ? (
        <p className="panel empty">This chore is no longer on the list.</p>
      ) : (
        <form className="panel review-card stack chore-form" onSubmit={save}>
          <label>
            Chore name
            <input
              name="name"
              defaultValue={chore?.name}
              maxLength={60}
              required
              disabled={saving || confirming}
            />
          </label>
          <label>
            Points
            <input
              name="points"
              type="number"
              min={0}
              max={1000000}
              step={1}
              required
              defaultValue={chore?.points}
              disabled={saving || confirming}
            />
          </label>
          {confirming && chore ? (
            <>
              <p>Remove this chore from the house list? Past logs and earned points will stay.</p>
              <div className="action-row">
                <button
                  type="button"
                  className="btn secondary"
                  disabled={saving}
                  onClick={() => setConfirming(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn danger"
                  disabled={saving}
                  onClick={async () => {
                    if (
                      await run(
                        { type: "deleteChore", id: chore.id },
                        "Chore removed from the list.",
                      )
                    )
                      back();
                  }}
                >
                  Remove from list
                </button>
              </div>
            </>
          ) : (
            <div className="action-row form-footer">
              <button className="btn primary" disabled={saving}>
                {chore ? "Save changes" : "Add chore"}
              </button>
              {chore && (
                <button
                  type="button"
                  className="btn danger"
                  disabled={saving}
                  onClick={() => setConfirming(true)}
                >
                  Delete chore
                </button>
              )}
            </div>
          )}
        </form>
      )}
    </section>
  );
}

const choreDate = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "Europe/London",
});

export function MemberChoreHistory({
  h,
  member,
  ownProfile,
  back,
  run,
  saving,
}: ChoreActions & {
  h: House;
  member: Member;
  ownProfile: boolean;
  back: () => void;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const logs = h.ledger
    .filter((entry) => entry.kind === "chore" && entry.to === member.id)
    .reverse();
  return (
    <section className="narrow chore-screen">
      <button type="button" className="text-btn" onClick={back}>
        <ArrowLeft size={17} /> Back to leaderboard
      </button>
      <div className="page-title">
        <Avatar member={member} />
        <h1>{member.name}</h1>
      </div>
      <h2>Chore history</h2>
      <div className="panel list-panel chore-history">
        {logs.length ? (
          logs.map((entry) => (
            <article key={entry.id}>
              <div className="activity chore-log">
                <div>
                  <ListChecks />
                  <span>
                    <strong>{entry.label}</strong>
                    <small>
                      <time dateTime={entry.time}>{choreDate.format(new Date(entry.time))}</time>
                    </small>
                  </span>
                </div>
                <b>+{entry.amount} pts</b>
                {ownProfile && (
                  <button
                    className="btn secondary"
                    aria-label={`Delete logged chore ${entry.label}`}
                    disabled={saving || confirming === entry.id}
                    onClick={() => setConfirming(entry.id)}
                  >
                    Delete
                  </button>
                )}
              </div>
              {confirming === entry.id && (
                <div className="chore-log-confirmation stack">
                  <p>Delete this log and deduct its {entry.amount} points from your balance?</p>
                  <div className="action-row">
                    <button
                      className="btn secondary"
                      disabled={saving}
                      onClick={() => setConfirming(null)}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn danger"
                      disabled={saving}
                      onClick={async () => {
                        if (
                          await run({ type: "removeChoreLog", id: entry.id }, "Chore log deleted.")
                        )
                          setConfirming(null);
                      }}
                    >
                      Delete log
                    </button>
                  </div>
                </div>
              )}
            </article>
          ))
        ) : (
          <Empty>No chores logged yet.</Empty>
        )}
      </div>
    </section>
  );
}
