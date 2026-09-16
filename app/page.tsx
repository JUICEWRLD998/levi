import { GameEntry } from '@/components/GameEntry';

export default function Page() {
  return (
    <main>
      <h1>Levi</h1>
      <p className="tagline">Folding pays. Folding shows.</p>

      <GameEntry />

      <div className="note">
        <strong>Phase 0 scaffold.</strong> This build exists to prove the static
        export, the route structure and the host-detection seam. The table itself is
        built in Phase 3 — see <code>implementation.md</code>.
      </div>

      <nav>
        <a href="/record">Record</a>
        <a href="/about">How it works</a>
      </nav>
    </main>
  );
}
