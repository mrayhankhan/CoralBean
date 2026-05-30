'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { parseRepoInput } from '@/lib/github';

const EXAMPLES = [
  { label: 'facebook/react', input: 'facebook/react', note: 'huge & healthy' },
  { label: 'expressjs/express', input: 'expressjs/express', note: 'old-faithful' },
  { label: 'vercel/next.js', input: 'vercel/next.js', note: 'modern monorepo' },
  { label: 'jhildenbiddle/canvas-size', input: 'jhildenbiddle/canvas-size', note: 'tiny lib' },
];

export default function LandingPage() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  function go(input: string) {
    const parsed = parseRepoInput(input);
    if (!parsed) {
      setError('Try "owner/repo" or a github.com URL.');
      return;
    }
    router.push(`/audit/${parsed.owner}/${parsed.repo}`);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    go(value);
  }

  return (
    <main className="relative mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-coral-500/40 to-transparent" />

      <header className="mb-10 text-center">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-coral-500/30 bg-coral-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-coral-300">
          <span className="drift">🏴‍☠️</span> Pirates of the Coral-bean · Track 2
        </p>
        <h1 className="text-balance text-4xl font-semibold leading-tight sm:text-5xl">
          Find the dependencies <span className="text-coral-400">silently rotting</span> in your repo.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-balance text-zinc-400">
          Paste a GitHub repo URL. We join <span className="text-zinc-200">GitHub</span>,{' '}
          <span className="text-zinc-200">OSV</span> and{' '}
          <span className="text-zinc-200">npm registry</span> in one Coral SQL query and tell you
          which dependencies are healthy, watch-worthy, or dangerous — in under 10 seconds.
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        className="flex w-full flex-col items-stretch gap-3 sm:flex-row"
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="facebook/react   or   https://github.com/expressjs/express"
          className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-base placeholder-zinc-600 outline-none transition focus:border-coral-500 focus:ring-2 focus:ring-coral-500/30"
          autoFocus
        />
        <button
          type="submit"
          className="rounded-lg bg-coral-500 px-5 py-3 font-medium text-zinc-950 transition hover:bg-coral-400 active:bg-coral-600"
        >
          Audit dependencies →
        </button>
      </form>

      {error && (
        <p className="mt-3 text-sm text-risk-danger">{error}</p>
      )}

      <div className="mt-8 w-full">
        <p className="mb-2 text-xs uppercase tracking-wider text-zinc-500">try one of these</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.input}
              onClick={() => go(ex.input)}
              className="group rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-coral-500/60 hover:bg-coral-500/10"
            >
              <span className="font-mono">{ex.label}</span>
              <span className="ml-2 text-zinc-500 group-hover:text-coral-300">· {ex.note}</span>
            </button>
          ))}
        </div>
      </div>

      <footer className="absolute bottom-6 text-xs text-zinc-600">
        Built with <span className="text-coral-400">Coral</span> · OSV + npm source specs in{' '}
        <code className="font-mono">sources/</code> · MIT licensed
      </footer>
    </main>
  );
}
