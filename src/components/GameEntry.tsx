'use client';

import { useEffect, useState } from 'react';

/**
 * Which host this build is running under.
 *
 * - `host`       — embedded in the Chain.wtf app; the bridge signs everything.
 * - `standalone` — opened directly; the app brings its own wallet client.
 *
 * This is the seam described in implementation.md §2.2. Phase 0 only *detects*; the
 * adapters land in Phases 3 and 4. Detection is deliberately by handshake outcome and
 * not by user-agent or a query flag: the same bundle must behave correctly the moment
 * the bridge is present or absent.
 */
type HostMode = 'detecting' | 'host' | 'standalone';

export function GameEntry() {
  const [mode, setMode] = useState<HostMode>('detecting');

  useEffect(() => {
    // Inside the host iframe the parent frame exists and is a different window. A
    // standalone page has no parent to hand-shake with, so the bridge can never
    // resolve — we must not wait on it forever.
    const embedded = typeof window !== 'undefined' && window.parent !== window;

    if (!embedded) {
      setMode('standalone');
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    void import('@chain/casino-sdk/guest')
      .then(({ connectGameToHost }) => {
        const connection = connectGameToHost({
          async setState() {
            /* snapshot handling lands in Phase 3 */
          },
        });

        connection.promise
          .then(() => {
            if (!cancelled) setMode('host');
          })
          .catch(() => {
            if (!cancelled) setMode('standalone');
          });

        timer = setTimeout(() => {
          if (!cancelled) setMode((m) => (m === 'detecting' ? 'standalone' : m));
        }, 3000);
      })
      .catch(() => {
        if (!cancelled) setMode('standalone');
      });

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <section>
      <p>
        Host mode: <strong>{mode}</strong>
      </p>
      {mode === 'standalone' && (
        <p className="note">
          No Chain.wtf host detected — this page would boot the standalone player
          (own wallet, direct chain calls). Phase 0 does not wire that yet.
        </p>
      )}
    </section>
  );
}
