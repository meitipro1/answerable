/**
 * genlayer-js 1.1.8 wiring for GenLayer Studio (Studionet, chain 61999).
 * Reads need no wallet and go through the site's /api/rpc relay. Writes are signed by the
 * injected wallet (EIP-1193). Studio is gasless, so a write costs only the
 * value it carries.
 */
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import { CONTRACT, EXPLORER, rpcEndpoint } from "./config";
import { toDesk, toPage, toQuestion, type Desk, type Page, type Question } from "./types";

type Args = Parameters<ReturnType<typeof createClient>["readContract"]>[0]["args"];
export type TxKind = "write" | "judge";

/** The SDK's studionet preset, pointed at the site's RPC relay and the
 * explorer that serves Studio. Wallet networks keep the real RPC URL. */
function chain() {
  return {
    ...studionet,
    rpcUrls: { default: { http: [rpcEndpoint()] } },
    blockExplorers: { default: { name: "GenLayer Studio Explorer", url: EXPLORER } },
  } as typeof studionet;
}

let reader: ReturnType<typeof createClient> | null = null;

export function readClient() {
  if (!reader) reader = createClient({ chain: chain() });
  return reader;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Rate limits and network blips; reads are idempotent, so both are safe to retry. */
function transient(err: unknown): boolean {
  const msg = String((err as Error)?.message ?? err);
  return ["-32029", "Rate limit", "429", "Failed to fetch", "fetch failed", "NetworkError", "timed out"].some((s) => msg.includes(s));
}

/** Back off and retry transient read failures. */
async function view(functionName: string, args: Args): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await readClient().readContract({ address: CONTRACT, functionName, args });
    } catch (e) {
      if (!transient(e) || attempt >= 3) throw e;
      await sleep(4000 * (attempt + 1));
    }
  }
}

/** Studio reports a view that rolled back only as "execution failed", without
 * the contract's message. For a lookup by id or address that means not found. */
async function lookup(functionName: string, args: Args, what: string): Promise<unknown> {
  try {
    return await view(functionName, args);
  } catch (e) {
    if (String((e as Error)?.message ?? e).includes("execution failed")) throw new Error(`${what} not found`);
    throw e;
  }
}

export const reads = {
  desk: async (addr: string): Promise<Desk> => toDesk(await lookup("get_desk", [addr], "desk")),
  desks: async (offset = 0, limit = 50): Promise<Page<Desk>> =>
    toPage(await view("list_desks", [offset, limit]), toDesk),
  question: async (id: number, viewer = ""): Promise<Question> => toQuestion(await lookup("get_question", [id, viewer], "question")),
  questions: async (desk: string, status: string, offset: number, limit: number, sort: "new" | "pot" | "decided") =>
    toPage(await view("list_questions", [desk, status, offset, limit, sort]), toQuestion),
};

/** Every desk, paging through list_desks (the contract caps pages at 50). */
export async function allDesks(): Promise<Desk[]> {
  const out: Desk[] = [];
  for (let offset = 0; offset < 1000; offset += 50) {
    const page = await reads.desks(offset, 50);
    out.push(...page.items);
    if (out.length >= page.total || page.items.length === 0) break;
  }
  return out;
}

// ------------------------------------------------------------------ writes

type Eip1193 = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };

function provider(): Eip1193 {
  const eth = (globalThis as unknown as { ethereum?: Eip1193 }).ethereum;
  if (!eth) throw new Error("No browser wallet found. Install MetaMask or another EVM wallet.");
  return eth;
}

function walletClient(account: `0x${string}`) {
  return createClient({ chain: chain(), account, provider: provider() as never });
}

export interface TxRequest {
  fn: string;
  args: Args;
  value?: bigint;
  kind?: TxKind;
}

/** What a write costs on top of its value. Studio is gasless. */
export interface Quote {
  fee: bigint;
}

export async function quote(): Promise<Quote> {
  return { fee: 0n };
}

export async function sendTx(account: `0x${string}`, req: TxRequest): Promise<`0x${string}`> {
  const hash = await walletClient(account).writeContract({
    address: CONTRACT,
    functionName: req.fn,
    args: req.args,
    value: req.value ?? 0n,
  });
  return hash as `0x${string}`;
}

export interface TxOutcome {
  ok: boolean;
  status: string;
  /** The contract's own message when it rolled back, e.g. "EXPECTED: ...". */
  error: string;
}

type Receipt = {
  status_name?: string;
  result_name?: string;
  consensus_data?: { leader_receipt?: unknown };
};

function leader(receipt: Receipt): { execution_result?: string; result?: { status?: string; payload?: unknown } } {
  const lr = receipt.consensus_data?.leader_receipt;
  return ((Array.isArray(lr) ? lr[0] : lr) ?? {}) as ReturnType<typeof leader>;
}

export async function waitTx(hash: `0x${string}`): Promise<TxOutcome> {
  const receipt = (await readClient().waitForTransactionReceipt({
    hash: hash as never,
    status: TransactionStatus.ACCEPTED,
    interval: 5000,
    retries: 120,
  })) as unknown as Receipt;
  const l = leader(receipt);
  const status = String(receipt.status_name ?? "");
  const executed = !l.execution_result || l.execution_result === "SUCCESS";
  const ok = (status === "ACCEPTED" || status === "FINALIZED") && executed;
  const payload = l.result?.payload;
  return {
    ok,
    status: `${status}${receipt.result_name ? ` / ${receipt.result_name}` : ""}`,
    error: ok ? "" : typeof payload === "string" ? payload : l.execution_result ?? "",
  };
}

/** Pull a readable message out of a wallet, SDK or contract error. */
export function errorText(err: unknown): string {
  const e = err as { shortMessage?: string; message?: string; code?: number };
  if (e?.code === 4001) return "You rejected the request in your wallet.";
  const msg = typeof err === "string" ? err : e?.shortMessage || e?.message || String(err);
  const expected = msg.match(/EXPECTED: ([^"'\n]+)/);
  if (expected) return expected[1];
  return msg.length > 220 ? msg.slice(0, 220) + "..." : msg;
}
