import { GEN } from "./config";

export function big(v: unknown): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(Math.trunc(v));
  if (typeof v === "string" && v.trim() !== "") {
    try {
      return BigInt(v.trim());
    } catch {
      return 0n;
    }
  }
  return 0n;
}

export function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string" && v.trim() !== "") return Number(v);
  return 0;
}

/** 240000000000000000000n -> "240", 1500000000000000000n -> "1.5" */
export function gen(wei: bigint, maxDecimals = 4): string {
  const neg = wei < 0n;
  const abs = neg ? -wei : wei;
  const whole = abs / GEN;
  const frac = abs % GEN;
  let fracStr = frac.toString().padStart(18, "0").slice(0, maxDecimals).replace(/0+$/, "");
  if (whole === 0n && frac > 0n && fracStr === "") fracStr = "0".repeat(maxDecimals - 1) + "1";
  const wholeStr = whole.toLocaleString("en-US");
  return `${neg ? "-" : ""}${wholeStr}${fracStr ? "." + fracStr : ""}`;
}

export function toWei(input: string): bigint | null {
  const s = input.trim();
  if (!/^\d+(\.\d{0,18})?$/.test(s)) return null;
  const [w, f = ""] = s.split(".");
  return BigInt(w) * GEN + BigInt((f + "0".repeat(18)).slice(0, 18));
}

export function short(addr: string, head = 6, tail = 4): string {
  if (!addr) return "";
  if (addr.length <= head + tail + 3) return addr;
  return `${addr.slice(0, head)}...${addr.slice(-tail)}`;
}

export function sameAddr(a?: string | null, b?: string | null): boolean {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

export function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function dateUTC(sec: number, withTime = true): string {
  if (!sec) return "";
  const d = new Date(sec * 1000);
  const base = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  if (!withTime) return base;
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${base}, ${hh}:${mm} UTC`;
}

export function duration(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 72) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function timeLeft(deadline: number, now: number): string {
  const s = deadline - now;
  if (s <= 0) return "closed";
  return `${duration(s)} left`;
}

export function rate(answered: number, dodged: number, expired: number): number | null {
  const denom = answered + dodged + expired;
  if (!denom) return null;
  return Math.round((answered / denom) * 100);
}

export function plural(n: number, one: string, many = one + "s"): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}

export function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}
