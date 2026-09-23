import Link from "next/link";
import type { ReactNode } from "react";
import { addressUrl, txUrl } from "@/lib/config";
import { duration, gen, initials, short } from "@/lib/format";
import type { Question, Status } from "@/lib/types";

const SEAL_LABEL: Partial<Record<Status, string>> = {
  ANSWERED: "Answered",
  DODGED: "Dodged",
  DODGED_ONCE: "Dodged",
  REFUSED: "Refused",
  DECLINED: "Declined",
  EXPIRED: "Expired",
};

export function Seal({ status }: { status: Status }) {
  const label = SEAL_LABEL[status];
  if (!label) return null;
  const cls = status === "DODGED_ONCE" ? "DODGED" : status;
  return (
    <span className={`seal ${cls}`} aria-label={`Verdict: ${label}`}>
      {label}
    </span>
  );
}

export function StatusChip({ q, now, judging }: { q: Question; now: number; judging?: boolean }) {
  const t = now || q.now;
  const left = q.deadline - t;
  switch (q.status) {
    case "OPEN":
      return (
        <span className={`chip open ${left < 12 * 3600 ? "soon" : ""}`}>
          <span className="dot" /> Open · {left > 0 ? `${duration(left)} left` : "closing"}
        </span>
      );
    case "REPLIED":
      return judging ? (
        <span className="chip reading">
          Validators reading<span className="dots" />
        </span>
      ) : (
        <span className="chip">Replied · awaiting judge</span>
      );
    case "DODGED_ONCE":
      return <span className="chip soon">Dodged once · 1 amendment left</span>;
    case "ANSWERED":
      return <span className="chip answered">Answered</span>;
    default:
      return <span className="chip">{q.status.toLowerCase()} · closed</span>;
  }
}

export function Avatar({ name, size = "" }: { name: string; size?: "" | "sm" | "lg" }) {
  return (
    <span className={`avatar ${size}`} aria-hidden>
      {initials(name)}
    </span>
  );
}

export function GEN({ wei, className = "" }: { wei: bigint; className?: string }) {
  return <span className={`mono ${className}`}>{gen(wei)} GEN</span>;
}

export function TxLink({ hash, label }: { hash: string; label?: string }) {
  return (
    <a className="mono" href={txUrl(hash)} target="_blank" rel="noreferrer">
      {label ?? `tx ${short(hash, 6, 3)}`}
    </a>
  );
}

export function AddrLink({ addr, internal }: { addr: string; internal?: string }) {
  if (internal) return <Link className="mono" href={internal}>{short(addr)}</Link>;
  return (
    <a className="mono" href={addressUrl(addr)} target="_blank" rel="noreferrer">
      {short(addr)}
    </a>
  );
}

export function Skeleton({ h = 18, w = "100%" }: { h?: number; w?: number | string }) {
  return <div className="skeleton" style={{ height: h, width: w }} />;
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <p>{children}</p>
      {action ? <div style={{ marginTop: 16 }}>{action}</div> : null}
    </div>
  );
}

export function ErrorNote({ error, retry }: { error: string; retry?: () => void }) {
  return (
    <div className="banner">
      <span className="label">Could not read the chain</span>
      <span className="small muted break" style={{ flex: 1 }}>{error}</span>
      {retry ? <button className="btn sm" onClick={retry}>Retry</button> : null}
    </div>
  );
}
