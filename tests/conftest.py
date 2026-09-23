import atexit
import os
import sys
from pathlib import Path

import pytest

# Pin the GenVM release that ships the py-genlayer:1jb45aa8 runner Studionet
# runs, so direct tests load the same std lib the contract header asks for.
os.environ.setdefault("GENVM_VERSION", "v0.3.0-rc7")


# gltest unlinks the temp file it has just dup2'd onto stdin. Windows refuses
# to delete an open file, so defer those deletes to interpreter exit.
_real_unlink = os.unlink
_leftovers = []


def _unlink_later(path, *args, **kwargs):
    try:
        _real_unlink(path, *args, **kwargs)
    except PermissionError:
        _leftovers.append(path)


@atexit.register
def _cleanup():
    for path in _leftovers:
        try:
            _real_unlink(path)
        except OSError:
            pass


CONTRACT = Path(__file__).resolve().parents[1] / "contracts" / "answerable.py"
GEN = 10**18
T0 = "2026-09-18T09:00:00Z"


def set_time(vm, iso: str) -> None:
    """Move the clock the contract reads (gl.message_raw["datetime"])."""
    vm.warp(iso)
    gl = sys.modules.get("genlayer.gl")
    if gl is not None and isinstance(getattr(gl, "message_raw", None), dict):
        gl.message_raw["datetime"] = iso


class Transfers:
    """Records the value transfers (PostMessage) the contract emits."""

    def __init__(self):
        self.sent = []

    def __call__(self, vm, request):
        if isinstance(request, dict) and "PostMessage" in request:
            msg = request["PostMessage"]
            self.sent.append((msg["address"].as_hex, int(msg["value"]), msg["on"]))
            return {"ok": None}
        return None


@pytest.fixture
def transfers(direct_vm):
    t = Transfers()
    direct_vm._gl_call_hook = t
    return t


@pytest.fixture
def app(direct_vm, direct_deploy, transfers):
    direct_vm.warp(T0)
    os.unlink = _unlink_later
    try:
        contract = direct_deploy(str(CONTRACT))
    finally:
        os.unlink = _real_unlink
    set_time(direct_vm, T0)
    return contract
