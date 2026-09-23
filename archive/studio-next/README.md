# Studio Next run (record)

Before moving to GenLayer Studio (Studionet), Answerable was built and run on the Studio Next / Studio-dev preview, chain `61997`, which runs the consensus v0.6 release candidate. This folder keeps that run as it came out. The live product is the Studionet deployment described in the [main README](../../README.md).

| | |
|---|---|
| Contract | [`answerable.py`](answerable.py), GenVM SDK v0.3, runner `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng` |
| Address | `0xe4ccB0D5e7d27a415cE072C4DA7cDEF75371Aed0` on chain 61997 ([`deployed.json`](deployed.json), [`FROZEN.json`](FROZEN.json)) |
| Eval | 9 of 9 tuned and 3 of 3 held-out golden cases matched, every judge `MAJORITY_AGREE` ([`eval/results.md`](eval/results.md)) |
| Seed | Three demo desks and eleven questions in every state ([`seed-run.txt`](seed-run.txt)) |
| Tooling | genlayer-py 0.19.0rc2, genlayer-test 0.30.0rc2, genvm-linter 0.11.1rc2, genlayer-js 2.0.0-rc.1; every write carried an explicit `fees` object |

The contract logic is the same in both versions; only the SDK surface differs:

| Studio Next (SDK v0.3) | Studionet (SDK v0.2) |
|---|---|
| `import genlayer as gl` plus `genlayer.storage` / `genlayer.types` | `from genlayer import *` |
| `gl.contract.Contract` | `gl.Contract` |
| `gl.message.raw["datetime"]` | `gl.message_raw["datetime"]` |
| `gl.contract.get_at(a).emit_transfer(v)` | `gl.get_contract_at(a).emit_transfer(value=v)` |
| `gl.vm.run_nondet` (validator unsandboxed) | `gl.vm.run_nondet` (validator in a sandbox) |

The Studio-dev RPC allows 30 requests a minute per IP, which is why `scripts/chain.py` retries on rate limits.
