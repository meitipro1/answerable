"use client";

import Link from "next/link";
import { Avatar, Empty, ErrorNote, Skeleton } from "@/components/ui";
import { duration, gen, rate } from "@/lib/format";
import { allDesks } from "@/lib/genlayer";
import { useRead } from "@/lib/hooks";
import type { Desk } from "@/lib/types";

const MIN_JUDGED = 5;

function judged(d: Desk) {
  const r = d.ranked;
  return r.answered + r.dodged + r.expired + r.refused;
}

function rankedRate(d: Desk) {
  return rate(d.ranked.answered, d.ranked.dodged, d.ranked.expired);
}

function Row({ d, i }: { d: Desk; i?: number }) {
  const r = rankedRate(d);
  return (
    <tr>
      <td className="mono muted">{i === undefined ? "–" : i + 1}</td>
      <td>
        <Link href={`/d/${d.address}`} className="row">
          <Avatar name={d.name} size="sm" />
          <span>{d.name}</span>
        </Link>
      </td>
      <td className="num" style={{ fontSize: 18 }}>{r === null ? "–" : `${r}%`}</td>
      <td className="num">{d.distinctAskers}</td>
      <td className="num">{d.ranked.answered}</td>
      <td className="num">{d.ranked.dodged}</td>
      <td className="num">{d.ranked.expired}</td>
      <td className="num">{d.ranked.refused}</td>
      <td className="num">{d.declined}</td>
      <td className="num">{gen(d.earned, 2)}</td>
      <td className="num">{d.medianReplyS ? duration(d.medianReplyS) : "–"}</td>
    </tr>
  );
}

function Table({ desks, ranked }: { desks: Desk[]; ranked: boolean }) {
  return (
    <div className="panel table-scroll">
      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Desk</th>
            <th style={{ textAlign: "right" }}>Rate</th>
            <th style={{ textAlign: "right" }}>Distinct askers</th>
            <th style={{ textAlign: "right" }}>Answered</th>
            <th style={{ textAlign: "right" }}>Dodged</th>
            <th style={{ textAlign: "right" }}>Expired</th>
            <th style={{ textAlign: "right" }}>Refused</th>
            <th style={{ textAlign: "right" }}>Declined</th>
            <th style={{ textAlign: "right" }}>GEN earned</th>
            <th style={{ textAlign: "right" }}>Median reply</th>
          </tr>
        </thead>
        <tbody>
          {desks.map((d, i) => (
            <Row key={d.address} d={d} i={ranked ? i : undefined} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Leaderboard() {
  const { data, error, reload } = useRead("leaderboard", allDesks, 60000);

  const ranked = (data ?? [])
    .filter((d) => judged(d) >= MIN_JUDGED)
    .sort((a, b) => (rankedRate(b) ?? -1) - (rankedRate(a) ?? -1) || b.distinctAskers - a.distinctAskers);
  const rest = (data ?? []).filter((d) => judged(d) < MIN_JUDGED).sort((a, b) => judged(b) - judged(a));

  return (
    <div className="wrap stack-lg" style={{ paddingTop: 40 }}>
      <div className="stack">
        <h1 className="section" style={{ fontSize: 34 }}>Leaderboard</h1>
        <p className="muted" style={{ maxWidth: 760 }}>
          Desks with at least {MIN_JUDGED} judged questions, ranked by straight-answer rate: answered ÷ (answered + dodged +
          expired). Only questions backed by two or more distinct addresses count here, so a desk cannot farm its rate
          by asking itself. Refusals and declines are shown and never lower the rate.
        </p>
      </div>
      {error ? (
        <ErrorNote error={error} retry={reload} />
      ) : !data ? (
        <Skeleton h={260} />
      ) : (
        <>
          {ranked.length ? <Table desks={ranked} ranked /> : <Empty>No desk has {MIN_JUDGED} qualifying judged questions yet.</Empty>}
          {rest.length ? (
            <div className="stack">
              <span className="label">Not ranked yet</span>
              <Table desks={rest} ranked={false} />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
