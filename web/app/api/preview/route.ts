/**
 * Preview verdict, not binding: one model call on the server with the same
 * rubric, so a desk can check a draft before posting. The real verdict only
 * comes from validators. Off unless OPENROUTER_API_KEY and OPENROUTER_MODEL
 * are set; OPENROUTER_BASE_URL must not end in /v1.
 */
import { NextResponse } from "next/server";
import { buildPrompt } from "@/lib/rubric";

const KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_MODEL;
const BASE = (process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api").replace(/\/+$/, "");
const LABELS = ["ANSWERED", "REFUSED", "DODGED"];

export async function GET() {
  return NextResponse.json({ enabled: Boolean(KEY && MODEL) });
}

export async function POST(req: Request) {
  if (!KEY || !MODEL) return NextResponse.json({ error: "Preview is not configured on this deployment." }, { status: 501 });
  let body: { question?: string; context?: string; reply?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const question = String(body.question ?? "").slice(0, 400);
  const context = String(body.context ?? "").slice(0, 1000);
  const reply = String(body.reply ?? "").slice(0, 2000);
  if (!question || !reply) return NextResponse.json({ error: "Question and reply are required." }, { status: 400 });

  const res = await fetch(`${BASE}/v1/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: buildPrompt(question, context, reply) }],
    }),
  });
  if (!res.ok) return NextResponse.json({ error: `Model provider returned ${res.status}.` }, { status: 502 });
  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  const match = text.match(/\{[\s\S]*\}/);
  try {
    const out = JSON.parse(match ? match[0] : text);
    const verdict = String(out.verdict ?? "").trim().toUpperCase();
    if (!LABELS.includes(verdict)) throw new Error("unknown label");
    return NextResponse.json({ verdict, reason: String(out.reason ?? "").slice(0, 200) });
  } catch {
    return NextResponse.json({ error: "The model did not return a usable verdict." }, { status: 502 });
  }
}
