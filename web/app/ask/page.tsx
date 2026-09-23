"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { QuestionCard } from "@/components/Cards";
import TxButton from "@/components/TxButton";
import { Avatar, Empty, ErrorNote, Skeleton } from "@/components/ui";
import { MAX_CONTEXT, MAX_QUESTION } from "@/lib/config";
import { dateUTC, gen, rate, sameAddr, short, toWei } from "@/lib/format";
import { allDesks, reads } from "@/lib/genlayer";
import { useNow, useRead } from "@/lib/hooks";
import type { Desk, Question } from "@/lib/types";
import { useWallet } from "@/lib/wallet";

const PRIVATE = /\b(seed phrase|private key|password|home address|phone number|social security|passport)\b|[\w.+-]+@[\w-]+\.[\w.]+/i;

function hints(text: string) {
  const marks = (text.match(/\?/g) ?? []).length;
  return [
    { label: "One question", ok: text.trim().length > 0 && marks <= 1 },
    { label: "Specific enough to answer", ok: text.trim().length >= 25 },
    { label: "No private data asked", ok: text.trim().length > 0 && !PRIVATE.test(text) },
  ];
}

function amountChips(minFee: bigint): bigint[] {
  const base = minFee > 0n ? minFee : 10n ** 18n;
  return [base, base * 2n, base * 4n, base * 10n];
}

function DeskPicker({ desks, pick }: { desks: Desk[]; pick: (d: Desk) => void }) {
  const [term, setTerm] = useState("");
  const shown = desks.filter((d) => (d.name + d.address + d.topics).toLowerCase().includes(term.toLowerCase())).slice(0, 8);
  return (
    <div className="stack">
      <input className="input" placeholder="Search desks by name, topic or address" value={term} onChange={(e) => setTerm(e.target.value)} />
      <div className="panel">
        {shown.length ? (
          shown.map((d) => {
            const r = rate(d.answered, d.dodged, d.expired);
            return (
              <button key={d.address} className="list-row" style={{ width: "100%", background: "none", border: 0, textAlign: "left", cursor: "pointer", gridTemplateColumns: "auto 1fr auto" }} onClick={() => pick(d)}>
                <Avatar name={d.name} size="sm" />
                <span>
                  {d.name} <span className="tiny muted mono">{short(d.address)}</span>
                </span>
                <span className="tiny mono muted">
                  MIN {gen(d.minFee)} · {d.windowH}H · {r === null ? "no rate yet" : `${r}%`}
                </span>
              </button>
            );
          })
        ) : (
          <p className="pad small muted">No desk matches.</p>
        )}
      </div>
    </div>
  );
}

