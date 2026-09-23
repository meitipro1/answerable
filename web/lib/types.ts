import { big, num } from "./format";

export type Status =
  | "OPEN"
  | "REPLIED"
  | "DODGED_ONCE"
  | "ANSWERED"
  | "DODGED"
  | "REFUSED"
  | "DECLINED"
  | "EXPIRED";

export const REFUNDABLE: Status[] = ["DODGED", "REFUSED", "DECLINED", "EXPIRED"];
export const LIVE: Status[] = ["OPEN", "REPLIED", "DODGED_ONCE"];

export interface Backer {
  address: string;
  stake: bigint;
}

export interface Question {
  id: number;
  desk: string;
  deskName: string;
  asker: string;
  text: string;
  context: string;
  minFee: bigint;
  windowH: number;
  askedAt: number;
  deadline: number;
  openingStake: bigint;
  pot: bigint;
  backers: number;
  status: Status;
  storedStatus: Status;
  attempts: number;
  reply: string;
  repliedAt: number;
  reason: string;
  decidedAt: number;
  paid: boolean;
  claimedAt: number;
  reclaimed: bigint;
  now: number;
  topBackers: Backer[];
  yourStake: bigint;
  firstReply: string;
  firstReason: string;
  rubric: string;
}

export interface Desk {
  address: string;
  name: string;
  links: string;
  bio: string;
  topics: string;
  minFee: bigint;
  windowH: number;
  openedAt: number;
  asked: number;
  answered: number;
  dodged: number;
  refused: number;
  declined: number;
  expired: number;
  earned: bigint;
  open: number;
  claimable: bigint;
  claimableCount: number;
  distinctAskers: number;
  medianReplyS: number;
  ranked: { answered: number; dodged: number; expired: number; refused: number };
}

export interface Page<T> {
  total: number;
  items: T[];
}

type Raw = Record<string, unknown>;

function field(o: unknown, key: string): unknown {
  if (o instanceof Map) return o.get(key);
  if (o && typeof o === "object") return (o as Raw)[key];
  return undefined;
}

const s = (o: unknown, k: string) => String(field(o, k) ?? "");

export function toQuestion(o: unknown): Question {
  const backers = (field(o, "top_backers") as unknown[] | undefined) ?? [];
  return {
    id: num(field(o, "id")),
    desk: s(o, "desk"),
    deskName: s(o, "desk_name"),
    asker: s(o, "asker"),
    text: s(o, "text"),
    context: s(o, "context"),
    minFee: big(field(o, "min_fee")),
    windowH: num(field(o, "window_h")),
    askedAt: num(field(o, "asked_at")),
    deadline: num(field(o, "deadline")),
    openingStake: big(field(o, "opening_stake")),
    pot: big(field(o, "pot")),
    backers: num(field(o, "backers")),
    status: s(o, "status") as Status,
    storedStatus: s(o, "stored_status") as Status,
    attempts: num(field(o, "attempts")),
    reply: s(o, "reply"),
    repliedAt: num(field(o, "replied_at")),
    reason: s(o, "reason"),
    decidedAt: num(field(o, "decided_at")),
    paid: Boolean(field(o, "paid")),
    claimedAt: num(field(o, "claimed_at")),
    reclaimed: big(field(o, "reclaimed")),
    now: num(field(o, "now")),
    topBackers: backers.map((b) => ({ address: s(b, "address"), stake: big(field(b, "stake")) })),
    yourStake: big(field(o, "your_stake")),
    firstReply: s(o, "first_reply"),
    firstReason: s(o, "first_reason"),
    rubric: s(o, "rubric"),
  };
}

export function toDesk(o: unknown): Desk {
  return {
    address: s(o, "address"),
    name: s(o, "name"),
    links: s(o, "links"),
    bio: s(o, "bio"),
    topics: s(o, "topics"),
    minFee: big(field(o, "min_fee")),
    windowH: num(field(o, "window_h")),
    openedAt: num(field(o, "opened_at")),
    asked: num(field(o, "asked")),
    answered: num(field(o, "answered")),
    dodged: num(field(o, "dodged")),
    refused: num(field(o, "refused")),
    declined: num(field(o, "declined")),
    expired: num(field(o, "expired")),
    earned: big(field(o, "earned")),
    open: num(field(o, "open")),
    claimable: big(field(o, "claimable")),
    claimableCount: num(field(o, "claimable_count")),
    distinctAskers: num(field(o, "distinct_askers")),
    medianReplyS: num(field(o, "median_reply_s")),
    ranked: {
      answered: num(field(o, "ranked_answered")),
      dodged: num(field(o, "ranked_dodged")),
      expired: num(field(o, "ranked_expired")),
      refused: num(field(o, "ranked_refused")),
    },
  };
}

export function toPage<T>(o: unknown, map: (x: unknown) => T): Page<T> {
  const items = (field(o, "items") as unknown[] | undefined) ?? [];
  return { total: num(field(o, "total")), items: items.map(map) };
}
