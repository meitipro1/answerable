"""Seed demo desks and questions across every state, as real transactions.

Every verdict comes from real consensus; nothing is written by hand. The
script reads each question's state on chain and only does what is missing,
so it can be run again after an interruption.

    python scripts/seed.py

States covered: ANSWERED and claimed, ANSWERED and claimable, DODGED once
then amended to ANSWERED, DODGED once (amendment window open), DODGED final
with a reclaim, REFUSED with a reclaim, DECLINED, REPLIED awaiting the judge,
and OPEN questions. An EXPIRED question needs the 24h minimum window to pass:
the Pellmark desk leaves one question unanswered on purpose.

Demo desks use .example links so they never point at a real organisation.
"""

from chain import GEN, accounts, client, deployed_address, fund, log, ok, read, summary, write

PLANS = [
    {
        "key": "orrin",
        "desk": ["Orrin Wallet team", "orrin.example", 5 * GEN, 72,
                 "Self-custody wallet for Ethereum and L2s. Ask us about fees, security and the roadmap. Demo desk.",
                 "fees, security, roadmap"],
        "questions": [
            {
                "text": "Will team tokens unlock before mainnet, and if so, how much?",
                "context": 'The docs say team tokens vest "after launch", but the vesting page shows a cliff marked Q4. Which launch, and how much unlocks first?',
                "ask": ("a", 20), "backs": [("b", 10), ("c", 15), ("d", 5)],
                "replies": ["No. The team allocation has a 12 month cliff that starts at mainnet, planned for January 2027, so nothing unlocks before then. After the cliff, 8% of the team allocation unlocks each quarter. The \"Q4\" label on the vesting page refers to the audit, not the unlock, and we will fix that page this week."],
                "claim": True,
            },
            {
                "text": "Will the fee cut announced on Sep 10 apply to swaps routed through partner apps, or only to swaps made inside Orrin?",
                "ask": ("b", 20), "backs": [("c", 5)],
                "replies": [
                    "Great question! We are always working to make fees fairer for everyone, stay tuned for more.",
                    "Only to swaps made inside Orrin for now. Partner apps set their own fee on top of our router, so the cut reaches them from November 1, when the router contract upgrade ships.",
                ],
            },
            {
                "text": "What happens to user funds if the relayer you run goes offline for a day?",
                "ask": ("c", 60), "backs": [("a", 20), ("d", 12)],
            },
            {
                "text": "Is the seed phrase import audited, and who did the audit?",
                "ask": ("d", 25), "backs": [("a", 8)],
            },
        ],
    },
    {
        "key": "fenwick",
        "desk": ["Fenwick Protocol", "fenwick.example", 2 * GEN, 48,
                 "Lending vaults on L2s. Audits, risk parameters and roadmap. Demo desk.",
                 "audits, vaults, risk"],
        "questions": [
            {
                "text": "Which firm is auditing the v2 vaults, and when is the report due?",
                "ask": ("a", 30), "backs": [("b", 25)],
                "replies": ["Brightline Audits is auditing the v2 vaults, and the final report is due on 30 October. We will publish it the same day."],
            },
            {
                "text": "Who are your market making partners?",
                "ask": ("b", 12), "backs": [("c", 6)],
                "replies": ["We cannot name them: the agreements include confidentiality clauses. We will publish the list if they agree."],
                "reclaim": ["b"],
            },
            {
                "text": "Why did the borrow fee go from 0.3% to 0.5%?",
                "ask": ("c", 8), "backs": [("a", 4)],
                "replies": ["Please read our fee docs."],
            },
            {
                "text": "When will withdrawals from the USDC vault reopen?",
                "ask": ("d", 15), "backs": [("b", 5)],
                "replies": ["Withdrawals reopen on Friday at 14:00 UTC, once the oracle migration is verified on all three chains."],
                "judge": False,
            },
        ],
    },
    {
        "key": "pellmark",
        "desk": ["Pellmark DAO", "pellmark.example", 1 * GEN, 24,
                 "Community treasury and grants. Ask the stewards about spending and governance. Demo desk.",
                 "treasury, grants, governance"],
        "questions": [
            {
                "text": "How much of the treasury was spent on market making in August?",
                "ask": ("a", 15), "backs": [("b", 10), ("c", 5)],
                "replies": [
                    "Our treasury is managed with the long term health of the community in mind, and every decision goes through governance.",
                    "Market making is one of many important tools, and we are proud of the transparency of our process.",
                ],
                "reclaim": ["a", "b"],
            },
            {
                "text": "What are the home addresses of the grant recipients from Q3?",
                "ask": ("d", 3),
                "decline": "Asks for private data about grant recipients. The list of grants and amounts is public in the forum.",
            },
            {
                "text": "How much of the treasury was spent on market making in July?",
                "ask": ("c", 9), "backs": [("d", 4)],
            },
        ],
    },
]


