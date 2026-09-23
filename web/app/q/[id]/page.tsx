"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import TxButton from "@/components/TxButton";
import { AddrLink, Avatar, ErrorNote, GEN, Seal, Skeleton, StatusChip, TxLink } from "@/components/ui";
import { NETWORK_LABEL } from "@/lib/config";
import { dateUTC, duration, gen, plural, rate, sameAddr, short, toWei } from "@/lib/format";
import { reads } from "@/lib/genlayer";
import { useNow, useRead } from "@/lib/hooks";
import { IN_FLIGHT, contractTxs, questionEvents, type TimelineEvent } from "@/lib/timeline";
import { REFUNDABLE, type Question } from "@/lib/types";
import { useWallet } from "@/lib/wallet";

const CHIPS = ["1", "5", "10", "20"];

function outcomeText(q: Question): string {
  switch (q.status) {
    case "ANSWERED":
      return q.paid ? `Paid to desk${q.claimedAt ? `, ${dateUTC(q.claimedAt, false)}` : ""}` : "Payable to desk";
    case "DODGED":
    case "REFUSED":
    case "DECLINED":
    case "EXPIRED":
      return "Refundable to every backer";
    case "DODGED_ONCE":
      return "Pending, the desk may amend once";
    case "REPLIED":
      return "Pending verdict";
    default:
      return "Pending reply";
  }
}

function eventLine(e: TimelineEvent, q: Question, attempt: number): string {
  const when = dateUTC(e.tx.createdAt);
  switch (e.kind) {
    case "ask":
      return `Asked ${when}`;
    case "reply":
      return `Replied ${when}${q.attempts > 1 ? ` (attempt ${attempt})` : ""}`;
    case "judge":
      return IN_FLIGHT.has(e.tx.status) ? `Judging since ${when}` : `Judged ${when}`;
    case "decline":
      return `Declined ${when}`;
    case "claim":
      return `Claimed by desk ${when}`;
    case "reclaim":
      return `Reclaimed by ${short(e.tx.from)} ${when}`;
    default:
      return when;
  }
}

