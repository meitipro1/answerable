"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { CHAIN_HEX, CHAIN_ID, CHAIN_NAME, EXPLORER, RPC_URL } from "./config";

type Eip1193 = {
  request: (a: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, fn: (...a: unknown[]) => void) => void;
  removeListener?: (event: string, fn: (...a: unknown[]) => void) => void;
};

interface WalletState {
  ready: boolean;
  hasWallet: boolean;
  address: `0x${string}` | null;
  chainId: number | null;
  onNetwork: boolean;
  balance: bigint | null;
  connecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  switchNetwork: () => Promise<void>;
  refreshBalance: () => Promise<void>;
  fundFromStudio: () => Promise<void>;
}

const WalletContext = createContext<WalletState | null>(null);

function eth(): Eip1193 | null {
  if (typeof window === "undefined") return null;
  return ((window as unknown as { ethereum?: Eip1193 }).ethereum ?? null) as Eip1193 | null;
}

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
  const body = await res.json();
  if (body.error) throw new Error(body.error.message || String(body.error));
  return body.result as T;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasWallet = ready && eth() !== null;

  const refreshBalance = useCallback(async () => {
    if (!address) return setBalance(null);
    try {
      setBalance(BigInt(await rpc<string>("eth_getBalance", [address, "latest"])));
    } catch {
      setBalance(null);
    }
  }, [address]);

  useEffect(() => {
    const p = eth();
    setReady(true);
    if (!p) return;
    const onAccounts = (a: unknown) => {
      const list = a as string[];
      setAddress((list?.[0] as `0x${string}`) ?? null);
    };
    const onChain = (c: unknown) => setChainId(parseInt(String(c), 16));
    p.request({ method: "eth_accounts" }).then(onAccounts).catch(() => {});
    p.request({ method: "eth_chainId" }).then(onChain).catch(() => {});
    p.on?.("accountsChanged", onAccounts);
    p.on?.("chainChanged", onChain);
    return () => {
      p.removeListener?.("accountsChanged", onAccounts);
      p.removeListener?.("chainChanged", onChain);
    };
  }, []);

  useEffect(() => {
    refreshBalance();
    if (!address) return;
    const t = setInterval(refreshBalance, 30000);
    return () => clearInterval(t);
  }, [address, refreshBalance]);

  const connect = useCallback(async () => {
    const p = eth();
    setError(null);
    if (!p) {
      setError("No browser wallet found. Install MetaMask or another EVM wallet to ask, back, reply or claim.");
      return;
    }
    setConnecting(true);
    try {
      const list = (await p.request({ method: "eth_requestAccounts" })) as string[];
      setAddress((list?.[0] as `0x${string}`) ?? null);
      setChainId(parseInt(String(await p.request({ method: "eth_chainId" })), 16));
    } catch (e) {
      setError((e as Error)?.message ?? "Could not connect the wallet.");
    } finally {
      setConnecting(false);
    }
  }, []);

  const switchNetwork = useCallback(async () => {
    const p = eth();
    if (!p) return;
    setError(null);
    try {
      await p.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_HEX }] });
    } catch (e) {
      const code = (e as { code?: number })?.code;
      if (code !== 4902 && code !== -32603) {
        setError((e as Error)?.message ?? "Could not switch network.");
        return;
      }
      try {
        await p.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: CHAIN_HEX,
              chainName: CHAIN_NAME,
              rpcUrls: [RPC_URL],
              nativeCurrency: { name: "GEN Token", symbol: "GEN", decimals: 18 },
              blockExplorerUrls: [EXPLORER],
            },
          ],
        });
      } catch (e2) {
        setError((e2 as Error)?.message ?? "Could not add the network.");
      }
    }
  }, []);

  /** Studio networks ship a built-in faucet (the 💧 button in Studio calls
   * sim_fundAccount); this asks it for test GEN for the connected address. */
  const fundFromStudio = useCallback(async () => {
    if (!address) return;
    setError(null);
    try {
      // Studio takes the amount as a JSON number: 100 GEN in wei.
      await rpc("sim_fundAccount", [address, 100e18]);
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 2500));
        const b = BigInt(await rpc<string>("eth_getBalance", [address, "latest"]));
        setBalance(b);
        if (b > 0n) break;
      }
    } catch (e) {
      setError(`The Studio faucet did not answer: ${(e as Error)?.message ?? e}`);
    }
  }, [address]);

  const value = useMemo<WalletState>(
    () => ({
      ready,
      hasWallet,
      address,
      chainId,
      onNetwork: chainId === CHAIN_ID,
      balance,
      connecting,
      error,
      connect,
      switchNetwork,
      refreshBalance,
      fundFromStudio,
    }),
    [ready, hasWallet, address, chainId, balance, connecting, error, connect, switchNetwork, refreshBalance, fundFromStudio],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet outside WalletProvider");
  return ctx;
}
