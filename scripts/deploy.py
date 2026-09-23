"""Deploy contracts/answerable.py to GenLayer Studio (Studionet, chain 61999).

    python scripts/deploy.py            # refuses if deployed.json exists
    python scripts/deploy.py --force    # deploy a new instance anyway

Writes deployed.json at the repo root and web/lib/deployed.json for the site.
"""

import argparse
import datetime
import hashlib
import json

from chain import CHAIN_ID, CONTRACT_PATH, DEPLOYED, EXPLORER, GEN, ROOT, RPC, accounts, client, fund, log, ok, retry, summary, wait


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="deploy even if deployed.json exists")
    opts = parser.parse_args()
    if DEPLOYED.exists() and not opts.force:
        raise SystemExit(f"{DEPLOYED.name} exists; the deployed contract is frozen. Use --force to deploy another.")

    deployer = accounts("deployer")["deployer"]
    c = client(deployer)
    log(f"deployer {deployer.address}")
    log(f"balance  {fund(c, deployer.address, 100 * GEN, minimum=1 * GEN) / GEN:.4f} GEN (Studio is gasless)")

    code = CONTRACT_PATH.read_text(encoding="utf-8")
    tx = retry(lambda: c.deploy_contract(code=code, account=deployer, args=[]), "deploy", idempotent=False)
    tx = tx if isinstance(tx, str) else tx.hex()
    log(f"tx       {tx}")
    receipt = wait(c, tx)
    address = (receipt.get("data") or {}).get("contract_address") or receipt.get("recipient")
    if not ok(receipt) or not address:
        raise SystemExit(f"deploy failed: {summary(receipt)}")

    record = {
        "address": address,
        "chain_id": CHAIN_ID,
        "network": "studionet",
        "rpc": RPC,
        "explorer": EXPLORER,
        "deploy_tx": tx,
        "deployer": deployer.address,
        "contract_sha256": hashlib.sha256(code.encode("utf-8")).hexdigest(),
        "deployed_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
    }
    DEPLOYED.write_text(json.dumps(record, indent=2) + "\n")
    web = ROOT / "web" / "lib" / "deployed.json"
    web.parent.mkdir(parents=True, exist_ok=True)
    web.write_text(json.dumps(record, indent=2) + "\n")
    log(f"address  {address}")
    log(f"wrote    {DEPLOYED} and {web}")


if __name__ == "__main__":
    main()
