"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import TxButton from "@/components/TxButton";
import { Empty, ErrorNote, Seal, Skeleton, StatusChip } from "@/components/ui";
import { MAX_DECLINE, MAX_REPLY, MAX_WINDOW_H, MIN_WINDOW_H } from "@/lib/config";
import { dateUTC, duration, gen, plural, toWei } from "@/lib/format";
import { reads } from "@/lib/genlayer";
import { useNow, useRead } from "@/lib/hooks";
import type { Desk, Question } from "@/lib/types";
import { useWallet } from "@/lib/wallet";

// ------------------------------------------------------------- desk terms

function TermsForm({ desk, onDone }: { desk: Desk | null; onDone: () => void }) {
  const [name, setName] = useState(desk?.name ?? "");
  const [links, setLinks] = useState(desk?.links ?? "");
  const [bio, setBio] = useState(desk?.bio ?? "");
  const [topics, setTopics] = useState(desk?.topics ?? "");
  const [fee, setFee] = useState(desk ? gen(desk.minFee, 18).replaceAll(",", "") : "5");
  const [windowH, setWindowH] = useState(desk?.windowH ?? 72);
  const wei = toWei(fee);
  const valid = name.trim().length > 0 && name.length <= 60 && links.length <= 300 && bio.length <= 280 && topics.length <= 120 && !!wei && wei > 0n;
  const fn = desk ? "update_desk" : "open_desk";

  return (
    <div className="panel pad stack-lg">
      <div className="stack">
        <h2 className="section">{desk ? "Edit your terms" : "Open your desk"}</h2>
        <p className="small muted">
          {desk
            ? "New terms apply to future questions only. Questions already asked keep the terms locked into them."
            : "One desk per address. People put GEN behind questions to you, and you keep it when validators agree you answered."}
        </p>
      </div>
      <label className="field">
        <span className="label">Name</span>
        <input className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Orrin Wallet team" />
      </label>
      <label className="field">
        <span className="label">Links</span>
        <input className="input" value={links} maxLength={300} onChange={(e) => setLinks(e.target.value)} placeholder="orrin.xyz @orrinwallet github.com/orrin" />
      </label>
      <label className="field">
        <span className="label">About</span>
        <textarea className="textarea" value={bio} maxLength={280} onChange={(e) => setBio(e.target.value)} placeholder="Self-custody wallet for Ethereum and L2s. Ask us about fees, security and the roadmap." />
      </label>
      <label className="field">
        <span className="label">Topics</span>
        <input className="input" value={topics} maxLength={120} onChange={(e) => setTopics(e.target.value)} placeholder="fees, security, roadmap" />
      </label>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <label className="field">
          <span className="label">Minimum fee (GEN)</span>
          <input className="input mono" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} />
        </label>
        <label className="field">
          <span className="label">Reply window: {windowH}h</span>
          <input type="range" min={MIN_WINDOW_H} max={MAX_WINDOW_H} step={12} value={windowH} onChange={(e) => setWindowH(Number(e.target.value))} style={{ width: "100%" }} />
          <span className="tiny muted">24 hours to 7 days</span>
        </label>
      </div>
      <TxButton
        label={desk ? "Save terms" : "Open desk"}
        disabled={!valid}
        request={() => (valid && wei ? { fn, args: [name.trim(), links.trim(), wei, windowH, bio.trim(), topics.trim()] } : null)}
        pendingText={desk ? "Saving your terms" : "Opening your desk"}
        doneText={desk ? "Saved" : "Desk open"}
        onSuccess={onDone}
      />
    </div>
  );
}

// ----------------------------------------------------------------- composer

