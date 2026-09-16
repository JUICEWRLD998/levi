# Design — Levi

## The problem being solved

Every casino game on the market prices risk in money. Levi prices one decision in
**disclosure** instead: the house pays you to quit, but the refund is paid in the only
currency you cannot get back — everyone finds out what you were holding.

## The integrity property

Levi is only honest if the player's decision genuinely precedes the deal. Two properties of
the Chain.wtf casino platform make that true:

1. **The facet requests randomness mid-session, and may request it more than once.** The
   game contract never receives entropy from a wallet; the facet asks its configured
   randomness provider and later calls back into the game.
2. **The game's step handlers are `view`,** reached by the facet via `staticcall`. During a
   session the game contract cannot read or write its own storage, so game logic must be a
   pure function of `(gameData, gameState, randomness)`.

### The constraint that shapes the design: state cannot be hidden

The session's only state carrier is `ctx.gameState`, an opaque blob. It is public twice
over — the host pushes it to the game inside the iframe as `sessions.items[].raw.gameState`,
and the contract emits it on-chain in `CasinoSessionSettled(..., bytes gameState)`.

Therefore: **anything the contract must retain in order to settle is readable by the player
before they act.** There is no secret the contract can hold, and hiding a value in the UI is
worthless because the bytes are public.

### What Levi does about it

It does not fight the constraint. The house's hand and each street are drawn from randomness
requested **after** the player commits. The house's hand is not hidden — **it does not exist**
when the decision is made.

That is strictly stronger than hiding, and it is checkable rather than promised:

- A folded hand never requests randomness for equity; the only later draw is the
  informational runout, whose payout is fixed in advance.
- A test decodes decision-time `gameState` and fails if any house or board card is derivable
  from it.

## Street machine

| Step | Handler | Randomness | Transition |
|---|---|---|---|
| 1 | `onSessionStart` | — | deal the player's cards → `WAITING_PLAYER_ACTION` |
| 2 | `onPlayerAction` `FOLD` | runout only (informational) | → `WAITING_RANDOMNESS` → `SETTLED` |
| 2 | `onPlayerAction` `STAY` / `PRESS` | requested | → `WAITING_RANDOMNESS` |
| 3 | `onRandomness` | — | deal the street + the house's hand → `WAITING_PLAYER_ACTION` |
| 4 | …repeat per street… | — | |
| 5 | settle | — | `SETTLED` |

`PRESS` doubles the stake. It is legal because the facet accepts a positive `escrowDelta`
from `onPlayerAction`.

## Invariants

These are the tests, and they are the gate on whether the game is shippable:

```
I1  foldRefund(preflop) < foldRefund(flop) < foldRefund(turn) < 1.00×
I2  EV(stay | strong) > EV(fold)   AND   EV(stay | weak) < EV(fold)
I3  RTP(optimal) ∈ [0.93, 0.98]            — the jam's eligibility rule
I4  RTP(always-stay) < 1  AND  RTP(always-fold) < 1  AND  RTP(always-press) < 1
I5  press EV positive only where it should be; RTP(optimal) never exceeds 0.98
I6  quoteRiskParams.maxPayout == the true worst case at the top tier
I7  expectedPayout == RTP_optimal × stake, from the SAME schedule onRandomness uses
I8  the runout exhibit never changes a fold payout (informational only)
```

**I4 is the anti-exploit proof.** If any pure strategy beats the house, the design is broken
regardless of how good the rest of the tuning looks.

## The record

Every fold is already on-chain: `CasinoSessionSettled` carries the final `gameState`. The
record is a derived read of real logs, not a separate database — decoded, joined to the
randomness, and re-verified by replaying that randomness through the same evaluator the
contract uses.

The record page reads logs **client-side, straight from the RPC**. There is no indexer, no
database and no API route, so nothing sits in the trust path of the one feature whose entire
value is being trustless. The cost is paging over block ranges and tolerating a rate-limited
public RPC; the page shows loading states rather than faking data.

## Repo layout

```
contracts/     Levi.sol + lib/ (hand evaluation, deck, the payout schedule)
app/           Next.js App Router, statically exported
src/host/      the HostLike seam + the iframe and standalone adapters
src/game/      mirrors of the contract's constants, evaluator, deck, schedule
src/record/    on-chain log reader and independent verdict verification
tests/         schedule invariants, evaluator, deck, end-to-end against the local host
scripts/       contract sync, RTP simulation, local runner, browser driver
```

**Why statically exported:** the game is loaded in a sandboxed iframe and must have no
runtime server. `output: 'export'` in `next.config.mjs` enforces that at build time — Next
coerces an unset `dynamic` to `'error'` in export mode, so any accidental dynamic data
access fails the build rather than shipping.

**Why one app serves both the game and the record:** they share the same evaluator, the same
schedule constants and the same types. A second app would be a second place for them to drift.

**Permalinks are `/record?hand=<id>`, not `/record/[hand]`.** Hand ids come from chain and
are unbounded, so they cannot be pre-generated, and a static export does not serve unknown
dynamic segments.

## The two delivery modes

Both are required, and they must not diverge:

- **Iframe mode** — embedded in the Chain.wtf host; the host owns the wallet and signs
  everything. No wallet code in the game.
- **Standalone mode** — the same bundle opened directly; brings its own wallet client.

The seam is one `HostLike` interface that both adapters implement. Components talk to
`HostLike` and never to Penpal or viem directly, so the two modes are the same component tree
with a swapped adapter rather than two code paths.
