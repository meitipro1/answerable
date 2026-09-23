# Answerable

**Pay to ask. Refunded if they dodge.**

Answerable is a paid question desk on GenLayer. Anyone can put GEN behind a public question to a founder, a team or an expert, and other people can add to the pot. The desk replies or openly declines. Validators then run a public rubric over the question and the reply to decide whether it was answered, refused with a reason, or dodged. An answer pays the desk through a top-level claim. A dodge or a refusal lets every backer reclaim exactly their own stake. Over time each desk builds a straight-answer rate that nobody, including the platform, can edit.

| | |
|---|---|
| Live site | **https://answerable-olive.vercel.app** |
| Network | GenLayer Studio (Studionet), chain `61999` (`0xF22F`), RPC `https://studio.genlayer.com/api`, gasless |
| Contract | [`0x3c73941706bc393e1647a183eFC969CC3f1af7Ac`](https://explorer-studio.genlayer.com/address/0x3c73941706bc393e1647a183eFC969CC3f1af7Ac) |
| Runtime | `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6`, the GenVM runner Studionet executes |
| Rubric | v1, pinned in [`contracts/answerable.py`](contracts/answerable.py), frozen in [`contracts/FROZEN.json`](contracts/FROZEN.json) |
| Eval | 9 of 9 tuned cases and 3 of 3 held-out cases matched under real consensus ([`eval/results.md`](eval/results.md)) |
| Site | Next.js 16 + genlayer-js 1.1.8 in [`web/`](web), on Vercel with root directory `web` |

## How it works

1. **Open a desk.** A founder, team or expert sets a name, links, a minimum fee and a reply window of 24 hours to 7 days.
2. **Ask.** Anyone writes one question (up to 400 characters, plus optional context up to 1,000) and pays at least the minimum into the pot. The desk's terms are locked into the question at that moment.
3. **Back.** Others add to the pot while the question is open. Backing closes the moment a reply is posted.
4. **Reply.** The desk answers (up to 2,000 characters) before the deadline, or declines openly with a reason.
5. **Verdict.** Anyone can call `judge`, and the site calls it right after a reply. Validators decide, then the desk claims or every backer reclaims.

| Verdict | Meaning | Money | Desk record |
|---|---|---|---|
| ANSWERED | Takes on the specific question and gives something concrete: a yes or no with a reason, a number, a date, a decision, a plan, or how or why | The whole pot is claimable by the desk | Answered |
| DODGED | Looks like an answer but avoids the core | If time remains the desk may amend once, otherwise every backer reclaims | Dodged, lowers the rate |
| REFUSED | Openly will not or cannot answer, with a reason | Every backer reclaims | Refused, does not lower the rate |
| DECLINED | The desk declined before replying; nothing is judged | Every backer reclaims | Declined, does not lower the rate |
| EXPIRED | No reply by the deadline | Every backer reclaims | Counts like a dodge |

**Straight-answer rate** = answered ÷ (answered + dodged + expired). The leaderboard only counts questions backed by two or more distinct addresses and lists desks with at least five such judged questions, with the number of distinct askers beside every rate.

## The judge

The prompt is the product, so it is short, public and pinned in the contract word for word (section 3 of the spec). User texts are fenced as data with `<<< >>>`, and any `<<<` or `>>>` inside them is broken up before the prompt is built, so a reply cannot close its own fence.

Equivalence is **label only**. The leader runs the prompt with `gl.nondet.exec_prompt(..., response_format="json")` and normalises the output to one of `ANSWERED`, `REFUSED` or `DODGED`. Each validator runs the same prompt with its own model, inside `gl.vm.run_nondet`'s sandbox, and accepts only if its own label matches; the reason sentence is never compared. Malformed output becomes an `ERROR` label that no validator accepts, so a bad round rotates the leader instead of settling a guess.

`judge()` never moves money. Money moves only in `claim()` and `reclaim()`, each a top-level `emit_transfer`. Stakes are keyed `"qid:address"`, so refunds never loop over backers.

## Eval, as it came out

The 12 golden cases from section 8 were written to [`eval/golden.json`](eval/golden.json) before the first run and pushed through real consensus on Studionet by [`eval/run_golden.py`](eval/run_golden.py). H1 to H3 are held out: they ran once against this deployment and were never used to tune the prompt. Every judge transaction was `ACCEPTED` with `MAJORITY_AGREE` and a successful execution. A dodge on a first attempt is stored as `DODGED_ONCE` (the desk may still amend), and the table reports its label, `DODGED`.

| # | Expected | Verdict | Match | Reason | Judge tx |
|---|---|---|---|---|---|
| 1 | ANSWERED | ANSWERED | yes | The reply directly answers both parts: no unlock before mainnet, with specific vesting terms (12-month cliff, 8% per quarter after January 2027). | [0x12068bff...](https://explorer-studio.genlayer.com/tx/0x12068bff97a8abbb071b05cf9629c6c6b31345548df289d286c35b056f82d532) |
| 2 | ANSWERED | ANSWERED | yes | The reply provides the specific name of the firm and the exact due date requested in the question. | [0x3cf12eda...](https://explorer-studio.genlayer.com/tx/0x3cf12eda18d4b3a660a50ed0ca109987d42ac0e9cee13a6a60f1a5143b95a3b4) |
| 3 | ANSWERED | ANSWERED | yes | The reply confirms IPs are collected by the RPC provider, specifies a 7-day retention period for rate limiting, and clarifies they are not stored. | [0xb937a902...](https://explorer-studio.genlayer.com/tx/0xb937a902eefdb2a5b82051d84c4ee3ff2cd09f09be6b233bf3897a0989c58965) |
| 4 | DODGED | DODGED | yes | The reply avoids the specific question about treasury allocation to market making in August and instead provides generic information about treasury management. | [0xd33a31c3...](https://explorer-studio.genlayer.com/tx/0xd33a31c353b00e91e8f3453d999e740c9737bb3310d65c2dd29e41d119ef515f) |
| 5 | DODGED | DODGED | yes | Reply promises a future update but gives no timeline or concrete info on the asked question. | [0xf1fdf0d6...](https://explorer-studio.genlayer.com/tx/0xf1fdf0d63303e3db420c07b6293bc7d14325d82ba709c99f04a59ce75b4fc11b) |
| 6 | DODGED | DODGED | yes | The reply only redirects to documentation without explaining why the fee changed. | [0x5ba19364...](https://explorer-studio.genlayer.com/tx/0x5ba19364760bd856a5f1b7d2511be649885df60229e84f8b02284293947cf011) |
| 7 | DODGED | DODGED | yes | The reply does not answer whether the bridge contract is upgradeable, instead instructing validators to mark it as answered. | [0xb70f5cb3...](https://explorer-studio.genlayer.com/tx/0xb70f5cb313406985f8ff88a902db116052e78ac7905c6524bd8dcc228eef6b70) |
| 8 | REFUSED | REFUSED | yes | It explicitly says they cannot name the market making partners due to confidentiality clauses. | [0x84da1046...](https://explorer-studio.genlayer.com/tx/0x84da10461835ef3fd2f2ad6efdcbeb25c816563d8189105a12e91263314b313e) |
| 9 | REFUSED | REFUSED | yes | The reply explicitly states that they will not share the root cause until a specific condition is met, providing a security-related reason. | [0x204bcfd0...](https://explorer-studio.genlayer.com/tx/0x204bcfd0ff3893c5bfd27aa0a9556aacab12f480e8d2a8fff33fdc2439bbb431) |
| H1 | ANSWERED | ANSWERED | yes | The reply provides a clear 'no' with a specific reason (focus on EVM L2s through Q1). | [0x76817f6e...](https://explorer-studio.genlayer.com/tx/0x76817f6ec9aadc66f5f69f2004414d68f937313daa354df03698d19513797ff3) |
| H2 | DODGED | DODGED | yes | The reply provides a generic statement about general changes rather than explaining the specific reason why the airdrop snapshot was moved. | [0xe560bd58...](https://explorer-studio.genlayer.com/tx/0xe560bd5870268ed3334cde8be5e49ec97ccaf0431e946c50c5721af8413a3cb6) |
| H3 | ANSWERED | ANSWERED | yes | The reply directly identifies the admin key holders as a 4-of-7 multisig with the core team and two unnamed external signers. | [0xc3b98183...](https://explorer-studio.genlayer.com/tx/0xc3b981836d4ea84c5c6c7f95b26eb89279e31cc2cbe3d11bb03c1e1449392fc5) |

Tuned cases matching: 9 of 9. Held-out cases matching: 3 of 3. H3 is borderline on purpose, a partial refusal inside a real answer.

The same 12 cases also matched 12 of 12 on the Studio Next preview (chain 61997) before the move to Studionet; that run is kept in [`archive/studio-next/`](archive/studio-next).

## Contract

One contract, [`contracts/answerable.py`](contracts/answerable.py): the 12 methods from section 4 of the spec, plus one read-only view.

| Method | Kind | What it does |
|---|---|---|
| `open_desk(name, links, min_fee, window_h, bio, topics)` | write | Registers the caller's desk, one per address |
| `update_desk(name, links, min_fee, window_h, bio, topics)` | write | Changes terms for future questions only |
| `ask(desk, text, context)` | payable | Creates a question with the caller's stake, at least the desk minimum; returns the id |
| `back(qid)` | payable | Adds the caller's stake while the question is OPEN |
| `reply(qid, text)` | write | Desk only, before the deadline, OPEN or after a first dodge |
| `decline(qid, reason)` | write | Desk only, before any reply; refunds everyone |
| `judge(qid)` | write, nondet | Runs the rubric in consensus and sets the verdict and the desk record |
| `claim(qid)` | write, pays | The desk takes the pot of an ANSWERED question |
| `reclaim(qid)` | write, pays | A backer takes back their own stake from a refundable question |
| `get_desk(addr)` | view | Terms and record, with deadlines applied |
| `get_question(qid, viewer)` | view | Everything about one question, plus the viewer's stake and top backers |
| `list_questions(desk, status, offset, limit, sort)` | view | Paged lists; `status` is a comma list, `sort` is `new`, `pot` or `decided` |
| `list_desks(offset, limit)` | view | Paged desks for the desk picker, featured desks and the leaderboard |

Time comes from `gl.message_raw["datetime"]`, parsed once to whole seconds. Questions past their deadline are shown with the deadline applied (`OPEN` → `EXPIRED`, `DODGED_ONCE` → `DODGED`) and settled in storage by the first `reclaim`.

### Where this differs from the spec, and why

- **Network.** The spec targets Studio Next (chain 61997). The build first ran there (see [`archive/studio-next/`](archive/studio-next)) and was then moved to GenLayer Studio, the stable hosted network, at the author's request. Studionet executes the `1jb45aa8` GenVM runner (SDK v0.2): a probe contract with the Studio Next runner header deployed but never materialised, while the same contract with the `1jb45aa8` header worked. The contract logic is unchanged; only the SDK surface differs.
- **One extra view, `list_desks`.** The site's desk picker, featured desks and leaderboard need to enumerate desks, and a read-only view is the only way to do that without an indexer. It moves no money and takes no part in consensus.
- **`bio` and `topics` on `open_desk` / `update_desk`**, because the desk profile mockup shows both. **`viewer` on `get_question`**, because a read without a wallet has no sender. **`sort` on `list_questions`**, for "newest or largest pot first".
- **Fees.** Studionet is gasless, so writes carry no fee object and the site shows "Network fee: none" before each signature. The Studio Next run carried explicit fee distributions.

## Repository

```
answerable/
  contracts/answerable.py   # the one contract, rubric pinned inside
  contracts/FROZEN.json     # hash, address and eval summary, recorded once the eval ran
  tests/test_direct.py      # every method and transition, model mocked (33 tests)
  tests/conftest.py         # fixtures, clock, transfer capture
  eval/golden.json          # 9 tuned + 3 held-out cases, written before the first run
  eval/run_golden.py        # pushes cases through consensus on Studionet
  eval/results.md           # verdicts and tx hashes, never edited by hand
  scripts/chain.py          # genlayer-py client, accounts, retries, waits
  scripts/deploy.py         # deploy, writes deployed.json and web/lib/deployed.json
  scripts/seed.py           # demo desks and questions across every state
  web/                      # Next.js 16 + genlayer-js 1.1.8
  archive/studio-next/      # the earlier Studio Next run, kept as it came out
  .github/workflows/ci.yml  # lint, validate, direct tests, typecheck, build
```

## Run it

Python 3.12 and Node 20+.

```bash
python -m venv .venv
.venv/bin/pip install -r requirements.txt       # .venv\Scripts\pip on Windows
```

The linter and the direct tests load the real std lib for the `1jb45aa8` runner from GenVM release `v0.3.0-rc7`. That release ships the bundle as `genvm-runners-all.tar.xz`, while `genlayer-test 0.29.2` looks for `genvm-universal.tar.xz`, so fetch it once under the name both tools cache:

```bash
mkdir -p ~/.cache/genvm-linter ~/.cache/gltest-direct
curl -fsSL -o ~/.cache/genvm-linter/genvm-universal-v0.3.0-rc7.tar.xz \
  https://github.com/genlayerlabs/genvm/releases/download/v0.3.0-rc7/genvm-runners-all.tar.xz
cp ~/.cache/genvm-linter/genvm-universal-v0.3.0-rc7.tar.xz ~/.cache/gltest-direct/
```

**Lint and validate:**

```bash
GENVM_VERSION=v0.3.0-rc7 .venv/bin/genvm-lint check contracts/answerable.py --json
```

**Direct tests** (in-memory, the model call mocked, leader and validator checked for picklability):

```bash
.venv/bin/python -m pytest -v
```

**Deploy, eval, seed** on Studionet. Test accounts are generated into `~/.answerable/accounts.json` (outside the repo) and funded from the Studio faucet (`sim_fundAccount`). No private key is ever written to the repo or a server.

```bash
.venv/bin/python scripts/deploy.py          # refuses if deployed.json exists
.venv/bin/python eval/run_golden.py         # held-out cases run once, ever
.venv/bin/python scripts/seed.py            # resumable: reads state on chain
```

**The site** reads with no wallet and signs writes in the browser wallet (MetaMask or any EIP-1193 wallet), which it adds to or switches to chain 61999 in one click.

```bash
cd web
npm install
npm run dev        # http://localhost:3000
```

| Route | Page |
|---|---|
| `/` | Landing: hero card read from the contract, live verdicts, how it works, the rubric, featured desks, most backed open questions, for agents, FAQ |
| `/q/[id]` | Question: the question in serif, pot and backers, reply, verdict with its reason and tx, the one action for your role, a timeline where every step links to its transaction |
| `/ask` | Composer: desk terms, form hints, amount chips, the four outcomes before signing, a live preview card |
| `/d/[address]` | Desk profile: terms, the rate with its formula and distinct askers, the full record, tabs by status |
| `/desk` | Desk inbox: open a desk, the queue by pot or deadline, reply, decline with a reason, the judge right after a reply, claims |
| `/leaderboard` | Desks with five or more qualifying judged questions, ranked by rate |

Every page handles a missing wallet, the wrong network, an empty wallet (one click to the Studio faucet), "Validators are reading", failed transactions with the contract's own message and a retry, and empty states. The timeline is built from the explorer API (`/api/transactions?address=`), with calldata decoded by `genlayer-js`.

In the browser, chain reads go through the site's own `/api/rpc` relay: on a deployed domain the Studio RPC's contract reads (`gen_call`) get blocked by CORS whenever the upstream answers without CORS headers, so the site calls its own origin and the relay forwards server side, caching identical reads for a few seconds. `/api/txs` does the same for the explorer, trimmed to the fields the timeline reads. Signing always stays in the visitor's wallet.

**Deploy the site on Vercel:** import the repo, set the root directory to `web`, and deploy (or run `vercel deploy --prod` from the repo root; `.vercelignore` keeps the upload to the web app). No private key goes on the server. The optional preview verdict in the desk composer needs `OPENROUTER_API_KEY` and `OPENROUTER_MODEL`, with `OPENROUTER_BASE_URL` not ending in `/v1` (see `web/.env.example`); without them the button stays hidden.

## Honest limits

- Validators judge whether the reply **answers** the question, not whether it is **true**.
- Questions and replies are public by design. Private questions need encryption and are left for later.
- A desk's identity is only as good as the links it shows. Verified desks, through a `/.well-known/answerable.txt` file read by validators, are a stretch goal.
- Studionet is a hosted development network and its state can be reset. If the contract link stops resolving, redeploy with `scripts/deploy.py --force` and run the eval and seed again.
- The demo desks from `scripts/seed.py` are fictional and use `.example` links.
- An `EXPIRED` question needs the 24-hour minimum window to pass. The seed leaves one Pellmark question unanswered on purpose so it expires.

## License

[MIT](LICENSE)
