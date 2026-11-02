"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { categories, conditions } from "@/lib/rules";
import {
  Plus,
  ArrowUpRight,
  ShieldCheck,
  Bell,
  X,
  Package,
  Pencil,
  Trash2,
  Clock,
} from "lucide-react";
import { CategoryIcon } from "@/components/tool-icon";
type Tool = Doc<"tools"> & {
  trusted: boolean;
  busy: boolean;
  ownerName?: string;
};
export function Dashboard() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const me = useQuery(api.users.me, {}),
    tools = useQuery(api.tools.list, {}),
    loans = useQuery(api.loans.list, {}),
    notifications = useQuery(api.loans.notifications, {});
  const users = useQuery(api.users.list, me?.isAdmin ? {} : "skip"),
    events = useQuery(api.automation.activity, me?.isAdmin ? {} : "skip");
  const sync = useMutation(api.users.sync),
    save = useMutation(api.tools.save),
    remove = useMutation(api.tools.remove),
    request = useMutation(api.loans.request),
    transition = useMutation(api.loans.transition),
    trust = useMutation(api.users.trust),
    retry = useMutation(api.automation.retry);
  const [tab, setTab] = useState("Explore tools"),
    [category, setCategory] = useState("All tools"),
    [modal, setModal] = useState<"listing" | "borrow" | "delete" | null>(null),
    [selected, setSelected] = useState<Tool | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    sync({}).catch(() =>
      setError("Could not initialize your profile. Refresh to try again."),
    );
  }, [sync]);
  useEffect(() => {
    if (modal && !dialogRef.current?.open) dialogRef.current?.showModal();
  }, [modal]);
  async function run(fn: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      setNotice(message);
      return true;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Something went wrong. Please try again.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  function open(
    kind: "listing" | "borrow" | "delete",
    tool: Tool | null = null,
  ) {
    setSelected(tool);
    setModal(kind);
    setError("");
  }
  if (!me || !tools || !loans)
    return (
      <div className="loading" role="status">
        Getting your neighborhood ready…
      </div>
    );
  const incoming = loans.filter((l) => l.lender === me.subject),
    outgoing = loans.filter((l) => l.borrower === me.subject);
  const list =
    tab === "My requests"
      ? outgoing
      : tab === "Incoming requests"
        ? incoming
        : loans;
  const visible = tools.filter(
    (t) =>
      (tab !== "My listings" || t.owner === me.subject) &&
      (category === "All tools" || t.category === category),
  );
  return (
    <section className="dashboard" id="browse">
      <div className="dashboard-heading">
        <div>
          <div
            className="eyebrow"
            style={{ display: "flex", alignItems: "center", gap: "8px" }}
          >
            <span>YOUR NEIGHBORHOOD, CONNECTED</span>
            <span
              style={{
                textTransform: "none",
                fontSize: "11px",
                fontWeight: 500,
                color: me.isAdmin ? "#15803d" : "#78716c",
                background: me.isAdmin ? "#ecfdf5" : "#f5f5f4",
                padding: "2px 8px",
                borderRadius: "999px",
                border: me.isAdmin ? "1px solid #bbf7d0" : "1px solid #e7e5e4",
              }}
              title={`Clerk ID: ${me.subject}`}
            >
              {me.isAdmin ? "👑 Admin" : "👤 Member"}
            </span>
          </div>
          <h1>
            Hello, {me.name.split(" ")[0]}
            <span className="wave">.</span>
          </h1>
          <p>What can we help you get done today?</p>
        </div>
        <button className="button primary" onClick={() => open("listing")}>
          <Plus size={17} /> List a tool
        </button>
      </div>
      <div className="stats">
        <div>
          <span>On the neighborhood shelf</span>
          <strong>
            {tools.length}
            <small> tools to share</small>
          </strong>
        </div>
        <div>
          <span>Your borrowing</span>
          <strong>
            {outgoing.filter((l) => l.status === "approved").length}
            <small> active loans</small>
          </strong>
        </div>
        <div>
          <span>A neighbor needs a hand</span>
          <strong>
            {incoming.filter((l) => l.status === "pending").length}
            <small> pending requests</small>
          </strong>
        </div>
      </div>
      <div className="tabs" role="tablist" aria-label="Dashboard views">
        {[
          "Explore tools",
          "My listings",
          "My requests",
          "Incoming requests",
          "Notifications",
          ...(me.isAdmin ? ["Admin"] : []),
        ].map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={tab === t ? "selected" : ""}
            onClick={() => {
              setTab(t);
              setError("");
              setNotice("");
            }}
          >
            {t}
            {t === "Incoming requests" &&
              incoming.some((l) => l.status === "pending") && (
                <span className="tab-dot" />
              )}
          </button>
        ))}
      </div>
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
      {error && !modal && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {["Explore tools", "My listings"].includes(tab) && (
        <>
          <div className="filter-row">
            <h2>
              {tab === "My listings"
                ? "Your little lending library"
                : "Find your next project companion"}
            </h2>
            <select
              aria-label="Filter tools by category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {["All tools", ...categories].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="tool-grid">
            {visible.map((t) => (
              <article key={t._id} className="tool-card">
                <div
                  className={`tool-visual color-${categories.indexOf(t.category as (typeof categories)[number]) % 4}`}
                >
                  <CategoryIcon category={t.category} size={58} />
                  <span
                    className={`availability ${t.busy ? "unavailable" : ""}`}
                  >
                    {t.busy ? "On loan" : "Available today"}
                  </span>
                </div>
                <div className="tool-body">
                  <span className="category-label">
                    {t.category} · {t.condition}
                  </span>
                  <h3>{t.name}</h3>
                  <p>{t.description}</p>
                  <div className="tool-lender">
                    <span className="lender-name">
                      Offered by {t.owner === me.subject ? "you" : t.ownerName}
                    </span>
                    {t.trusted && (
                      <span className="trusted">
                        <ShieldCheck size={14} /> Trusted lender
                      </span>
                    )}
                  </div>
                  <div className="card-actions">
                    {t.owner === me.subject ? (
                      <>
                        <button
                          className="button small"
                          onClick={() => open("listing", t)}
                        >
                          <Pencil size={14} /> Edit
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`Remove ${t.name}`}
                          disabled={busy}
                          onClick={() => open("delete", t)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    ) : (
                      <button
                        className="button small"
                        onClick={() => open("borrow", t)}
                      >
                        Request dates <ArrowUpRight size={15} />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
          {!visible.length && (
            <Empty
              text={
                tab === "My listings"
                  ? "Your shelf is ready for its first tool."
                  : "No tools in this category yet."
              }
            />
          )}
        </>
      )}
      {["My requests", "Incoming requests", "Admin"].includes(tab) && (
        <>
          <h2>{tab === "Admin" ? "All neighborhood loans" : tab}</h2>
          <div className="loan-list">
            {list.map((l) => (
              <article className="loan-card" key={l._id}>
                <div className="loan-icon">
                  <Package size={24} />
                </div>
                <div className="loan-info">
                  <h3>{l.toolName}</h3>
                  <p>
                    {l.start} → {l.end}{" "}
                    <span className="muted">· UTC dates</span>
                  </p>
                  {l.automationActivity ? (
                    <small
                      className="muted"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        marginTop: "4px",
                      }}
                    >
                      <Clock size={12} /> {l.automationActivity.text}{" "}
                      {formatTimeAgo(l.automationActivity.time)}
                    </small>
                  ) : l.lastReminderAt > 0 ? (
                    <small
                      className="muted"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        marginTop: "4px",
                      }}
                    >
                      <Clock size={12} /> Reminder sent{" "}
                      {formatTimeAgo(l.lastReminderAt)}
                    </small>
                  ) : null}
                </div>
                <span className={`status status-${l.status}`}>
                  {l.status === "approved" &&
                  l.end < new Date().toISOString().slice(0, 10)
                    ? "Overdue"
                    : l.status}
                </span>
                <div className="card-actions">
                  {l.lender === me.subject && l.status === "pending" && (
                    <>
                      <button
                        className="button small primary"
                        disabled={busy}
                        onClick={() =>
                          void run(
                            () => transition({ id: l._id, next: "approved" }),
                            "Request approved.",
                          )
                        }
                      >
                        Approve
                      </button>
                      <button
                        className="button small"
                        disabled={busy}
                        onClick={() =>
                          void run(
                            () => transition({ id: l._id, next: "declined" }),
                            "Request declined.",
                          )
                        }
                      >
                        Decline
                      </button>
                    </>
                  )}
                  {l.lender === me.subject && l.status === "approved" && (
                    <button
                      className="button small"
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () => transition({ id: l._id, next: "returned" }),
                          "Return confirmed.",
                        )
                      }
                    >
                      Mark returned
                    </button>
                  )}
                  {l.borrower === me.subject && l.status === "pending" && (
                    <button
                      className="button small"
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () => transition({ id: l._id, next: "cancelled" }),
                          "Request cancelled.",
                        )
                      }
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
          {!list.length && (
            <Empty text="Nothing here yet. Good things start with a request." />
          )}
        </>
      )}
      {tab === "Notifications" && (
        <>
          <h2>Your updates</h2>
          <p className="muted">
            In-app mock notifications, delivered by the n8n workflows.
          </p>
          {notifications?.map((n) => (
            <article className="loan-card" key={n._id}>
              <Bell size={20} />
              <div>
                <h3>{n.message}</h3>
                <small>{new Date(n.createdAt).toLocaleString()}</small>
              </div>
            </article>
          ))}
          {!notifications?.length && <Empty text="You’re all caught up." />}
        </>
      )}
      {tab === "Admin" && (
        <>
          <h2 className="admin-title">Trusted lenders</h2>
          {users?.map((u) => (
            <article className="loan-card" key={u._id}>
              <div className="loan-info">
                <h3>{u.name}</h3>
                <small>
                  {u.trusted ? "Trusted lender" : "Community member"}
                </small>
              </div>
              <button
                className="button small"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => trust({ id: u._id, trusted: !u.trusted }),
                    "Lender status updated.",
                  )
                }
              >
                {u.trusted ? "Remove trust" : "Mark trusted"}
              </button>
            </article>
          ))}
          <h2 className="admin-title">Listing moderation</h2>
          {tools.map((t) => (
            <article className="loan-card" key={t._id}>
              <div className="loan-info">
                <h3>{t.name}</h3>
                <small>{t.category}</small>
              </div>
              <button
                className="button small"
                disabled={busy}
                onClick={() => open("delete", t)}
              >
                Remove listing
              </button>
            </article>
          ))}
          <h2 className="admin-title">Automation delivery</h2>
          {events?.map((e) => (
            <article className="loan-card" key={e._id}>
              <div className="loan-info">
                <h3>{e.kind}</h3>
                <small>
                  {e.attempts} failed attempts{" "}
                  {e.lastError && `· ${e.lastError}`}
                </small>
              </div>
              <span className="status">{e.state}</span>
              {e.state !== "delivered" && (
                <button
                  className="button small"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () => retry({ eventId: e._id }),
                      "Delivery queued immediately.",
                    )
                  }
                >
                  {e.state === "failed" ? "Retry" : "Deliver now"}
                </button>
              )}
            </article>
          ))}
        </>
      )}
      {modal && (
        <dialog
          ref={dialogRef}
          className="modal-backdrop"
          aria-labelledby="modal-title"
          onCancel={(e) => {
            e.preventDefault();
            if (!busy) setModal(null);
          }}
        >
          {modal === "delete" ? (
            <div className="modal">
              <button
                className="close icon-button"
                aria-label="Close dialog"
                disabled={busy}
                onClick={() => setModal(null)}
              >
                <X size={22} />
              </button>
              <div className="eyebrow" style={{ color: "#b91c1c" }}>
                {me.isAdmin ? "ADMIN MODERATION" : "CONFIRM REMOVAL"}
              </div>
              <h2 id="modal-title">
                {me.isAdmin ? "Remove listing (Admin)" : "Remove your listing?"}
              </h2>
              <p>
                {me.isAdmin ? (
                  <>
                    Are you sure you want to remove <strong>{selected?.name}</strong>?
                    Any pending borrow requests will be cancelled automatically, and
                    active or past loan records will be safely preserved in history.
                  </>
                ) : (
                  <>
                    Are you sure you want to remove <strong>{selected?.name}</strong> from
                    the neighborhood shelf? Any past loan history will be preserved.
                    Outstanding requests and active loans must be resolved before removal.
                  </>
                )}
              </p>
              {!me.isAdmin &&
                loans?.some(
                  (l) =>
                    l.toolId === selected?._id &&
                    (l.status === "pending" || l.status === "approved"),
                ) && (
                  <div className="error" role="alert">
                    This listing has active loans or pending requests. Please resolve them
                    before removing this listing.
                  </div>
                )}
              {error && (
                <div className="error" role="alert">
                  {error}
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  marginTop: "24px",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="button"
                  className="button"
                  disabled={busy}
                  onClick={() => setModal(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="button danger"
                  disabled={
                    busy ||
                    (!me.isAdmin &&
                      Boolean(
                        loans?.some(
                          (l) =>
                            l.toolId === selected?._id &&
                            (l.status === "pending" || l.status === "approved"),
                        ),
                      ))
                  }
                  onClick={async () => {
                    if (!selected) return;
                    const ok = await run(
                      () => remove({ id: selected._id }),
                      "Listing removed.",
                    );
                    if (ok) setModal(null);
                  }}
                >
                  {busy ? "Removing…" : "Remove listing"}
                </button>
              </div>
            </div>
          ) : (
            <div className="modal">
            <button
              className="close icon-button"
              aria-label="Close dialog"
              disabled={busy}
              onClick={() => setModal(null)}
            >
              <X size={22} />
            </button>
            <div className="eyebrow">KEEP THE GOOD GOING</div>
            <h2 id="modal-title">
              {modal === "borrow"
                ? `Borrow ${selected?.name}`
                : selected
                  ? "Update your listing"
                  : "Something worth sharing."}
            </h2>
            <p>
              {modal === "borrow"
                ? "Pick your dates. Your neighbor will confirm the request."
                : "A few details help your neighbors find just the thing."}
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const ok = await run(
                  () =>
                    modal === "listing"
                      ? save({
                          id: selected?._id,
                          name: String(f.get("name")),
                          category: String(f.get("category")),
                          condition: String(f.get("condition")),
                          description: String(f.get("description")),
                        })
                      : request({
                          toolId: selected!._id,
                          start: String(f.get("start")),
                          end: String(f.get("end")),
                        }),
                  modal === "listing"
                    ? "Your listing is ready."
                    : "Request sent. We’ll keep you posted.",
                );
                if (ok) setModal(null);
              }}
            >
              {modal === "listing" ? (
                <>
                  <label>
                    Tool name
                    <input
                      autoFocus
                      name="name"
                      required
                      maxLength={80}
                      defaultValue={selected?.name}
                      placeholder="e.g. Cordless drill"
                    />
                  </label>
                  <div className="form-row">
                    <label>
                      Category
                      <select name="category" defaultValue={selected?.category}>
                        {categories.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Condition
                      <select
                        name="condition"
                        defaultValue={selected?.condition}
                      >
                        {conditions.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label>
                    A short description
                    <textarea
                      name="description"
                      required
                      maxLength={500}
                      rows={4}
                      defaultValue={selected?.description}
                      placeholder="What should your neighbor know?"
                    />
                  </label>
                </>
              ) : (
                <>
                  <div className="form-row">
                    <label>
                      Pickup date
                      <input
                        autoFocus
                        type="date"
                        required
                        name="start"
                        min={new Date().toISOString().slice(0, 10)}
                      />
                    </label>
                    <label>
                      Return date
                      <input
                        type="date"
                        required
                        name="end"
                        min={new Date().toISOString().slice(0, 10)}
                      />
                    </label>
                  </div>
                  <p className="muted">
                    Both dates are included in the booking. Dates use UTC.
                  </p>
                </>
              )}
              {error && (
                <div className="error" role="alert">
                  {error}
                </div>
              )}
              <button
                disabled={busy}
                className="button primary full"
                type="submit"
              >
                {busy
                  ? "Working…"
                  : modal === "listing"
                    ? "Save listing"
                    : "Send borrowing request"}{" "}
                <ArrowUpRight size={16} />
              </button>
            </form>
          </div>
          )}
        </dialog>
      )}
    </section>
  );
}
function formatTimeAgo(timestamp: number): string {
  const diffMs = Math.max(0, Date.now() - timestamp);
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "1 day ago";
  return `${diffDays} days ago`;
}

function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <Package size={30} />
      <p>{text}</p>
    </div>
  );
}