REFUNDABLE = ("DODGED", "REFUSED", "DECLINED", "EXPIRED")


def run_desk(address: str, plan: dict) -> None:
    """Drive each planned question to its target state from whatever state it
    is in on chain now, so an interrupted seed can simply be run again."""
    names = [f"seed_{plan['key']}_desk"] + [f"seed_{plan['key']}_{x}" for x in "abcd"]
    acc = accounts(*names)
    desk = acc[names[0]]
    people = {x: acc[f"seed_{plan['key']}_{x}"] for x in "abcd"}
    cd = client(desk)
    cp = {x: client(a) for x, a in people.items()}
    tag = f"[{plan['key']}]"

    def say(*parts):
        log(tag, *parts)

    def tx(c, who, fn, args, value=0):
        h, r = write(c, who, address, fn, args, value=value)
        h = h if isinstance(h, str) else h.hex()
        if not ok(r):
            raise RuntimeError(f"{fn} failed ({summary(r)}) tx {h}")
        return h

    def question(qid: int, viewer: str = "") -> dict:
        return read(cd, address, "get_question", [qid, viewer])

    try:
        read(cd, address, "get_desk", [desk.address])
    except Exception:  # noqa: BLE001 - no desk yet
        say("opening desk", plan["desk"][0])
        tx(cd, desk, "open_desk", plan["desk"])

    existing = {q["text"]: int(q["id"]) for q in read(cd, address, "list_questions", [desk.address, "", 0, 50, "new"])["items"]}

    for spec in plan["questions"]:
        who, amount = spec["ask"]
        asker = people[who]
        qid = existing.get(spec["text"])
        if qid is None:
            tx(cp[who], asker, "ask", [desk.address, spec["text"], spec.get("context", "")], value=amount * GEN)
            page = read(cd, address, "list_questions", [desk.address, "OPEN", 0, 10, "new"])
            qid = next(int(q["id"]) for q in page["items"] if q["text"] == spec["text"])
            say(f"Q#{qid} asked: {spec['text'][:50]}")
        q = question(qid)

        if q["status"] == "OPEN":
            for b, amt in spec.get("backs", []):
                if int(question(qid, people[b].address)["your_stake"]) == 0:
                    tx(cp[b], people[b], "back", [qid], value=amt * GEN)
            q = question(qid)

        if "decline" in spec:
            if q["status"] == "OPEN":
                tx(cd, desk, "decline", [qid, spec["decline"]])
                say(f"Q#{qid} declined")
            continue

        replies = spec.get("replies", [])
        for _ in range(3 * len(replies)):  # reply and judge per attempt, with room for one re-judge
            q = question(qid)
            status, attempts = q["status"], int(q["attempts"])
            if status == "OPEN" or (status == "DODGED_ONCE" and attempts < len(replies)):
                tx(cd, desk, "reply", [qid, replies[attempts]])
                continue
            if status == "REPLIED":
                if spec.get("judge", True) is False:
                    say(f"Q#{qid} replied, left for the judge")
                    break
                h = tx(cp[who], asker, "judge", [qid])
                say(f"Q#{qid} attempt {attempts}: {question(qid)['status']} (tx {h})")
                continue
            break

        q = question(qid)
        if spec.get("claim") and q["status"] == "ANSWERED" and not q["paid"]:
            tx(cd, desk, "claim", [qid])
            say(f"Q#{qid} claimed by the desk")
        for r in spec.get("reclaim", []):
            if q["status"] in REFUNDABLE and int(question(qid, people[r].address)["your_stake"]) > 0:
                tx(cp[r], people[r], "reclaim", [qid])
                say(f"Q#{qid} reclaimed by {r}")
        say(f"Q#{qid} now {question(qid)['status']}")


def main() -> None:
    address = deployed_address()
    funder = client(accounts("deployer")["deployer"])
    for plan in PLANS:
        for name, acct in accounts(*([f"seed_{plan['key']}_desk"] + [f"seed_{plan['key']}_{x}" for x in "abcd"])).items():
            fund(funder, acct.address, 200 * GEN, minimum=100 * GEN)
    log(f"seeding {address}")
    # One lane keeps nonces simple and stays gentle on the public RPC.
    for plan in PLANS:
        run_desk(address, plan)
    log("seed done")


if __name__ == "__main__":
    main()
