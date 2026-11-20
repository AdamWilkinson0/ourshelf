import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { Mail, UserRound } from "lucide-react";
import {
  clearPendingInvite,
  houseAuth,
  readPendingInvite,
  sharedHousesConfigured,
} from "@/lib/house-auth";
import { callHouse } from "@/lib/houses-api";
import { displayName, type SharedKitchen } from "@/lib/shared-houses";
import { type Tab } from "@/lib/navigation";
import { Brand } from "./kitchen-ui";
import { Kitchen } from "./kitchen";
import { MyHouses } from "./my-houses";

function message(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}

function AccountPanel({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <>
      <header className="site-head">
        <div className="topbar">
          <Brand />
        </div>
      </header>
      <main className="app-main">
        <section className="narrow">
          <div className="page-title">
            <UserRound />
            <h1>{title}</h1>
          </div>
          {children}
        </section>
      </main>
    </>
  );
}

function SignIn({
  pending,
  startDemo,
  authError,
}: {
  pending: boolean;
  startDemo: () => void;
  authError: string;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const { error } = await houseAuth().auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: new URL("/", location.origin).href, shouldCreateUser: true },
      });
      if (error) throw error;
      setNotice("Check your email and open the sign-in link in this browser.");
    } catch (error) {
      setNotice(message(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <AccountPanel title={pending ? "Join a house" : "Your shared kitchen"}>
      <div className="panel review-card stack">
        {sharedHousesConfigured ? (
          <>
            <p>
              {pending
                ? "Sign in with an email link to accept your invitation."
                : "Sign in to create a house or open an invitation from a housemate."}
            </p>
            <form className="account-form stack" onSubmit={(event) => void submit(event)}>
              <label>
                Email address
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <button className="btn primary" disabled={busy}>
                <Mail size={17} />
                {busy ? "Sending…" : "Email me a sign-in link"}
              </button>
            </form>
          </>
        ) : (
          <p>Shared houses are awaiting setup. You can still explore Clifton House.</p>
        )}
        {(notice || authError) && (
          <p className="notice" role="status">
            {notice || authError}
          </p>
        )}
        <button className="btn secondary" onClick={startDemo}>
          Try demo
        </button>
      </div>
    </AccountPanel>
  );
}

export function HouseholdHome({
  tab,
  go,
  demo,
  setDemo,
}: {
  tab: Tab;
  go: (tab: Tab) => void;
  demo: boolean;
  setDemo: (demo: boolean) => void;
}) {
  const [identity, setIdentity] = useState<Session | null | undefined>(undefined);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();
  const lastUser = useRef<string | null>(null);

  useEffect(() => {
    const captureInvite = () => {
      try {
        setPending(readPendingInvite());
      } catch {
        setError(
          "Browser storage is unavailable. Open the invitation in a regular browser window.",
        );
      }
    };
    captureInvite();
    window.addEventListener("hashchange", captureInvite);
    if (!sharedHousesConfigured) {
      setIdentity(null);
      return () => window.removeEventListener("hashchange", captureInvite);
    }
    const params = new URLSearchParams(location.search);
    if (params.has("error") || params.has("error_code") || params.has("error_description")) {
      setError("This sign-in link expired or was already used. Request a new one.");
    }
    const auth = houseAuth().auth;
    const { data } = auth.onAuthStateChange((event, session) => {
      if (lastUser.current && lastUser.current !== session?.user.id) {
        queryClient.removeQueries({ queryKey: ["shared-houses", lastUser.current] });
      }
      lastUser.current = session?.user.id ?? null;
      setIdentity(session);
      if (event === "SIGNED_IN") setError("");
    });
    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener("hashchange", captureInvite);
    };
  }, [queryClient]);

  function dismissInvite() {
    clearPendingInvite();
    setPending(null);
  }
  if (demo && !pending) return <Kitchen tab={tab} go={go} leaveDemo={() => setDemo(false)} />;
  if (identity === undefined)
    return (
      <AccountPanel title="Shelf Life">
        <p role="status">Opening your kitchen…</p>
      </AccountPanel>
    );
  if (!identity) {
    return (
      <SignIn
        pending={Boolean(pending)}
        authError={error}
        startDemo={() => {
          if (pending) dismissInvite();
          setDemo(true);
        }}
      />
    );
  }
  return (
    <SharedHome
      key={identity.user.id}
      session={identity}
      pending={pending}
      dismissInvite={dismissInvite}
      go={go}
      tab={tab}
      startDemo={() => setDemo(true)}
    />
  );
}

