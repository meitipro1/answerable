"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CHAIN_ID, NETWORK_LABEL } from "@/lib/config";
import { gen, short } from "@/lib/format";
import { useWallet } from "@/lib/wallet";

const LINKS = [
  { href: "/desk", label: "Your desk" },
  { href: "/#desks", label: "Desks" },
  { href: "/#questions", label: "Questions" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/#how", label: "How it works" },
];

export default function Navbar() {
  const path = usePathname();
  const w = useWallet();
  const [open, setOpen] = useState(false);

  return (
    <header className="nav">
      <div className="wrap">
        <Link href="/" className="wordmark" onClick={() => setOpen(false)}>
          <span className="glyph">?</span>
          answerable
        </Link>
        <nav className={`nav-links ${open ? "open" : ""}`} aria-label="Main">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={path === l.href ? "active" : ""} onClick={() => setOpen(false)}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="nav-right">
          {w.address && !w.onNetwork ? (
            <button className="pill warn" onClick={w.switchNetwork} title={`Switch to chain ${CHAIN_ID}`}>
              Wrong network · switch
            </button>
          ) : (
            <span className="pill hide-sm" title={`Chain ${CHAIN_ID}`}>
              <span className="dot" />
              {NETWORK_LABEL}
            </span>
          )}
          {w.address ? (
            <span className="pill hide-sm" title={w.address}>
              {w.balance !== null ? `${gen(w.balance, 2)} GEN · ` : ""}
              {short(w.address)}
            </span>
          ) : (
            <button className="btn sm" onClick={w.connect} disabled={w.connecting}>
              {w.connecting ? "Connecting..." : "Connect wallet"}
            </button>
          )}
          <Link href="/ask" className="btn sm primary hide-sm">
            Ask a question
          </Link>
          <button className="btn sm menu-btn" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            Menu
          </button>
        </div>
      </div>
    </header>
  );
}
