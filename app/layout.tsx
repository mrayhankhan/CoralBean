import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dependency Risk Auditor — Coral',
  description:
    'Joins GitHub + OSV + npm registry in one Coral SQL query to surface dependencies that are silently rotting, vulnerable, or abandoned.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