function Preview({ q, reply }: { q: Question; reply: string }) {
  const on = useRead("preview-enabled", async () => (await (await fetch("/api/preview")).json()).enabled as boolean);
  const [out, setOut] = useState<{ verdict?: string; reason?: string; error?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!on.data) return null;
  async function run() {
    setBusy(true);
    try {
      const res = await fetch("/api/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: q.text, context: q.context, reply }) });
      setOut(await res.json());
    } catch (e) {
      setOut({ error: String(e) });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack">
      <button className="btn ghost sm" disabled={busy || !reply.trim()} onClick={run} style={{ alignSelf: "flex-start" }}>
        {busy ? "Previewing..." : "Preview verdict"}
      </button>
      {out ? (
        <div className="panel pad-sm stack">
          <span className="label">Preview, not binding</span>
          {out.error ? (
            <p className="small muted">{out.error}</p>
          ) : (
            <div className="row small" style={{ alignItems: "flex-start" }}>
              <span className={`seal ${out.verdict}`}>{out.verdict?.toLowerCase()}</span>
              <span>{out.reason}</span>
            </div>
          )}
          <p className="tiny muted">One model on our server. The real verdict comes from validators after you post.</p>
        </div>
      ) : null}
    </div>
  );
}

function Composer({ q, now, onChange }: { q: Question; now: number; onChange: () => void }) {
  const [reply, setReply] = useState("");
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [judgeNext, setJudgeNext] = useState(false);
  const t = now || q.now;
  const open = t < q.deadline;

  useEffect(() => {
    setReply("");
    setDeclining(false);
    setReason("");
    setJudgeNext(false);
  }, [q.id]);

  return (
    <div className="panel pad stack-lg">
      <div className="row between wrap-ok mono small muted">
        <span>{gen(q.pot)} GEN pot</span>
        <span>{plural(q.backers, "backer")}</span>
        <span className={q.deadline - t < 12 * 3600 ? "amber" : ""}>{open ? `${duration(q.deadline - t)} left` : "window closed"}</span>
        <span>asked by {q.asker.slice(0, 6)}...{q.asker.slice(-4)}</span>
      </div>
      <Link href={`/q/${q.id}`} className="q-serif break">{q.text}</Link>
      {q.context ? <p className="small muted pre-line break">Context: {q.context}</p> : null}

      {q.status === "DODGED_ONCE" ? (
        <div className="panel pad-sm stack">
          <span className="label">Your first reply, judged dodged</span>
          <p className="small pre-line">{q.reply}</p>
          <div className="row small" style={{ alignItems: "flex-start" }}>
            <Seal status="DODGED" />
            <span className="muted">{q.reason}</span>
          </div>
        </div>
      ) : null}

      {judgeNext || q.status === "REPLIED" ? (
        <div className="stack">
          <span className="label">Reply posted</span>
          {q.status === "REPLIED" && q.reply ? <p className="small pre-line">{q.reply}</p> : null}
          <p className="small muted">Now the validators read the question and your reply. Anyone can start the judge, and doing it now means nobody waits.</p>
          <TxButton
            label="Ask validators to judge"
            autoStart={judgeNext}
            request={() => ({ fn: "judge", args: [q.id], kind: "judge" })}
            pendingText="Validators are reading, usually under a minute"
            doneText="Judged"
            onSuccess={() => {
              setJudgeNext(false);
              onChange();
            }}
          />
        </div>
      ) : !open ? (
        <p className="small muted">The reply window closed on {dateUTC(q.deadline)}.</p>
      ) : (
        <>
          <div className="stack">
            <span className="label">{q.status === "DODGED_ONCE" ? "Your amended reply" : "Your reply"}</span>
            <textarea className="textarea" style={{ minHeight: 160 }} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Answer the question as it was asked: a yes or no with a reason, a number, a date, a decision or a plan." />
            <div className="row between tiny muted">
              <span>You have 2 attempts. If the first is judged dodged and time remains, you can amend once.</span>
              <span className={`counter ${reply.length > MAX_REPLY ? "over" : ""}`}>
                {reply.length} / {MAX_REPLY}
              </span>
            </div>
          </div>
          <div className="row wrap-ok" style={{ alignItems: "flex-start" }}>
            <TxButton
              label="Post reply"
              disabled={!reply.trim() || reply.length > MAX_REPLY}
              request={() => (reply.trim() && reply.length <= MAX_REPLY ? { fn: "reply", args: [q.id, reply.trim()] } : null)}
              pendingText="Posting your reply"
              doneText="Posted"
              onSuccess={() => {
                setJudgeNext(true);
                onChange();
              }}
            />
            {q.status === "OPEN" ? (
              <button className="btn" onClick={() => setDeclining((d) => !d)}>
                {declining ? "Keep the question" : "Decline with a reason"}
              </button>
            ) : null}
          </div>
          <Preview q={q} reply={reply} />
          {declining ? (
            <div className="panel pad-sm stack">
              <p className="small muted">Declining refunds every backer and never lowers your rate. Nothing is judged.</p>
              <input className="input" maxLength={MAX_DECLINE} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Asks for private data about a user." />
              <TxButton
                label="Decline and refund everyone"
                className=""
                disabled={!reason.trim()}
                request={() => (reason.trim() ? { fn: "decline", args: [q.id, reason.trim()] } : null)}
                pendingText="Declining"
                doneText="Declined"
                onSuccess={onChange}
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

// -------------------------------------------------------------------- inbox

function Inbox({ desk, reloadDesk }: { desk: Desk; reloadDesk: () => void }) {
  const params = useSearchParams();
  const now = useNow();
  const [sort, setSort] = useState<"pot" | "deadline">("pot");
  const [selected, setSelected] = useState<number | null>(params.get("q") ? Number(params.get("q")) : null);
  const [editing, setEditing] = useState(false);
  const queue = useRead(`queue:${desk.address}`, () => reads.questions(desk.address, "OPEN,DODGED_ONCE,REPLIED", 0, 50, "pot"), 30000);
  const claimable = useRead(`claim:${desk.address}:${desk.claimableCount}`, () => reads.questions(desk.address, "ANSWERED", 0, 50, "decided"));

  const items = [...(queue.data?.items ?? [])].sort((a, b) => (sort === "pot" ? (b.pot > a.pot ? 1 : b.pot < a.pot ? -1 : 0) : a.deadline - b.deadline));
  const current = items.find((q) => q.id === selected) ?? items[0] ?? null;
  const unpaid = (claimable.data?.items ?? []).filter((q) => !q.paid);
  const refresh = () => {
    queue.reload();
    claimable.reload();
    reloadDesk();
  };

  return (
    <div className="stack-lg">
      <div className="row between wrap-ok">
        <div className="stack">
          <span className="label">Your desk</span>
          <h1 className="section" style={{ fontSize: 30 }}>{desk.name}</h1>
        </div>
        <div className="row">
          <Link href={`/d/${desk.address}`} className="btn">Public profile</Link>
          <button className="btn" onClick={() => setEditing((e) => !e)}>{editing ? "Close terms" : "Edit terms"}</button>
        </div>
      </div>
      {editing ? <TermsForm desk={desk} onDone={() => { setEditing(false); reloadDesk(); }} /> : null}

      <div className="inbox">
        <div className="stack">
          <div className="row between">
            <span className="label">Open questions {items.length}</span>
            <span className="row tiny">
              <button className={`pick ${sort === "pot" ? "on" : ""}`} onClick={() => setSort("pot")}>Pot</button>
              <button className={`pick ${sort === "deadline" ? "on" : ""}`} onClick={() => setSort("deadline")}>Deadline</button>
            </span>
          </div>
          {queue.error ? (
            <ErrorNote error={queue.error} retry={queue.reload} />
          ) : !queue.data ? (
            <Skeleton h={240} />
          ) : !items.length ? (
            <Empty>Nothing waiting. Share your desk link to get questions.</Empty>
          ) : (
            <div className="panel">
              {items.map((q) => {
                const left = q.deadline - (now || q.now);
                return (
                  <button
                    key={q.id}
                    onClick={() => setSelected(q.id)}
                    className="list-row"
                    style={{ width: "100%", textAlign: "left", border: 0, borderBottom: "1px solid var(--line-soft)", gridTemplateColumns: "1fr", background: current?.id === q.id ? "var(--panel-2)" : "transparent", cursor: "pointer" }}
                  >
                    <span className="row between mono small">
                      <span>{gen(q.pot)} GEN</span>
                      <span className={left < 12 * 3600 ? "amber" : "muted"}>{left > 0 ? `${duration(left)} left` : "closed"}</span>
                    </span>
                    <span className="small clamp-2">{q.text}</span>
                    {q.status !== "OPEN" ? <StatusChip q={q} now={now} /> : null}
                  </button>
                );
              })}
            </div>
          )}

          <div className="panel pad stack">
            <span className="label">Claimable</span>
            <span className="stat"><span className="v big">{gen(desk.claimable)}</span></span>
            <span className="small muted">GEN from {plural(desk.claimableCount, "answered question")}</span>
            {unpaid.map((q) => (
              <div key={q.id} className="stack" style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 12 }}>
                <Link href={`/q/${q.id}`} className="small clamp-2">{q.text}</Link>
                <TxButton
                  label={`Claim ${gen(q.pot)} GEN`}
                  className="primary sm"
                  request={() => ({ fn: "claim", args: [q.id] })}
                  pendingText="Sending the pot to your desk"
                  doneText="Claimed"
                  onSuccess={refresh}
                />
              </div>
            ))}
            <p className="tiny muted">Each claim is its own top-level transfer; the judge never moves money.</p>
          </div>
        </div>

        <div>{current ? <Composer q={current} now={now} onChange={refresh} /> : <Empty>Pick a question to answer.</Empty>}</div>
      </div>
    </div>
  );
}

function DeskHome() {
  const w = useWallet();
  const desk = useRead(w.address ? `mydesk:${w.address}` : null, async () => {
    try {
      return await reads.desk(w.address!);
    } catch (e) {
      if (String((e as Error)?.message ?? e).includes("desk not found")) return null;
      throw e;
    }
  });

  if (!w.address) {
    return (
      <Empty action={<button className="btn primary" onClick={w.connect}>Connect wallet</button>}>
        Connect the wallet that owns your desk, or the one you want to open a desk with.
      </Empty>
    );
  }
  if (desk.error) return <ErrorNote error={desk.error} retry={desk.reload} />;
  if (desk.loading && desk.data === null) return <Skeleton h={300} />;
  if (!desk.data) return <TermsForm desk={null} onDone={desk.reload} />;
  return <Inbox desk={desk.data} reloadDesk={desk.reload} />;
}

export default function DeskPage() {
  return (
    <div className="wrap" style={{ paddingTop: 40 }}>
      <Suspense fallback={<Skeleton h={300} />}>
        <DeskHome />
      </Suspense>
    </div>
  );
}
