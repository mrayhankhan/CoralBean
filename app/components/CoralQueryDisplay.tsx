'use client';

import { useState } from 'react';

export function CoralQueryDisplay({ sql }: { sql: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-900 bg-zinc-900/40 px-4 py-2">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span className="inline-block h-2 w-2 rounded-full bg-coral-500" />
          <span className="font-mono">coral sql ./sql/audit-query.sql</span>
        </div>
        <button
          onClick={copy}
          className="rounded border border-zinc-800 px-2 py-1 text-xs text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-200"
        >
          {copied ? 'copied' : 'copy'}
        </button>
      </div>
      <pre className="scanline-mask max-h-96 overflow-auto p-4 font-mono text-xs leading-relaxed text-zinc-300">
        <code>{sql}</code>
      </pre>
    </div>
  );
}