function Timeline({ events, q }: { events: TimelineEvent[]; q: Question }) {
  const backs = events.filter((e) => e.kind === "back");
  const rows: { key: string; text: string; hash?: string; hot?: boolean }[] = [];
  let attempt = 0;
  for (const e of events) {
    if (e.kind === "back") continue;
    if (e.kind === "reply") attempt += 1;
    rows.push({ key: e.tx.hash, text: eventLine(e, q, attempt), hash: e.tx.hash, hot: e.kind === "judge" || e.kind === "claim" });
    if (e.kind === "ask" && backs.length) {
      const last = backs[backs.length - 1];
      rows.push({ key: "backs", text: `Backed ${plural(backs.length, "time")} to ${dateUTC(last.tx.createdAt, false)}`, hash: last.tx.hash });
    }
  }
  if (!rows.length) return <p className="tiny muted">The explorer has no transactions for this question yet.</p>;
  return (
    <ul className="timeline">
      {rows.map((r) => (
        <li key={r.key} className={r.hot ? "hot" : ""}>
          <span>{r.text}</span>
          {r.hash ? (
            <span className="tiny muted"> · <TxLink hash={r.hash} /></span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function BackBox({ q, onDone }: { q: Question; onDone: () => void }) {
  const [amount, setAmount] = useState("5");
  const wei = toWei(amount);
  return (
    <div className="stack">
      <span className="label">Back this question</span>
      <div className="chips-pick">
        {CHIPS.map((c) => (
          <button key={c} className={`pick ${amount === c ? "on" : ""}`} onClick={() => setAmount(c)}>
            {c}
          </button>
        ))}
      </div>
      <input className="input mono" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Amount in GEN" />
      <TxButton
        label={wei && wei > 0n ? `Back with ${gen(wei)} GEN` : "Enter an amount"}
        className="primary block"
        request={() => (wei && wei > 0n ? { fn: "back", args: [q.id], value: wei } : null)}
        pendingText="Adding your stake"
        doneText="Backed"
        onSuccess={onDone}
      />
      <p className="tiny muted">Backing closes the moment the desk replies. You reclaim your stake unless it is answered.</p>
    </div>
  );
}

export default function QuestionPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const valid = Number.isInteger(id) && id >= 0;
  const w = useWallet();
  const now = useNow();

  const qs = useRead(valid ? `q:${id}:${w.address ?? ""}` : null, () => reads.question(id, w.address ?? ""), 20000);
  const q = qs.data;
  const desk = useRead(q ? `desk:${q.desk}` : null, () => reads.desk(q!.desk));
  const tl = useRead(q ? `tl:${id}:${q.status}:${q.backers}:${q.paid}` : null, async () => questionEvents(await contractTxs(), q!), 20000);

  if (!valid) return <div className="wrap section-gap"><ErrorNote error="That is not a question number." /></div>;
  if (qs.error && !q) {
    return (
      <div className="wrap section-gap">
        <ErrorNote error={qs.error.includes("not found") ? `Question #${id} does not exist.` : qs.error} retry={qs.reload} />
      </div>
    );
  }
  if (!q) {
    return (
      <div className="wrap section-gap two-col">
        <div className="stack-lg"><Skeleton h={20} w="40%" /><Skeleton h={90} /><Skeleton h={160} /></div>
        <Skeleton h={300} />
      </div>
    );
  }

  const events = tl.data ?? [];
  const judgeTx = [...events].reverse().find((e) => e.kind === "judge");
  const judging = q.status === "REPLIED" && !!judgeTx && IN_FLIGHT.has(judgeTx.tx.status);
  const isDesk = sameAddr(w.address, q.desk);
  const refundable = REFUNDABLE.includes(q.status);
  const d = desk.data;
  const r = d ? rate(d.answered, d.dodged, d.expired) : null;
  const closedAt = q.status === "ANSWERED" || refundable ? q.decidedAt : 0;
  const t = now || q.now;
  const reload = () => {
    qs.reload();
    desk.reload();
    tl.reload();
  };

  return (
    <div className="wrap" style={{ paddingTop: 32 }}>
      <p className="small muted" style={{ marginBottom: 24 }}>
        <Link href="/#desks">Desks</Link> / <Link href={`/d/${q.desk}`}>{q.deskName}</Link> / <span className="mono">Q#{q.id}</span>
      </p>
      <div className="two-col">
        <div className="stack-lg" style={{ minWidth: 0 }}>
          <div className="row between wrap-ok">
            <Link href={`/d/${q.desk}`} className="row">
              <Avatar name={q.deskName} />
              <span>
                <span style={{ fontWeight: 500 }}>{q.deskName}</span>
                <span className="tiny muted mono" style={{ display: "block" }}>{d?.links || short(q.desk)}</span>
              </span>
            </Link>
            <span className="stat" style={{ textAlign: "right" }}>
              <span className="label">Rate</span>
              <span className="mono">{r === null ? "–" : `${r}%`}</span>
            </span>
          </div>

          <div className="row wrap-ok">
            {q.status === "ANSWERED" || refundable ? <Seal status={q.status} /> : <StatusChip q={q} now={now} judging={judging} />}
            {closedAt ? <span className="small muted">Closed {dateUTC(closedAt)}</span> : null}
            {q.status === "OPEN" ? <span className="small muted">Reply due {dateUTC(q.deadline)}</span> : null}
          </div>

          <h1 className="q-serif lg break">{q.text}</h1>
          {q.context ? (
            <p className="muted break pre-line" style={{ borderLeft: "1px solid var(--line)", paddingLeft: 14 }}>
              Context: {q.context}
            </p>
          ) : null}
          <p className="tiny muted">
            Asked by <AddrLink addr={q.asker} /> on {dateUTC(q.askedAt, false)} with <GEN wei={q.openingStake} />
          </p>

          {q.firstReply ? (
            <details className="panel pad-sm">
              <summary className="small muted" style={{ cursor: "pointer" }}>
                Attempt 1 of 2, judged dodged
              </summary>
              <p className="small pre-line break" style={{ marginTop: 10 }}>{q.firstReply}</p>
              <div className="row small" style={{ marginTop: 10, alignItems: "flex-start" }}>
                <Seal status="DODGED" />
                <span className="muted">{q.firstReason}</span>
              </div>
            </details>
          ) : null}

          {q.reply ? (
            <div className="panel pad stack">
              <div className="row wrap-ok small muted">
                <Avatar name={q.deskName} size="sm" />
                <span>Reply from {q.deskName}</span>
                <span className="mono tiny">
                  {dateUTC(q.repliedAt)} · attempt {q.attempts} of 2
                </span>
              </div>
              <p className="pre-line break" style={{ fontSize: 17 }}>{q.reply}</p>
              {q.reason && q.status !== "REPLIED" ? (
                <>
                  <hr className="rule" />
                  <div className="row" style={{ alignItems: "flex-start" }}>
                    <Seal status={q.status} />
                    <span>{q.reason}</span>
                  </div>
                  <p className="tiny muted mono">
                    {q.status === "DODGED_ONCE" ? "Validators agreed on a first dodge" : "Consensus reached"} on {NETWORK_LABEL}
                    {judgeTx ? <> · <TxLink hash={judgeTx.tx.hash} /></> : null} · rubric {q.rubric || "v1"}
                  </p>
                </>
              ) : null}
              {q.status === "REPLIED" ? (
                judging ? (
                  <div className="banner">
                    <span className="chip reading">
                      Validators are reading<span className="dots" />
                    </span>
                    <span className="small muted">Usually under a minute · <TxLink hash={judgeTx!.tx.hash} /></span>
                  </div>
                ) : (
                  <div className="stack">
                    <p className="small muted">The reply is posted. Anyone can ask the validators to judge it now.</p>
                    <TxButton
                      label="Run the judge"
                      request={() => ({ fn: "judge", args: [q.id], kind: "judge" })}
                      pendingText="Validators are reading, usually under a minute"
                      doneText="Judged"
                      onSubmitted={() => setTimeout(tl.reload, 3000)}
                      onSuccess={reload}
                    />
                  </div>
                )
              ) : null}
            </div>
          ) : null}

          {q.status === "DECLINED" ? (
            <div className="panel pad stack">
              <div className="row"><Seal status="DECLINED" /><span className="small muted">The desk declined before replying.</span></div>
              <p>{q.reason}</p>
              <p className="tiny muted">Declines refund every backer and never lower the desk&apos;s rate. Nothing was judged.</p>
            </div>
          ) : null}
          {q.status === "EXPIRED" ? (
            <div className="panel pad stack">
              <div className="row"><Seal status="EXPIRED" /><span className="small muted">No reply by {dateUTC(q.deadline)}.</span></div>
              <p className="tiny muted">Every backer can reclaim. An expiry counts against the desk like a dodge.</p>
            </div>
          ) : null}
          {q.status === "DODGED_ONCE" ? (
            <p className="small muted">
              The desk has until {dateUTC(q.deadline)} ({duration(q.deadline - t)} left) to post one amended reply. If it does not,
              the dodge is final and every backer can reclaim.
            </p>
          ) : null}
        </div>

        <aside className="stack-lg">
          <div className="panel pad stack">
            <span className="label">Pot</span>
            <span className="stat"><span className="v big">{gen(q.pot)}</span></span>
            <span className="small muted mono">
              GEN · {plural(q.backers, "backer")} · opened with {gen(q.openingStake)} GEN
            </span>
            <hr className="rule" />
            {w.address ? (
              <div className="row between small">
                <span className="muted">Your stake</span>
                <span className="mono">{gen(q.yourStake)} GEN</span>
              </div>
            ) : null}
            <div className="row between small">
              <span className="muted">Outcome</span>
              <span>{outcomeText(q)}</span>
            </div>

            {isDesk && q.status === "ANSWERED" && !q.paid ? (
              <TxButton
                label={`Claim ${gen(q.pot)} GEN`}
                className="primary block"
                request={() => ({ fn: "claim", args: [q.id] })}
                pendingText="Sending the pot to your desk"
                doneText="Claimed"
                onSuccess={reload}
              />
            ) : null}
            {isDesk && (q.status === "OPEN" || q.status === "DODGED_ONCE") ? (
              <Link href={`/desk?q=${q.id}`} className="btn primary block">
                {q.status === "OPEN" ? "Reply or decline" : "Amend your reply"}
              </Link>
            ) : null}
            {!isDesk && refundable && q.yourStake > 0n ? (
              <TxButton
                label={`Reclaim ${gen(q.yourStake)} GEN`}
                className="primary block"
                request={() => ({ fn: "reclaim", args: [q.id] })}
                pendingText="Returning your stake"
                doneText="Reclaimed"
                onSuccess={reload}
              />
            ) : null}
            {!isDesk && q.status === "OPEN" && t < q.deadline ? <BackBox q={q} onDone={reload} /> : null}
            {refundable && w.address && q.yourStake === 0n && !isDesk ? (
              <p className="tiny muted">Nothing to reclaim for this wallet.</p>
            ) : null}
          </div>

          {q.topBackers.length ? (
            <div className="panel pad stack">
              <span className="label">Largest backers</span>
              {q.topBackers.map((b) => (
                <div key={b.address} className="row between small">
                  <AddrLink addr={b.address} />
                  <span className="mono">{gen(b.stake)} GEN</span>
                </div>
              ))}
              {q.backers > q.topBackers.length ? <p className="tiny muted">{q.backers - q.topBackers.length} more</p> : null}
            </div>
          ) : null}

          <div className="panel pad stack">
            <span className="label">Timeline</span>
            {tl.data ? <Timeline events={events} q={q} /> : tl.error ? <p className="tiny muted">Explorer unavailable right now.</p> : <Skeleton h={80} />}
          </div>
        </aside>
      </div>
    </div>
  );
}
