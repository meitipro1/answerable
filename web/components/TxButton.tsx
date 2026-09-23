"use client";

import { useEffect, useRef, useState } from "react";
import { CHAIN_ID, NETWORK_LABEL } from "@/lib/config";
import { gen } from "@/lib/format";
import { errorText, quote, sendTx, waitTx, type Quote, type TxRequest } from "@/lib/genlayer";
import { forgetTxCache } from "@/lib/timeline";
import { useWallet } from "@/lib/wallet";
import { TxLink } from "./ui";

type Phase =
  | { k: "idle" }
  | { k: "estimating" }
  | { k: "confirm"; quote: Quote }
  | { k: "signing" }
  | { k: "pending"; hash: `0x${string}` }
  | { k: "done"; hash: `0x${string}` }
  | { k: "failed"; msg: string; hash?: `0x${string}` };

interface Props {
  label: string;
  request: () => TxRequest | null;
  disabled?: boolean;
  className?: string;
  /** Shown while consensus runs. */
  pendingText?: string;
  doneText?: string;
  onSuccess?: (hash: `0x${string}`) => void;
  onSubmitted?: (hash: `0x${string}`) => void;
  /** Estimate as soon as it mounts, so the next step is one signature. */
  autoStart?: boolean;
}

/**
 * Every write goes through here: wallet and network checks, what it costs
 * shown before signing, then submitted, pending and decided or failed states,
 * each with its transaction link.
 */
export default function TxButton({
  label,
  request,
  disabled,
  className = "primary",
  pendingText = "Submitted, waiting for consensus",
  doneText = "Done",
  onSuccess,
  onSubmitted,
  autoStart,
}: Props) {
  const w = useWallet();
  const [phase, setPhase] = useState<Phase>({ k: "idle" });
  const started = useRef(false);

  const req = request();
  const value = req?.value ?? 0n;
  const canWrite = !!w.address && w.onNetwork;

  useEffect(() => {
    if (autoStart && canWrite && !started.current) {
      started.current = true;
      estimate();
    }
  }, [autoStart, canWrite]);

  if (!w.address) {
    return (
      <div className="stack">
        <button className={`btn ${className}`} onClick={w.connect} disabled={w.connecting}>
          {w.connecting ? "Connecting..." : "Connect wallet"}
        </button>
        {w.error ? <p className="error-line">{w.error}</p> : null}
      </div>
    );
  }
  if (!w.onNetwork) {
    return (
      <div className="stack">
        <button className={`btn ${className}`} onClick={w.switchNetwork}>
          Switch to {NETWORK_LABEL} ({CHAIN_ID})
        </button>
        <p className="tiny muted">Your wallet is on chain {w.chainId ?? "unknown"}. Answerable runs on {NETWORK_LABEL} only.</p>
        {w.error ? <p className="error-line">{w.error}</p> : null}
      </div>
    );
  }
  if (w.balance !== null && w.balance === 0n) {
    return (
      <div className="stack">
        <button className={`btn ${className}`} onClick={w.fundFromStudio}>
          Get test GEN
        </button>
        <p className="tiny muted">This wallet has no GEN on {NETWORK_LABEL}. The Studio faucet sends test GEN for free.</p>
        {w.error ? <p className="error-line">{w.error}</p> : null}
      </div>
    );
  }

  async function estimate() {
    const r = request();
    if (!r || !w.address) return;
    setPhase({ k: "estimating" });
    try {
      setPhase({ k: "confirm", quote: await quote() });
    } catch (e) {
      setPhase({ k: "failed", msg: errorText(e) });
    }
  }

  async function sign() {
    const r = request();
    if (!r || !w.address) return;
    setPhase({ k: "signing" });
    let hash: `0x${string}` | undefined;
    try {
      hash = await sendTx(w.address, r);
      setPhase({ k: "pending", hash });
      onSubmitted?.(hash);
      const out = await waitTx(hash);
      forgetTxCache();
      w.refreshBalance();
      if (!out.ok) {
        setPhase({ k: "failed", hash, msg: out.error ? errorText(out.error) : `Transaction did not succeed (${out.status}).` });
        return;
      }
      setPhase({ k: "done", hash });
      onSuccess?.(hash);
    } catch (e) {
      setPhase({ k: "failed", hash, msg: errorText(e) });
    }
  }

  const short = w.balance !== null && w.balance < value;

  switch (phase.k) {
    case "estimating":
      return <button className={`btn ${className}`} disabled>Preparing...</button>;
    case "confirm": {
      const total = value + phase.quote.fee;
      const cantPay = w.balance !== null && w.balance < total;
      return (
        <div className="panel pad-sm stack">
          <div className="row between small">
            <span className="muted">Network fee</span>
            <span className="mono">{phase.quote.fee > 0n ? `${gen(phase.quote.fee, 6)} GEN` : `none, ${NETWORK_LABEL} is gasless`}</span>
          </div>
          {value > 0n ? (
            <div className="row between small">
              <span className="muted">Total from your wallet</span>
              <span className="mono">{gen(total, 6)} GEN</span>
            </div>
          ) : null}
          {cantPay ? <p className="error-line">Not enough GEN for this. Get test GEN from the Studio faucet first.</p> : null}
          <div className="row">
            <button className={`btn ${className}`} disabled={cantPay} onClick={sign}>
              Sign in wallet
            </button>
            <button className="btn ghost" onClick={() => setPhase({ k: "idle" })}>Cancel</button>
            {cantPay ? <button className="btn sm" onClick={w.fundFromStudio}>Get test GEN</button> : null}
          </div>
        </div>
      );
    }
    case "signing":
      return <button className={`btn ${className}`} disabled>Confirm in your wallet...</button>;
    case "pending":
      return (
        <div className="panel pad-sm stack" role="status">
          <span className="chip reading">
            {pendingText}
            <span className="dots" />
          </span>
          <p className="tiny muted">
            Submitted as <TxLink hash={phase.hash} />. Consensus on {NETWORK_LABEL} usually takes under a minute.
          </p>
        </div>
      );
    case "done":
      return (
        <div className="panel pad-sm row wrap-ok" role="status">
          <span className="chip">{doneText}</span>
          <span className="tiny muted">
            <TxLink hash={phase.hash} />
          </span>
          <button className="btn ghost sm" onClick={() => setPhase({ k: "idle" })}>OK</button>
        </div>
      );
    case "failed":
      return (
        <div className="panel pad-sm stack" role="alert">
          <p className="error-line break">{phase.msg}</p>
          {phase.hash ? (
            <p className="tiny muted">
              <TxLink hash={phase.hash} />
            </p>
          ) : null}
          <div className="row">
            <button className="btn sm" onClick={estimate}>Retry</button>
            <button className="btn ghost sm" onClick={() => setPhase({ k: "idle" })}>Dismiss</button>
          </div>
        </div>
      );
    default:
      return (
        <div className="stack">
          <button className={`btn ${className}`} disabled={disabled || !req} onClick={estimate}>
            {label}
          </button>
          {short ? <p className="error-line">Your wallet holds less GEN than this needs.</p> : null}
        </div>
      );
  }
}
