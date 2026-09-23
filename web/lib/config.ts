import deployed from "./deployed.json";

export const CONTRACT = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || deployed.address) as `0x${string}`;
export const CHAIN_ID = 61999;
export const CHAIN_HEX = "0xf22f";
export const CHAIN_NAME = "GenLayer Studio";
export const NETWORK_LABEL = "Studio";
export const NETWORK_SLUG = "studionet";
export const RPC_URL = "https://studio.genlayer.com/api";
export const EXPLORER = "https://explorer-studio.genlayer.com";
export const EXPLORER_API = `${EXPLORER}/api`;
export const STUDIO_URL = "https://studio.genlayer.com";
export const GITHUB_URL = process.env.NEXT_PUBLIC_GITHUB_URL || "https://github.com/meitipro1/answerable";
export const X_URL = "https://x.com/meitipro1";
export const RUBRIC_URL = GITHUB_URL ? `${GITHUB_URL}/blob/main/contracts/answerable.py` : "";

export const GEN = 10n ** 18n;
export const MIN_WINDOW_H = 24;
export const MAX_WINDOW_H = 168;
export const MAX_QUESTION = 400;
export const MAX_CONTEXT = 1000;
export const MAX_REPLY = 2000;
export const MAX_DECLINE = 280;

export const txUrl = (hash: string) => `${EXPLORER}/tx/${hash}`;
export const addressUrl = (addr: string) => `${EXPLORER}/address/${addr}`;
