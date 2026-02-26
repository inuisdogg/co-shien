/**
 * Jobs Layout
 *
 * Minimal wrapper for public-facing job board pages.
 * No sidebar or auth required — open to anonymous visitors.
 */

import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: { index: true, follow: true },
};

export default function JobsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
