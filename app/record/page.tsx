import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Record — Levi' };

export default function RecordPage() {
  return (
    <main>
      <h1>Record</h1>
      <p className="tagline">Every fold, and whether it was right.</p>

      <p>
        A permalink for a single hand is <code>/record?hand=&lt;id&gt;</code> — a query
        parameter, not a path segment, because hand ids come from chain and cannot be
        pre-generated for a static export.
      </p>

      <div className="note">
        The record reads <code>CasinoSessionSettled</code> logs directly from the RPC in
        the browser. No indexer, no database, no API route — nothing sits in the trust
        path of the feature whose value is being trustless. Built in Phase 5.
      </div>

      <nav>
        <a href="/">Levi</a>
        <a href="/about">How it works</a>
      </nav>
    </main>
  );
}
