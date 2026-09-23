"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { QuestionRow } from "@/components/Cards";
import { Avatar, Empty, ErrorNote, Skeleton } from "@/components/ui";
import { addressUrl } from "@/lib/config";
import { duration, gen, rate, short } from "@/lib/format";
import { reads } from "@/lib/genlayer";
import { useNow, useRead } from "@/lib/hooks";
import type { Desk } from "@/lib/types";

const TABS = [
  { key: "open", label: "Open", status: "OPEN,REPLIED,DODGED_ONCE", sort: "pot" as const, count: (d: Desk) => d.open },
  { key: "answered", label: "Answered", status: "ANSWERED", sort: "decided" as const, count: (d: Desk) => d.answered },
  { key: "dodged", label: "Dodged", status: "DODGED", sort: "decided" as const, count: (d: Desk) => d.dodged },
  { key: "refused", label: "Refused", status: "REFUSED", sort: "decided" as const, count: (d: Desk) => d.refused },
  { key: "declined", label: "Declined", status: "DECLINED", sort: "decided" as const, count: (d: Desk) => d.declined },
  { key: "expired", label: "Expired", status: "EXPIRED", sort: "new" as const, count: (d: Desk) => d.expired },
];

function linkHref(raw: string): string | null {
  const s = raw.trim().replace(/[,;]$/, "");
  if (/^https?:\/\//i.test(s)) return s;
  if (/^@\w{1,30}$/.test(s)) return `https://x.com/${s.slice(1)}`;
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(s)) return `https://${s}`;
  return null;
}

function Links({ text }: { text: string }) {
  const parts = text.split(/[\s,·]+/).filter(Boolean);
  if (!parts.length) return null;
  return (
    <span className="row wrap-ok small muted" style={{ gap: 0 }}>
      {parts.map((p, i) => {
        const href = linkHref(p);
        return (
          <span key={p + i} className={i ? "divider-dot" : ""}>
            {href ? <a href={href} target="_blank" rel="noreferrer nofollow">{p}</a> : p}
          </span>
        );
      })}
    </span>
  );
}

export default function DeskProfile() {
  const { address } = useParams<{ address: string }>();
  const now = useNow();
  const [tab, setTab] = useState("open");
  const [limit, setLimit] = useState(20);
  const [copied, setCopied] = useState(false);
  const desk = useRead(`desk:${address}`, () => reads.desk(address), 60000);
  const current = TABS.find((t) => t.key === tab)!;
  const list = useRead(`dq:${address}:${tab}:${limit}`, () => reads.questions(address, current.status, 0, Math.min(limit, 50), current.sort), 45000);

  if (desk.error && !desk.data) {
    return (
      <div className="wrap section-gap">
        <ErrorNote error={desk.error.includes("not found") ? `No desk is open at ${address}.` : desk.error} retry={desk.reload} />
      </div>
    );
  }
  const d = desk.data;
  if (!d) return <div className="wrap section-gap stack-lg"><Skeleton h={80} /><Skeleton h={140} /><Skeleton h={300} /></div>;

  const r = rate(d.answered, d.dodged, d.expired);
  const denom = d.answered + d.dodged + d.expired;

  function share() {
    navigator.clipboard?.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="wrap stack-lg" style={{ paddingTop: 40 }}>
      <div className="row between wrap-ok" style={{ alignItems: "flex-start" }}>
        <div className="row" style={{ alignItems: "flex-start", gap: 18, minWidth: 0 }}>
          <Avatar name={d.name} size="lg" />
          <div className="stack" style={{ minWidth: 0 }}>
            <h1 className="section" style={{ fontSize: 32 }}>{d.name}</h1>
            <Links text={d.links} />
            {d.bio ? <p className="muted" style={{ maxWidth: 640 }}>{d.bio}</p> : null}
            <div className="row wrap-ok tiny mono muted">
              <span className="chip">MIN {gen(d.minFee)} GEN</span>
              <span className="chip">Replies in {d.windowH}h</span>
              {d.topics ? <span className="chip">Topics: {d.topics}</span> : null}
              <a className="tiny mono muted" href={addressUrl(d.address)} target="_blank" rel="noreferrer">{short(d.address)}</a>
            </div>
          </div>
        </div>
        <div className="row">
          <button className="btn" onClick={share}>{copied ? "Link copied" : "Share"}</button>
          <Link className="btn primary" href={`/ask?desk=${d.address}`}>Ask this desk</Link>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "minmax(0, 340px) minmax(0, 1fr)", gap: 16 }}>
        <div className="panel pad stack">
          <span className="stat">
            <span className="v big">{r === null ? "–" : `${r}%`}</span>
            <span className="label">Straight-answer rate</span>
          </span>
          <p className="tiny mono muted">answered ÷ (answered + dodged + expired)</p>
          <p className="small">
            {denom ? `${d.answered} ÷ ${denom}` : "No judged questions yet"}, from {d.distinctAskers} distinct {d.distinctAskers === 1 ? "asker" : "askers"}
          </p>
          <p className="tiny muted">Refusals and declines are shown but never lower the rate, so honesty is never punished.</p>
        </div>
        <div className="stats">
          <div className="stat"><span className="v">{d.answered}</span><span className="label">Answered</span></div>
          <div className="stat"><span className="v">{d.dodged}</span><span className="label">Dodged</span></div>
          <div className="stat"><span className="v">{d.expired}</span><span className="label">Expired</span></div>
          <div className="stat"><span className="v">{d.refused}</span><span className="label">Refused</span></div>
          <div className="stat"><span className="v">{d.declined}</span><span className="label">Declined</span></div>
          <div className="stat"><span className="v">{gen(d.earned, 2)}</span><span className="label">GEN earned</span></div>
          <div className="stat"><span className="v">{d.medianReplyS ? duration(d.medianReplyS) : "–"}</span><span className="label">Median reply</span></div>
          <div className="stat"><span className="v">{d.asked}</span><span className="label">Asked</span></div>
        </div>
      </div>

      <div>
        <div className="tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} className={`tab ${tab === t.key ? "on" : ""}`} onClick={() => { setTab(t.key); setLimit(20); }}>
              {t.label}
              <span className="n">{t.count(d)}</span>
            </button>
          ))}
          <span className="label" style={{ marginLeft: "auto", alignSelf: "center", paddingRight: 8 }}>
            Sort: {current.sort === "pot" ? "largest pot" : "newest"}
          </span>
        </div>
        {list.error ? (
          <ErrorNote error={list.error} retry={list.reload} />
        ) : !list.data ? (
          <Skeleton h={200} />
        ) : !list.data.items.length ? (
          <div style={{ marginTop: 16 }}>
            <Empty action={tab === "open" ? <Link className="btn primary" href={`/ask?desk=${d.address}`}>Ask this desk</Link> : undefined}>
              {tab === "open" ? "No open questions right now." : `No ${current.label.toLowerCase()} questions.`}
            </Empty>
          </div>
        ) : (
          <div className="panel" style={{ marginTop: 16 }}>
            {list.data.items.map((q) => (
              <QuestionRow key={q.id} q={q} now={now} />
            ))}
            {list.data.total > list.data.items.length && limit < 50 ? (
              <div className="pad-sm" style={{ textAlign: "center" }}>
                <button className="btn sm" onClick={() => setLimit(50)}>Show more</button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
