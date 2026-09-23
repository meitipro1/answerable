import Link from "next/link";
import { duration, gen, plural, rate, short } from "@/lib/format";
import type { Desk, Question } from "@/lib/types";
import { Avatar, Seal, StatusChip } from "./ui";

/** A question as it appears on a desk and in lists: pot first, then the question. */
export function QuestionRow({ q, now }: { q: Question; now: number }) {
  const decided = !["OPEN", "REPLIED", "DODGED_ONCE"].includes(q.status);
  return (
    <Link href={`/q/${q.id}`} className="list-row">
      <span className="pot">{gen(q.pot)} GEN</span>
      <span className="stack" style={{ minWidth: 0 }}>
        <span className="q-serif sm clamp-2 break">{q.text}</span>
        {decided && q.reason ? (
          <span className="row small muted" style={{ alignItems: "flex-start" }}>
            <Seal status={q.status} />
            <span className="clamp-2">{q.reason}</span>
          </span>
        ) : null}
      </span>
      <span className="stack tiny muted" style={{ textAlign: "right" }}>
        <span className="mono">
          {plural(q.backers, "backer")}
          {q.status === "OPEN" && now ? ` · ${duration(q.deadline - now)} left` : ""}
        </span>
        {!decided ? <StatusChip q={q} now={now} /> : <span className="mono">{q.deskName}</span>}
      </span>
    </Link>
  );
}

/** The public card for one question, used in the hero, previews and lists. */
export function QuestionCard({ q, now, preview }: { q: Question; now: number; preview?: boolean }) {
  const r = q.status === "ANSWERED" || q.status === "DODGED" || q.status === "REFUSED" || q.status === "DODGED_ONCE";
  return (
    <div className="panel pad stack">
      <div className="row between">
        <span className="row" style={{ minWidth: 0 }}>
          <Avatar name={q.deskName || "?"} size="sm" />
          <span className="small clamp-2">{q.deskName || "Pick a desk"}</span>
        </span>
        {r ? <Seal status={q.status} /> : <StatusChip q={q} now={now} />}
      </div>
      <p className="q-serif break">{q.text || "Your question appears here."}</p>
      <p className="mono small muted">
        {gen(q.pot)} GEN pot · {plural(q.backers, "backer")}
        {q.status === "OPEN" ? ` · ${now ? duration(q.deadline - now) : `${q.windowH}h`} left` : ""}
      </p>
      {!preview && q.reply ? <p className="small clamp-3 pre-line">{q.reply}</p> : null}
      {!preview && r && q.reason ? (
        <div className="row small" style={{ alignItems: "flex-start" }}>
          <Seal status={q.status} />
          <span className="muted">{q.reason}</span>
        </div>
      ) : null}
      {!preview ? (
        <Link href={`/q/${q.id}`} className="tiny muted mono">
          Q#{q.id} · asked by {short(q.asker)}
        </Link>
      ) : null}
    </div>
  );
}

export function DeskCard({ d }: { d: Desk }) {
  const r = rate(d.answered, d.dodged, d.expired);
  return (
    <Link href={`/d/${d.address}`} className="panel pad stack" style={{ display: "block" }}>
      <span className="row">
        <Avatar name={d.name} />
        <span style={{ minWidth: 0 }}>
          <span className="clamp-2" style={{ fontWeight: 500 }}>{d.name}</span>
          <span className="tiny muted mono">{short(d.address)}</span>
        </span>
      </span>
      <span className="row wrap-ok tiny mono muted">
        <span>MIN {gen(d.minFee)} GEN</span>
        <span>REPLIES IN {d.windowH}H</span>
      </span>
      <span className="row between">
        <span className="stat">
          <span className="label">Rate</span>
          <span className="v">{r === null ? "–" : `${r}%`}</span>
        </span>
        <span className="tiny muted mono" style={{ textAlign: "right" }}>
          {d.answered} answered
          <br />
          {d.open} open
        </span>
      </span>
    </Link>
  );
}
