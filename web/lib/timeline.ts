/**
 * The audit trail. Every write to the contract is a transaction on the
 * Studio explorer; we page through them (through /api/txs, which caches the
 * explorer API), decode the calldata with genlayer-js and match each call to
 * its question.
 */
import { abi } from "genlayer-js";
import { CONTRACT } from "./config";
import { sameAddr } from "./format";
import type { Question } from "./types";

export interface ChainTx {
  hash: string;
  status: string;
  from: string;
  createdAt: number;
  method: string;
  args: unknown[];
  value: bigint;
}

export interface TimelineEvent {
  kind: "ask" | "back" | "reply" | "decline" | "judge" | "claim" | "reclaim";
  tx: ChainTx;
}

/** Consensus still running: the verdict is not decided yet. */
export const IN_FLIGHT = new Set(["PENDING", "PROPOSING", "COMMITTING", "REVEALING", "LEADER_REVEALING", "APPEAL_REVEALING", "APPEAL_COMMITTING"]);

let cache: { at: number; txs: ChainTx[] } | null = null;
let inflight: Promise<ChainTx[]> | null = null;

function decodeCall(b64: unknown): { method: string; args: unknown[] } {
  if (typeof b64 !== "string" || !b64) return { method: "", args: [] };
  try {
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const v = abi.calldata.decode(bytes) as unknown;
    const get = (k: string) => (v instanceof Map ? v.get(k) : (v as Record<string, unknown>)?.[k]);
    const args = get("args");
    return { method: String(get("") ?? get("method") ?? ""), args: Array.isArray(args) ? args : [] };
  } catch {
    return { method: "", args: [] };
  }
}

function toBig(v: unknown): bigint {
  try {
    return BigInt(typeof v === "number" ? Math.trunc(v).toLocaleString("en-US", { useGrouping: false }) : String(v ?? 0));
  } catch {
    return 0n;
  }
}

export async function contractTxs(maxAgeMs = 15000): Promise<ChainTx[]> {
  if (cache && Date.now() - cache.at < maxAgeMs) return cache.txs;
  if (inflight) return inflight;
  inflight = (async () => {
    const out: ChainTx[] = [];
    for (let page = 1; page <= 20; page++) {
      const res = await fetch(`/api/txs?page=${page}`);
      if (!res.ok) break;
      const body = await res.json();
      for (const t of body.transactions ?? []) {
        if (!sameAddr(t.to_address, CONTRACT)) continue;
        const { method, args } = decodeCall(t.data?.calldata);
        out.push({
          hash: t.hash,
          status: String(t.status ?? ""),
          from: String(t.from_address ?? ""),
          createdAt: Math.floor(Date.parse(t.created_at) / 1000),
          method,
          args,
          value: toBig(t.data?.user_value ?? t.value),
        });
      }
      const pg = body.pagination;
      if (!pg || page >= Number(pg.totalPages)) break;
    }
    cache = { at: Date.now(), txs: out };
    return out;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

export function forgetTxCache() {
  cache = null;
}

const QID_METHODS = new Set(["back", "reply", "decline", "judge", "claim", "reclaim"]);

export function questionEvents(txs: ChainTx[], q: Question): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const tx of txs) {
    if (tx.method === "ask") {
      const [desk, text] = tx.args as [string, string];
      if (sameAddr(tx.from, q.asker) && sameAddr(String(desk), q.desk) && String(text).trim() === q.text) {
        events.push({ kind: "ask", tx });
      }
    } else if (QID_METHODS.has(tx.method) && Number(tx.args[0]) === q.id) {
      events.push({ kind: tx.method as TimelineEvent["kind"], tx });
    }
  }
  events.sort((a, b) => a.tx.createdAt - b.tx.createdAt);
  // Only the first matching ask belongs to this question.
  const firstAsk = events.findIndex((e) => e.kind === "ask");
  return events.filter((e, i) => e.kind !== "ask" || i === firstAsk);
}
