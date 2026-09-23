"""Shared helpers for deploy, seed and eval scripts (genlayer-py 0.16, stable).

Network: GenLayer Studio (Studionet), chain 61999, gasless. Keys never live in
the repo: test accounts are generated once into ~/.answerable/accounts.json
(override with ANSWERABLE_KEYS) and funded with sim_fundAccount.
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

from eth_account import Account
from genlayer_py import create_client
from genlayer_py.chains import studionet
from genlayer_py.types import TransactionStatus

ROOT = Path(__file__).resolve().parents[1]
CONTRACT_PATH = ROOT / "contracts" / "answerable.py"
DEPLOYED = ROOT / "deployed.json"
KEYS = Path(os.environ.get("ANSWERABLE_KEYS", Path.home() / ".answerable" / "accounts.json"))
RPC = "https://studio.genlayer.com/api"
EXPLORER = "https://explorer-studio.genlayer.com"
CHAIN_ID = 61999
GEN = 10**18
WAIT = {"interval": 5000, "retries": 120}  # 10 minutes


def log(*parts) -> None:
    print(*parts, flush=True)


def rate_limited(exc: Exception) -> bool:
    text = str(exc)
    return "-32029" in text or "Rate limit" in text or "429" in text


def network_blip(exc: Exception) -> bool:
    text = str(exc)
    return any(s in text for s in ("Connection aborted", "Connection reset", "timed out", "Max retries exceeded", "502", "503", "504"))


def retry(fn, what: str, attempts: int = 10, idempotent: bool = True):
    """Back off and try again on rate limits. Network blips are retried only
    for idempotent calls (reads, waits): a dropped send may already have
    reached the chain."""
    for i in range(attempts):
        try:
            return fn()
        except Exception as exc:  # noqa: BLE001
            transient = rate_limited(exc) or (idempotent and network_blip(exc))
            if not transient or i == attempts - 1:
                raise
            pause = 20 + 10 * i
            log(f"  {'rate limited' if rate_limited(exc) else 'network error'} on {what}, retrying in {pause}s")
            time.sleep(pause)


def accounts(*names: str) -> dict:
    """Load named test accounts, creating any that do not exist yet."""
    KEYS.parent.mkdir(parents=True, exist_ok=True)
    store = json.loads(KEYS.read_text()) if KEYS.exists() else {}
    changed = False
    for name in names:
        if name not in store:
            store[name] = Account.create().key.hex()
            changed = True
    if changed:
        KEYS.write_text(json.dumps(store, indent=2))
        try:
            os.chmod(KEYS, 0o600)
        except OSError:
            pass
    return {n: Account.from_key(store[n]) for n in names}


def client(account):
    return create_client(chain=studionet, account=account)


def balance(c, address: str) -> int:
    return int(c.get_balance(address))


def fund(c, address: str, amount: int, minimum: int | None = None) -> int:
    """Top an account up from the Studio faucet (sim_fundAccount), then poll
    until the balance shows it."""
    minimum = amount if minimum is None else minimum
    have = retry(lambda: balance(c, address), "balance")
    if have >= minimum:
        return have
    retry(lambda: c.provider.make_request(method="sim_fundAccount", params=[address, amount]), "fund")
    for _ in range(40):
        time.sleep(3)
        have = retry(lambda: balance(c, address), "balance")
        if have >= minimum:
            return have
    raise RuntimeError(f"funding {address} did not land, balance {have}")


def execution(receipt) -> str:
    """The leader's execution result: SUCCESS, or ERROR when the contract
    raised (a UserError still reaches consensus, so check this too)."""
    try:
        leader = receipt["consensus_data"]["leader_receipt"]
        leader = leader[0] if isinstance(leader, list) else leader
        return str(leader.get("execution_result", ""))
    except (KeyError, IndexError, TypeError, AttributeError):
        return ""


def ok(receipt) -> bool:
    return (
        receipt.get("status_name") in ("ACCEPTED", "FINALIZED")
        and receipt.get("result_name") in (None, "MAJORITY_AGREE", "AGREE")
        and execution(receipt) in ("", "SUCCESS")
    )


def summary(receipt) -> str:
    return f"status={receipt.get('status_name')}, result={receipt.get('result_name')}, execution={execution(receipt) or '?'}"


def deployed_address() -> str:
    if not DEPLOYED.exists():
        sys.exit("deployed.json not found, run scripts/deploy.py first")
    return json.loads(DEPLOYED.read_text())["address"]


def wait(c, tx):
    return retry(
        lambda: c.wait_for_transaction_receipt(transaction_hash=tx, status=TransactionStatus.ACCEPTED, **WAIT),
        "wait",
    )


def write(c, account, address: str, fn: str, args: list, value: int = 0):
    # A rate-limited send never reached the chain, so sending again is safe;
    # waiting again on a known hash is always safe.
    tx = retry(
        lambda: c.write_contract(address=address, function_name=fn, account=account, args=args, value=value),
        f"send {fn}",
        idempotent=False,
    )
    return tx, wait(c, tx)


def read(c, address: str, fn: str, args: list):
    return retry(lambda: c.read_contract(address=address, function_name=fn, args=args), f"read {fn}")
