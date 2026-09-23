"use client";

import Link from "next/link";
import { DeskCard, QuestionCard, QuestionRow } from "@/components/Cards";
import { Empty, ErrorNote, Seal, Skeleton, TxLink } from "@/components/ui";
import { useNow, useRead } from "@/lib/hooks";
import { reads, allDesks } from "@/lib/genlayer";
import { contractTxs } from "@/lib/timeline";
import type { Question } from "@/lib/types";

const VERDICT_SET = "ANSWERED,DODGED,DODGED_ONCE,REFUSED";

function byDecision(a: Question, b: Question) {
  return (b.decidedAt || b.repliedAt) - (a.decidedAt || a.repliedAt);
}

/** The hero card is read from the contract: the largest answered pot. */
export function HeroCard() {
  const now = useNow();
  const { data, error, loading, reload } = useRead("hero", async () => {
    const answered = await reads.questions("", "ANSWERED", 0, 1, "pot");
    const q = answered.items[0] ?? (await reads.questions("", VERDICT_SET, 0, 1, "pot")).items[0] ?? null;
    if (!q) return null;
    const txs = await contractTxs().catch(() => []);
    const judge = txs.filter((t) => t.method === "judge" && Number(t.args[0]) === q.id).pop();
    return { q, judge: judge?.hash ?? null };
  });
  if (loading && !data) return <div className="panel pad stack"><Skeleton h={22} w="60%" /><Skeleton h={64} /><Skeleton h={48} /></div>;
  if (error) return <ErrorNote error={error} retry={reload} />;
  if (!data) return <Empty action={<Link className="btn primary" href="/ask">Ask the first question</Link>}>No verdicts on chain yet.</Empty>;
  return (
    <div className="stack">
      <QuestionCard q={data.q} now={now} />
      <p className="tiny muted mono">
        Consensus reached on GenLayer Studio{data.judge ? <> · <TxLink hash={data.judge} /></> : null}
      </p>
    </div>
  );
}

export function LiveVerdicts() {
  const { data } = useRead(
    "live",
    async () => (await reads.questions("", VERDICT_SET, 0, 50, "new")).items.sort(byDecision).slice(0, 4),
    30000,
  );
  return (
    <div className="panel pad-sm row wrap-ok" style={{ gap: 20 }}>
      <span className="label">Live verdicts</span>
      {!data ? (
        <Skeleton h={16} w="60%" />
      ) : data.length === 0 ? (
        <span className="small muted">No verdicts yet. The first one lands here.</span>
      ) : (
        data.map((q) => (
          <Link key={q.id} href={`/q/${q.id}`} className="row small" style={{ gap: 8, minWidth: 0, maxWidth: 360 }}>
            <Seal status={q.status} />
            <span className="clamp-2">
              <span style={{ fontWeight: 500 }}>{q.deskName}</span> <span className="muted">{q.reason}</span>
            </span>
          </Link>
        ))
      )}
    </div>
  );
}

export function FeaturedDesks() {
  const { data, error, reload } = useRead("featured", async () => {
    // The golden-case eval desks are real but not products; keep them off the front page.
    const desks = (await allDesks()).filter((d) => d.topics !== "eval");
    return desks.sort((a, b) => b.answered + b.asked - (a.answered + a.asked)).slice(0, 4);
  });
  if (error) return <ErrorNote error={error} retry={reload} />;
  if (!data) return <div className="cards-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={170} />)}</div>;
  if (!data.length) return <Empty action={<Link className="btn" href="/desk">Open your desk</Link>}>No desks yet.</Empty>;
  return (
    <div className="cards-4">
      {data.map((d) => (
        <DeskCard key={d.address} d={d} />
      ))}
    </div>
  );
}

export function MostBacked() {
  const now = useNow();
  const { data, error, reload } = useRead("most-backed", () => reads.questions("", "OPEN", 0, 5, "pot"), 45000);
  if (error) return <ErrorNote error={error} retry={reload} />;
  if (!data) return <div className="panel"><Skeleton h={220} /></div>;
  if (!data.items.length) return <Empty action={<Link className="btn primary" href="/ask">Ask a question</Link>}>No open questions right now.</Empty>;
  return (
    <div className="panel">
      {data.items.map((q) => (
        <QuestionRow key={q.id} q={q} now={now} />
      ))}
    </div>
  );
}
