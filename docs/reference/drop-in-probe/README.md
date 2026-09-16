# Drop-in probe — a worked example of the contract drop-in path

These two files are a **Phase 0 smoke test, not a game.** They exist as a known-good
reference for the pattern Phase 2 depends on, because the SDK ships **no Solidity example
to copy** — the reference `CoinflipGame` is vendored as ABI + bytecode only, with no source.

They proved four things before any real contract work began:

1. The drop-in watcher compiles a hand-written file implementing `ICasinoGameV2`.
2. A **subdirectory** import (`./lib/...`) resolves. The plan's contract layout depends on
   this; the watcher follows relative imports between sibling `.sol` files.
3. The contract deploys and registers with **no constructor arguments** (constructor args are
   skipped with a warning, so a game must be parameterless).
4. The documented phase-transition rules hold.

## The phase rules these encode

| Rule | Why |
|---|---|
| Returning `WAITING_RANDOMNESS` **requires** `requestRandomnessNow = true` | otherwise the host reverts `InvalidStepTransition` |
| Returning `WAITING_PLAYER_ACTION` **requires** `requestRandomnessNow = false` | same |
| A terminal phase must set `requestRandomnessNow = false` | same |
| `SessionPhase.NONE` is never a valid return | same |
| The **settling step must not release the reserve** (`reservedProfitDelta = 0`) | a negative delta lowers the payout cap before the check, so every win above 1x reverts |
| Declare the handlers `view` / `pure` | they are reached via `staticcall` by the facet |

## What is NOT production-grade here

`ProbeLib.winFromRandomness` maps a raw byte to a coin flip with a bare comparison, and that
is fine for a probe. **Any real mapping to a small modulus must use rejection sampling**
(`limit = floor(256/n)*n`, reject at or above it, then `% n`) — a raw modulo is biased and is
treated as a defect.

## To re-run it

Copy both files back into the SDK's drop-in folder and watch the local node:

```
sdk/casino-sdk/simulator/contracts/PhaseZeroProbe.sol
sdk/casino-sdk/simulator/contracts/lib/ProbeLib.sol
```

The watcher compiles, deploys and registers it within a couple of seconds with no restart,
and it appears in `simulator/local-node/deployed.json` and the simulator's game picker.