function SharedHome({
  session,
  pending,
  dismissInvite,
  tab,
  go,
  startDemo,
}: {
  session: Session;
  pending: string | null;
  dismissInvite: () => void;
  tab: Tab;
  go: (tab: Tab) => void;
  startDemo: () => void;
}) {
  const token = session.access_token;
  const queryClient = useQueryClient();
  const key = ["shared-houses", session.user.id];
  const listKey = [...key, "list"];
  const [selected, setSelected] = useState("");
  const [name, setName] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const list = useQuery({
    queryKey: listKey,
    queryFn: () => callHouse({ type: "list" }, token),
    retry: false,
  });
  const houses = list.data?.houses ?? [];
  const active = houses.find((house) => house.id === selected) ?? houses[0];
  const kitchenKey = [...key, "house", active?.id];
  const kitchen = useQuery({
    queryKey: kitchenKey,
    queryFn: async () => {
      const next = await callHouse({ type: "read", id: active!.id }, token);
      const current = queryClient.getQueryData<SharedKitchen>(kitchenKey);
      return current && current.revision > next.revision ? current : next;
    },
    enabled: Boolean(active && !pending),
    retry: false,
    refetchInterval: 10_000,
    refetchOnWindowFocus: "always",
  });
  const invitation = useQuery({
    queryKey: [...key, "invitation", pending],
    queryFn: () => callHouse({ type: "inspect", token: pending! }, token),
    enabled: Boolean(pending && pending !== "invalid" && list.data?.name),
    retry: false,
  });

  function select(id: string) {
    if (id !== active?.id) {
      setSelected(id);
      go("food");
    }
  }

  async function run(operation: () => Promise<void>) {
    setNotice("");
    setBusy(true);
    try {
      await operation();
    } catch (error) {
      setNotice(message(error));
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await run(async () => {
      const { error } = await houseAuth().auth.signOut();
      if (error) throw error;
      dismissInvite();
      queryClient.removeQueries({ queryKey: key });
      go("profile");
    });
  }

  const accountActions = (
    <div className="action-row section-gap">
      <button className="btn secondary" disabled={busy} onClick={() => void signOut()}>
        Sign out
      </button>
      <button className="btn secondary" onClick={startDemo}>
        Try demo
      </button>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
    </div>
  );

  if (list.isPending)
    return (
      <AccountPanel title="My Houses">
        <p role="status">Loading houses…</p>
      </AccountPanel>
    );
  if (list.isError)
    return (
      <AccountPanel title="My Houses">
        <p className="notice" role="alert">
          {message(list.error)}
        </p>
        <button className="btn secondary" onClick={() => void list.refetch()}>
          Try again
        </button>
        {accountActions}
      </AccountPanel>
    );

  if (!list.data.name && pending !== "invalid")
    return (
      <AccountPanel title="Set up your profile">
        <form
          className="panel review-card account-form stack"
          onSubmit={(event) => {
            event.preventDefault();
            const parsed = displayName.safeParse(name);
            if (!parsed.success) {
              setNotice("Enter a display name between 1 and 40 characters.");
              return;
            }
            void run(async () => {
              const profile = await callHouse({ type: "name", name: parsed.data }, token);
              queryClient.setQueryData(listKey, { ...list.data, name: profile.name });
            });
          }}
        >
          <label>
            Display name
            <input
              required
              maxLength={40}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <button className="btn primary" disabled={busy}>
            Continue
          </button>
        </form>
        {accountActions}
      </AccountPanel>
    );

  if (pending)
    return (
      <AccountPanel title="House invitation">
        <div className="panel review-card stack">
          {pending === "invalid" ? (
            <p role="alert">This invitation is invalid. Ask the house owner for a new link.</p>
          ) : invitation.isError ? (
            <p role="alert">{message(invitation.error)}</p>
          ) : invitation.data ? (
            <>
              <h2>{invitation.data.name}</h2>
              <p>
                {invitation.data.joined
                  ? "You already belong to this house."
                  : "Join to share food, chores and points with your housemates."}
              </p>
              <button
                className="btn primary"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const joined = await callHouse({ type: "join", token: pending }, token);
                    await queryClient.invalidateQueries({ queryKey: listKey });
                    setSelected(joined.id);
                    dismissInvite();
                    go("food");
                  })
                }
              >
                {busy ? "Opening…" : invitation.data.joined ? "Open house" : "Join house"}
              </button>
            </>
          ) : (
            <p role="status">Checking the invitation…</p>
          )}
          <button className="btn secondary" disabled={busy} onClick={dismissInvite}>
            Back to My Houses
          </button>
          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
        </div>
      </AccountPanel>
    );

  const myHouses = (
    <>
      <MyHouses
        houses={houses}
        {...(active ? { active: active.id } : {})}
        select={select}
        create={async (name) => {
          const created = await callHouse({ type: "create", name }, token);
          queryClient.setQueryData(listKey, {
            ...list.data,
            houses: [...houses, { id: created.id, name, role: "owner" }],
          });
          setSelected(created.id);
          go("food");
          void queryClient.invalidateQueries({ queryKey: listKey });
        }}
        invite={(id) => callHouse({ type: "invite", id }, token)}
        revoke={async (id) => {
          await callHouse({ type: "revoke", id }, token);
        }}
      />
      {accountActions}
    </>
  );
  if (!active)
    return (
      <AccountPanel title="Profile">
        <p>{list.data.name}</p>
        {myHouses}
      </AccountPanel>
    );
  if (!kitchen.data)
    return (
      <AccountPanel title={active.name}>
        {kitchen.isError ? (
          <>
            <p className="notice" role="alert">
              {message(kitchen.error)}
            </p>
            <button className="btn secondary" onClick={() => void kitchen.refetch()}>
              Try again
            </button>
          </>
        ) : (
          <p role="status">Loading the kitchen…</p>
        )}
        {kitchen.isError && myHouses}
      </AccountPanel>
    );

  return (
    <Kitchen
      key={active.id}
      tab={tab}
      go={go}
      shared={{
        state: kitchen.data,
        name: active.name,
        profile: myHouses,
        authorizeScan: async () => {
          const { grant } = await callHouse(
            { type: "scanGrant", id: active.id },
            token,
            AbortSignal.timeout(8000),
          );
          return grant;
        },
        act: async (action) => {
          const next = await callHouse({ type: "act", id: active.id, action }, token);
          await queryClient.cancelQueries({ queryKey: kitchenKey });
          queryClient.setQueryData<SharedKitchen>(kitchenKey, (current) =>
            current && current.revision > next.revision ? current : next,
          );
        },
      }}
    />
  );
}
