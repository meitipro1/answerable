/**
 * Same-origin JSON-RPC relay to the Studio RPC. Browsers on the deployed
 * domain get contract reads (gen_call) blocked by CORS whenever the upstream
 * answers without CORS headers, so the site talks to its own origin and this
 * route forwards server side. Identical contract reads are cached for a few
 * seconds so a page's parallel reads and many visitors share one upstream
 * call. No keys live here; signing stays in the visitor's wallet.
 */
import { NextResponse } from "next/server";
import { RPC_URL } from "@/lib/config";

const CACHEABLE = new Set(["gen_call", "eth_call", "eth_chainId"]);
const TTL_MS = 4000;
const MAX_BODY = 256 * 1024;
const cache = new Map<string, { at: number; result: unknown }>();

type RpcRequest = { jsonrpc?: string; id?: unknown; method?: string; params?: unknown };

async function forward(req: RpcRequest): Promise<Record<string, unknown>> {
  const key = req.method && CACHEABLE.has(req.method) ? JSON.stringify([req.method, req.params]) : "";
  const hit = key ? cache.get(key) : undefined;
  if (hit && Date.now() - hit.at < TTL_MS) return { jsonrpc: "2.0", id: req.id ?? null, result: hit.result };

  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: req.id ?? 1, method: req.method, params: req.params ?? [] }),
    cache: "no-store",
  });
  if (!res.ok) {
    return { jsonrpc: "2.0", id: req.id ?? null, error: { code: res.status === 429 ? -32029 : -32000, message: `Studio RPC returned ${res.status}` } };
  }
  const body = (await res.json()) as Record<string, unknown>;
  if (key && "result" in body && !("error" in body)) {
    if (cache.size > 500) cache.clear();
    cache.set(key, { at: Date.now(), result: body.result });
  }
  return { ...body, id: req.id ?? null };
}

export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > MAX_BODY) return NextResponse.json({ error: "request too large" }, { status: 413 });
  let payload: RpcRequest | RpcRequest[];
  try {
    payload = JSON.parse(text);
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });
  }
  try {
    const out = Array.isArray(payload) ? await Promise.all(payload.map(forward)) : await forward(payload);
    return NextResponse.json(out, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32000, message: `Studio RPC unreachable: ${(e as Error).message}` } }, { status: 502 });
  }
}
