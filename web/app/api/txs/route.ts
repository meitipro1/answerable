/**
 * One page of the contract's transactions from the Studio explorer, trimmed
 * to what the timeline reads and cached for 15 seconds so every visitor
 * shares one upstream request. The explorer's page carries full consensus
 * data (megabytes); the timeline needs a few fields per transaction.
 */
import { NextResponse } from "next/server";
import { CONTRACT, EXPLORER_API } from "@/lib/config";

type ExplorerTx = {
  hash?: string;
  status?: string;
  from_address?: string;
  to_address?: string;
  created_at?: string;
  value?: unknown;
  data?: { calldata?: string; user_value?: unknown } | null;
};

export async function GET(req: Request) {
  const page = Math.max(1, Math.min(50, Number(new URL(req.url).searchParams.get("page")) || 1));
  try {
    const res = await fetch(`${EXPLORER_API}/transactions?address=${CONTRACT}&limit=100&page=${page}`, {
      next: { revalidate: 15 },
    });
    if (!res.ok) return NextResponse.json({ error: `explorer returned ${res.status}` }, { status: 502 });
    const body = (await res.json()) as { transactions?: ExplorerTx[]; pagination?: unknown };
    const transactions = (body.transactions ?? []).map((t) => ({
      hash: t.hash,
      status: t.status,
      from_address: t.from_address,
      to_address: t.to_address,
      created_at: t.created_at,
      value: typeof t.value === "number" || typeof t.value === "string" ? String(t.value) : "0",
      data: { calldata: t.data?.calldata ?? null, user_value: t.data?.user_value != null ? String(t.data.user_value) : null },
    }));
    return NextResponse.json(
      { transactions, pagination: body.pagination ?? null },
      { headers: { "cache-control": "public, s-maxage=15, stale-while-revalidate=60" } },
    );
  } catch (e) {
    return NextResponse.json({ error: `explorer unreachable: ${(e as Error).message}` }, { status: 502 });
  }
}
