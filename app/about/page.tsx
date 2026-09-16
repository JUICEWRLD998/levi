import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'How it works — Levi' };

export default function AboutPage() {
  return (
    <main>
      <h1>How it works</h1>
      <p className="tagline">Why the house cannot peek.</p>

      <p>
        The casino facet requests randomness <em>mid-session</em>, and a session may
        request it more than once. Levi draws the house&apos;s hand and each street only
        after the player commits — so at the moment of decision there is nothing to
        read, because it does not exist yet.
      </p>

      <p>
        That is provable rather than promised: a folded hand never requested randomness
        for equity, and a test decodes decision-time <code>gameState</code> and fails if
        any house or board card is derivable.
      </p>

      <div className="note">
        Receipts — transaction hashes for a fold, a stay, a press and a settlement — land
        here during Phase 7, each one checkable.
      </div>

      <nav>
        <a href="/">Levi</a>
        <a href="/record">Record</a>
      </nav>
    </main>
  );
}