function Composer() {
  const params = useSearchParams();
  const router = useRouter();
  const w = useWallet();
  const now = useNow();
  const desks = useRead("desks", allDesks);
  const [chosen, setChosen] = useState<string | null>(params.get("desk"));
  const [text, setText] = useState("");
  const [context, setContext] = useState("");
  const [showContext, setShowContext] = useState(false);
  const [amount, setAmount] = useState<string>("");
  const [finding, setFinding] = useState(false);

  const desk = useMemo(() => desks.data?.find((d) => sameAddr(d.address, chosen)) ?? null, [desks.data, chosen]);
  const effectiveAmount = amount || (desk ? gen(desk.minFee, 18).replaceAll(",", "") : "");
  const wei = toWei(effectiveAmount);
  const t = now || Math.floor(Date.now() / 1000);
  const deadline = desk ? t + desk.windowH * 3600 : 0;
  const tooLow = !!desk && wei !== null && wei < desk.minFee;
  const own = !!desk && sameAddr(w.address, desk.address);
  const ready = !!desk && text.trim().length > 0 && text.length <= MAX_QUESTION && context.length <= MAX_CONTEXT && wei !== null && !tooLow && !own;
  const shown = wei !== null ? gen(wei) : "0";

  const preview: Question | null = desk
    ? {
        id: 0, desk: desk.address, deskName: desk.name, asker: w.address ?? "", text: text.trim(), context,
        minFee: desk.minFee, windowH: desk.windowH, askedAt: t, deadline, openingStake: wei ?? 0n, pot: wei ?? 0n,
        backers: 1, status: "OPEN", storedStatus: "OPEN", attempts: 0, reply: "", repliedAt: 0, reason: "",
        decidedAt: 0, paid: false, claimedAt: 0, reclaimed: 0n, now: t, topBackers: [], yourStake: 0n,
        firstReply: "", firstReason: "", rubric: "v1",
      }
    : null;

  async function goToQuestion() {
    if (!desk) return;
    setFinding(true);
    try {
      const page = await reads.questions(desk.address, "OPEN", 0, 10, "new");
      const mine = page.items.find((q) => sameAddr(q.asker, w.address) && q.text === text.trim());
      router.push(mine ? `/q/${mine.id}` : `/d/${desk.address}`);
    } catch {
      router.push(`/d/${desk.address}`);
    }
  }

  if (desks.error) return <ErrorNote error={desks.error} retry={desks.reload} />;

  return (
    <div className="two-col wide-right" style={{ gap: 40 }}>
      <div className="stack-lg">
        <div className="stack">
          <h1 className="section" style={{ fontSize: 34 }}>Ask a question</h1>
          <p className="muted">One question, one desk. Your money comes back unless it is answered.</p>
        </div>

        <section className="stack">
          <span className="label">01 Desk</span>
          {!desks.data ? (
            <Skeleton h={64} />
          ) : !desks.data.length ? (
            <Empty action={<Link className="btn" href="/desk">Open a desk</Link>}>No desks are open yet.</Empty>
          ) : desk ? (
            <div className="panel pad-sm row between wrap-ok">
              <span className="row">
                <Avatar name={desk.name} />
                <span>
                  <span style={{ fontWeight: 500 }}>{desk.name}</span>
                  <span className="tiny mono muted" style={{ display: "block" }}>
                    MIN {gen(desk.minFee)} GEN · REPLIES IN {desk.windowH}H · RATE{" "}
                    {rate(desk.answered, desk.dodged, desk.expired) ?? "–"}
                    {rate(desk.answered, desk.dodged, desk.expired) === null ? "" : "%"}
                  </span>
                </span>
              </span>
              <button className="btn sm" onClick={() => setChosen(null)}>Change</button>
            </div>
          ) : (
            <DeskPicker desks={desks.data} pick={(d) => { setChosen(d.address); setAmount(""); }} />
          )}
          {own ? <p className="error-line">This is your own desk. A desk cannot ask itself.</p> : null}
        </section>

        <section className="stack">
          <span className="label">02 Question</span>
          <textarea
            className="textarea serif-in"
            placeholder="Will the fee cut announced on Sep 10 apply to swaps routed through partner apps?"
            value={text}
            maxLength={MAX_QUESTION + 50}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="hint-row">
            {hints(text).map((h) => (
              <span key={h.label} className={`hint ${h.ok ? "ok" : ""}`}>{h.label}</span>
            ))}
            <span className={`counter ${text.length > MAX_QUESTION ? "over" : ""}`}>
              {text.length} / {MAX_QUESTION}
            </span>
          </div>
          <div className="row wrap-ok tiny muted">
            <span>Hints from the form, not the judge</span>
            <span className="divider-dot" />
            <button className="linkish tiny" onClick={() => setShowContext((s) => !s)}>
              {showContext ? "Remove context" : "+ Add context (optional)"}
            </button>
          </div>
          {showContext ? (
            <>
              <textarea className="textarea" placeholder="What you already know, and why the question matters." value={context} onChange={(e) => setContext(e.target.value)} />
              <span className={`counter ${context.length > MAX_CONTEXT ? "over" : ""}`} style={{ alignSelf: "flex-end" }}>
                {context.length} / {MAX_CONTEXT}
              </span>
            </>
          ) : null}
        </section>

        <section className="stack">
          <span className="label">03 Amount</span>
          <div className="row wrap-ok">
            <input className="input mono" style={{ maxWidth: 180 }} inputMode="decimal" value={effectiveAmount} onChange={(e) => setAmount(e.target.value)} aria-label="Amount in GEN" />
            <span className="mono muted">GEN</span>
            {desk ? (
              <div className="chips-pick">
                {amountChips(desk.minFee).map((c) => (
                  <button key={c.toString()} className={`pick ${wei === c ? "on" : ""}`} onClick={() => setAmount(gen(c, 18).replaceAll(",", ""))}>
                    {gen(c)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {tooLow ? <p className="error-line">This desk asks for at least {gen(desk!.minFee)} GEN.</p> : null}
          {desk ? <p className="tiny muted mono">Deadline {dateUTC(deadline)}</p> : null}
        </section>

        <section className="stack">
          <span className="label">04 Where your {shown} GEN goes</span>
          <div className="outcomes">
            <div><span className="seal ANSWERED">Answered</span></div>
            <div className="small">{shown} GEN goes to {desk?.name ?? "the desk"}</div>
            <div><span className="seal DODGED">Dodged</span></div>
            <div className="small">you reclaim {shown} GEN, after one amendment chance</div>
            <div><span className="seal REFUSED">Refused</span></div>
            <div className="small">you reclaim {shown} GEN</div>
            <div><span className="seal EXPIRED">No reply</span></div>
            <div className="small">you reclaim {shown} GEN after {desk ? dateUTC(deadline, false) : "the deadline"}</div>
          </div>
        </section>

        {finding ? (
          <p className="small muted">Asked. Opening your question...</p>
        ) : (
          <TxButton
            label={`Ask for ${shown} GEN`}
            className="primary lg"
            disabled={!ready}
            request={() => (ready && desk && wei !== null ? { fn: "ask", args: [desk.address, text.trim(), context.trim()], value: wei } : null)}
            pendingText="Posting your question"
            doneText="Asked"
            onSuccess={goToQuestion}
          />
        )}
      </div>

      <aside className="stack" style={{ position: "sticky", top: 88 }}>
        <span className="label">Preview</span>
        {preview ? <QuestionCard q={preview} now={t} preview /> : <Empty>Pick a desk to see your card.</Empty>}
        <p className="tiny muted">This is how the question will look on the desk and on its own page. Questions are public.</p>
      </aside>
    </div>
  );
}

export default function AskPage() {
  return (
    <div className="wrap" style={{ paddingTop: 40 }}>
      <Suspense fallback={<Skeleton h={400} />}>
        <Composer />
      </Suspense>
    </div>
  );
}
