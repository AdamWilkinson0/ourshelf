import { HandHeart } from "lucide-react";
import {
  askingPrice,
  type Action,
  type Food,
  type FoodRequest,
  type House,
  type Member,
} from "@/lib/household";
import { timing } from "@/lib/food-label";
import { FoodArt, Empty } from "./kitchen-ui";
interface Props {
  h: House;
  me: Member;
  today: string;
  available: Food[];
  incoming: FoodRequest[];
  run: (action: Action, message: string) => Promise<boolean>;
  saving: boolean;
}
export function SharingScreen({ h, me, today, available, incoming, run, saving }: Props) {
  const memberName = (id: string) => h.members.find((m) => m.id === id)?.name ?? "Former housemate";
  const outgoing = h.requests
    .filter((r) => r.buyer === me.id)
    .slice()
    .reverse();
  const foodName = (id: string) => h.food.find((f) => f.id === id)?.name ?? "Food";
  return (
    <section className="content-page">
      <div className="page-title">
        <HandHeart />
        <h1>Up for Grabs</h1>
      </div>
      {incoming.length > 0 && (
        <section className="section-gap">
          <h2>Incoming requests</h2>
          <div className="panel list-panel">
            {incoming.map((r) => {
              const f = h.food.find((f) => f.id === r.itemId)!;
              const p = askingPrice(f, today);
              return (
                <div key={r.id} className="request-row">
                  <div>
                    <strong>
                      {memberName(r.buyer)} wants {f.name}
                    </strong>
                    <small>
                      {p === null ? "No longer available" : p === 0 ? "Free" : r.price + " pts"}
                    </small>
                  </div>
                  <div className="action-row">
                    <button
                      className="btn secondary"
                      disabled={saving}
                      onClick={() =>
                        run({ type: "respond", id: r.id, accept: false }, "Request declined.")
                      }
                    >
                      Decline
                    </button>
                    <button
                      className="btn primary"
                      disabled={p === null || saving}
                      onClick={() =>
                        run({ type: "respond", id: r.id, accept: true }, "Food handed over.")
                      }
                    >
                      Accept
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
      <div className="section-title">
        <h2>From your housemates</h2>
        <span>{available.length} items</span>
      </div>
      <div className="grab-grid">
        {available.map((f) => {
          const price = askingPrice(f, today);
          const pending = outgoing.some((r) => r.itemId === f.id && r.status === "pending");
          return (
            <article className="panel grab-card" key={f.id}>
              <div className="section-title">
                <FoodArt name={f.name} />
                <span className={"expiry " + timing(f, today).colour}>
                  <i />
                  {timing(f, today).text}
                </span>
              </div>
              <h3>{f.name}</h3>
              <p>
                {f.quantity} · {memberName(f.owner)}’s shelf
              </p>
              <div className="grab-bottom">
                <strong>{price === 0 ? "Free" : price + " pts"}</strong>
                <button
                  className="btn primary"
                  disabled={pending || saving}
                  onClick={() =>
                    run(
                      { type: "request", id: f.id },
                      "Request sent to " + memberName(f.owner) + ".",
                    )
                  }
                >
                  {pending ? "Requested" : "Request"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {!available.length && <Empty>The sharing shelf is empty.</Empty>}
      {outgoing.length > 0 && (
        <section className="section-gap">
          <h2>Your requests</h2>
          <div className="panel list-panel">
            {outgoing.map((r) => (
              <div className="activity" key={r.id}>
                <span>
                  {foodName(r.itemId)} <small>from {memberName(r.owner)}</small>
                </span>
                <span className="tag">{r.status}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
