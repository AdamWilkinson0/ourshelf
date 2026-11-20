import { useState } from "react";
import { Check, House, Link2, Plus, Share2 } from "lucide-react";
import { houseInviteUrl } from "@/lib/house-auth";
import { houseName, type HouseSummary } from "@/lib/shared-houses";
import { Empty, Modal } from "./kitchen-ui";

interface Props {
  houses: HouseSummary[];
  active?: string;
  select: (id: string) => void;
  create: (name: string) => Promise<void>;
  invite: (id: string) => Promise<{ token: string; expiresAt: string }>;
  revoke: (id: string) => Promise<void>;
}

export function MyHouses({ houses, active, select, create, invite, revoke }: Props) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [inviting, setInviting] = useState<HouseSummary | null>(null);
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  async function run(operation: () => Promise<void>) {
    setStatus("");
    setBusy(true);
    try {
      await operation();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="section-gap">
      <div className="section-title">
        <h2>My Houses</h2>
      </div>
      {houses.length ? (
        <ul className="panel list-panel house-list">
          {houses.map((house) => (
            <li key={house.id}>
              <button
                type="button"
                className="house-pick"
                aria-pressed={active === house.id}
                onClick={() => select(house.id)}
              >
                <House size={21} aria-hidden="true" />
                <span>
                  <strong>{house.name}</strong>
                  <small>{house.role === "owner" ? "Owner" : "Member"}</small>
                </span>
                {active === house.id && (
                  <span className="active-house">
                    <Check size={15} />
                    Active
                  </span>
                )}
              </button>
              {house.role === "owner" && (
                <button
                  type="button"
                  className="btn secondary"
                  aria-label={"Invite people to " + house.name}
                  onClick={() => {
                    setInviting(house);
                    setLink(null);
                    setStatus("");
                  }}
                >
                  <Link2 size={16} /> Invite people
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <Empty>Create a house or open an invitation from a housemate to get started.</Empty>
      )}
      <button
        className="btn primary house-create"
        onClick={() => {
          setName("");
          setStatus("");
          setCreating(true);
        }}
      >
        <Plus size={17} /> Create house
      </button>
      {creating && (
        <Modal
          title="Create a house"
          description="Choose a name your housemates will recognise."
          close={() => {
            if (!busy) setCreating(false);
          }}
        >
          <form
            className="stack"
            onSubmit={(event) => {
              event.preventDefault();
              const result = houseName.safeParse(name);
              if (!result.success) {
                setStatus("Enter a house name between 1 and 60 characters.");
                return;
              }
              void run(async () => {
                await create(result.data);
                setCreating(false);
              });
            }}
          >
            <label>
              House name
              <input
                required
                maxLength={60}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Oak Street"
              />
            </label>
            <button className="btn primary" disabled={busy}>
              {busy ? "Creating…" : "Create house"}
            </button>
            {status && (
              <p role="status" className="notice">
                {status}
              </p>
            )}
          </form>
        </Modal>
      )}
      {inviting && (
        <Modal
          title={"Invite people to " + inviting.name}
          description="Anyone with the link can join after signing in. Links expire after seven days."
          close={() => {
            if (!busy) setInviting(null);
          }}
        >
          {link && (
            <div className="stack">
              <label>
                Invitation link
                <input
                  type="url"
                  readOnly
                  value={link.url}
                  onFocus={(event) => event.target.select()}
                />
              </label>
              <small>Expires {new Date(link.expiresAt).toLocaleString("en-GB")}.</small>
              <div className="action-row">
                <button
                  className="btn primary"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      try {
                        await navigator.clipboard.writeText(link.url);
                        setStatus("Invitation link copied.");
                      } catch {
                        setStatus("Select the link above and copy it.");
                      }
                    })
                  }
                >
                  Copy link
                </button>
                {typeof navigator.share === "function" && (
                  <button
                    className="btn secondary"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        try {
                          await navigator.share({
                            title: "Join " + inviting.name + " on Shelf Life",
                            url: link.url,
                          });
                        } catch (error) {
                          if (!(error instanceof DOMException && error.name === "AbortError"))
                            throw error;
                        }
                      })
                    }
                  >
                    <Share2 size={16} /> Share link
                  </button>
                )}
              </div>
            </div>
          )}
          <div className="stack">
            <p>Generating a link replaces the previous link for this house.</p>
            <button
              className="btn secondary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const next = await invite(inviting.id);
                  setLink({ url: houseInviteUrl(next.token), expiresAt: next.expiresAt });
                })
              }
            >
              {link ? "Generate replacement link" : "Generate invite link"}
            </button>
            <button
              className="btn secondary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await revoke(inviting.id);
                  setLink(null);
                  setStatus("Invitation revoked.");
                })
              }
            >
              Revoke invitation
            </button>
          </div>
          {status && (
            <p role="status" className="notice">
              {status}
            </p>
          )}
        </Modal>
      )}
    </section>
  );
}
