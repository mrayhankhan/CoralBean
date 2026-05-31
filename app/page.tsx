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
      {/* Cinematic pirate cover behind the whole hero */}
      <div className="landing-cover" aria-hidden="true" />
      <div className="landing-scrim" aria-hidden="true" />

      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-coral-500/40 to-transparent" />

      <header className="mb-10 text-center [text-shadow:0_2px_24px_rgba(0,0,0,0.6)]">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-coral-400/40 bg-black/30 px-3 py-1 text-xs font-medium uppercase tracking-wider text-coral-300 backdrop-blur">
          <span className="drift">🏴‍☠️</span> Pirates of the Coral-bean · Track 2
        </p>
        <h1 className="text-balance text-4xl font-semibold leading-tight text-white sm:text-5xl">
          Find the dependencies <span className="text-coral-400">silently rotting</span> in your repo.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-balance text-zinc-200">
          Paste a GitHub repo URL. We join <span className="font-medium text-white">GitHub</span>,{' '}
          <span className="font-medium text-white">OSV</span> and{' '}
          <span className="font-medium text-white">npm registry</span> in one Coral SQL query and tell you
          which dependencies are healthy, watch-worthy, or dangerous — in one click.
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
          className="flex-1 rounded-lg border border-white/20 bg-black/40 px-4 py-3 text-base text-white placeholder-white/50 outline-none backdrop-blur transition focus:border-coral-500 focus:ring-2 focus:ring-coral-500/30"
          autoFocus
        />
        <button
          type="submit"
          className="rounded-lg bg-coral-500 px-5 py-3 font-medium text-zinc-950 shadow-lg shadow-coral-500/20 transition hover:bg-coral-400 active:bg-coral-600"
        >
          Audit dependencies →
        </button>
      </form>

      {error && (
        <p className="mt-3 text-sm text-risk-danger [text-shadow:0_1px_8px_rgba(0,0,0,0.6)]">{error}</p>
      )}

      <div className="mt-8 w-full">
        <p className="mb-2 text-xs uppercase tracking-wider text-zinc-300">try one of these</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.input}
              onClick={() => go(ex.input)}
              className="group rounded-md border border-white/15 bg-black/40 px-3 py-1.5 text-sm text-zinc-100 backdrop-blur transition hover:border-coral-500/60 hover:bg-coral-500/20"
            >
              <span className="font-mono">{ex.label}</span>
              <span className="ml-2 text-zinc-400 group-hover:text-coral-300">· {ex.note}</span>
            </button>
          ))}
        </div>
      </div>

      <footer className="absolute bottom-6 text-xs text-zinc-300/80 [text-shadow:0_1px_8px_rgba(0,0,0,0.6)]">
        Built with <span className="text-coral-400">Coral</span> · OSV + npm source specs in{' '}
        <code className="font-mono">sources/</code> · MIT licensed
      </footer>
    </main>
  );
}
