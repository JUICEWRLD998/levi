import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: 'Levi',
  description: 'Folding pays. Folding shows.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}

        {/* Chain Jam entry requirement: the hosted page must carry the widget script or
            the entry is not accepted ("no widget, no submission" — it is checked
            automatically at submit time and powers the live play stats). Kept in the root
            layout so it cannot be lost on a route.
            `afterInteractive` so it never blocks the table from rendering. */}
        <Script
          async
          src="https://jam.chain.wtf/widget.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
