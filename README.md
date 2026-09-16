# Levi

**Folding pays. Folding shows.**

A four-street table game for [Chain.wtf](https://chain.wtf), built for **Chain Jam Vol. 1**.

You are dealt a hand. The house's hand does not exist yet — it is drawn from randomness
the platform requests *after* you commit. At four points you can take a partial refund and
walk. But walking is public: fold, and your hand is written face-up into a permanent,
verifiable record, along with the runout the house dealt anyway so anyone can judge whether
you were right to leave.

So the question at every street is never just *am I beaten*. It is *is this hand worth being
seen with*.

---

## The integrity property

Most provably-fair casinos offer verifiability as a feature. Levi makes **disclosure itself
the mechanic**, and it holds because of how the platform's randomness works:

- Randomness is requested by the casino facet **mid-session**, and a session may request it
  **more than once**.
- Levi draws the house's hand and each street only **after** the player commits.
- At decision time `gameState` therefore contains the player's cards and the round config —
  and nothing about the house or the board, because they do not exist.

This is not a promise about a server. It is visible in the session log: a folded hand never
requested randomness for equity, and a test decodes decision-time `gameState` and fails if
any house or board card is derivable.

---

## Status

**Phase 0 — preflight.** The stack is being brought up and verified; no game code is written
yet. See `implementation.md` in the campaign folder for the phased plan and its acceptance
criteria.

Nothing in this repository claims a capability that has not been run.

---

## Layout

```
contracts/     Levi.sol + lib/ (hand evaluation, deck, the payout schedule)
app/           Next.js App Router, statically exported
src/           host adapters, game mirrors, record reader, components
tests/         schedule invariants, evaluator, deck, end-to-end vs the local host
scripts/       contract sync, RTP simulation, local runner
```

The frontend is a single statically-exported Next.js app serving both the game and the
public record. The record is read client-side straight from chain — no indexer, no database,
no API route — so nothing sits in the trust path of the feature whose entire value is being
trustless.

---

## Licence

TBD.
