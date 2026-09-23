/**
 * One page of the contract's transactions from the Studio explorer, cached
 * for 15 seconds so every visitor shares one upstream request.
 */
import { NextResponse } from "next/server";
import { CONTRACT, EXPLORER_API } from "@/lib/config";

export async function GET(req: Request) {
  const page = Math.max(1, Math.min(50, Number(new URL(req.url).searchParams.get("page")) || 1));
  try {
    const res = await fetch(`${EXPLORER_API}/transactions?address=${CONTRACT}&limit=100&page=${page}`, {
      next: { revalidate: 15 },
    });
    if (!res.ok) return NextResponse.json({ error: `explorer returned ${res.status}` }, { status: 502 });
    return NextResponse.json(await res.json(), {
      headers: { "cache-control": "public, s-maxage=15, stale-while-revalidate=60" },
    });
  } catch (e) {
    return NextResponse.json({ error: `explorer unreachable: ${(e as Error).message}` }, { status: 502 });
  }
}
