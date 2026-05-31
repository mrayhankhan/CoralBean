'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { DependencyCard } from '@/app/components/DependencyCard';
import { RiskDrillDown } from '@/app/components/RiskDrillDown';
import { CoralQueryDisplay } from '@/app/components/CoralQueryDisplay';
import type { AuditResponse, ScoredDependency } from '@/lib/types';

export default function AuditPage() {
  const params = useParams<{ owner: string; repo: string }>();
  const [data, setData] = useState<AuditResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drillDown, setDrillDown] = useState<ScoredDependency | null>(null);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('Reading package.json from GitHub…');

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setData(null);
    setError(null);
    setProgress(0);
    setStage('Reading package.json from GitHub…');

    // Gentle creep (capped at 8%) only while we wait for the first server
    // event — i.e. during the GitHub package.json fetch. Once real per-dep
    // progress starts arriving, that drives the bar instead.
    let metaSeen = false;
    const creep = setInterval(() => {
      if (!metaSeen) setProgress((p) => (p >= 8 ? p : p + 0.5));
    }, 150);

    async function run() {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo: `${params.owner}/${params.repo}` }),
        signal: controller.signal,
      });

      // Validation / 404 errors come back as a single JSON object, not a stream.
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error ?? `HTTP ${res.status}`);
      }
      if (!res.body) throw new Error('No response stream from /api/audit.');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const msg = JSON.parse(line);
          if (cancelled) continue;

          if (msg.type === 'meta') {
            metaSeen = true;
            setStage(`Scoring ${msg.total} dependencies via Coral…`);
          } else if (msg.type === 'progress') {
            // Reserve 8% for the fetch phase and ~2% for the final sort/query;
            // map real work into the 8–98 band so the bar moves with it.
            const pct = 8 + (msg.completed / msg.total) * 90;
            setProgress(pct);
            setStage(`Scored ${msg.completed} of ${msg.total} dependencies…`);
          } else if (msg.type === 'done') {
            setProgress(100);
            setData(msg.response as AuditResponse);
          }
        }
      }
    }

    run().catch((e) => {
      if (!cancelled && e.name !== 'AbortError') setError(e.message ?? String(e));
    }).finally(() => {
      clearInterval(creep);
    });

    return () => { cancelled = true; controller.abort(); clearInterval(creep); };
  }, [params.owner, params.repo]);

  const danger  = data?.dependencies.filter((d) => d.risk === 'danger')  ?? [];
  const watch   = data?.dependencies.filter((d) => d.risk === 'watch')   ?? [];
  const healthy = data?.dependencies.filter((d) => d.risk === 'healthy') ?? [];
  const unknown = data?.dependencies.filter((d) => d.risk === 'unknown') ?? [];

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <nav className="mb-6 flex items-center justify-between text-sm">
        <Link href="/" className="text-[var(--fg-2)] transition hover:text-coral-400">
          ← Audit another repo
        </Link>
        {data && (
          <span className="text-[var(--fg-3)]">
            {data.dependencies.length} deps · ran in {(data.durationMs / 1000).toFixed(1)}s ·{' '}
            <span className={data.mode === 'coral' ? 'text-coral-400' : 'text-[var(--fg-2)]'}>
              {data.mode === 'coral' ? 'coral CLI' : 'direct HTTP fallback'}
            </span>
          </span>
        )}
      </nav>

      <header className="mb-8 [text-shadow:0_1px_12px_rgba(0,0,0,0.45)]">
        <h1 className="font-mono text-2xl text-[var(--fg)]">
          {params.owner}/<span className="text-coral-400">{params.repo}</span>
        </h1>
        <p className="mt-1 text-[var(--fg-3)]">Dependency risk report</p>
      </header>

      {error && (
        <div className="rounded-lg border border-risk-danger/40 bg-risk-danger/10 p-4 text-risk-danger">
          <p className="font-medium">Couldn&apos;t run the audit.</p>
          <p className="mt-1 text-sm">{error}</p>
        </div>
      )}

      {!data && !error && <LoadingState progress={progress} stage={stage} />}

      {data && (
        <>
          <Summary
            danger={danger.length}
            watch={watch.length}
            healthy={healthy.length}
            unknown={unknown.length}
          />

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Column
              title="Danger"
              emoji="🔴"
              color="risk-danger"
              count={danger.length}
              items={danger}
              onPick={setDrillDown}
              emptyText="No high-risk dependencies. 🎉"
            />
            <Column
              title="Watch"
              emoji="🟡"
              color="risk-watch"
              count={watch.length}
              items={watch}
              onPick={setDrillDown}
              emptyText="Nothing to babysit right now."
            />
            <Column
              title="Healthy"
              emoji="🟢"
              color="risk-healthy"
              count={healthy.length}
              items={healthy}
              onPick={setDrillDown}
              emptyText="No healthy deps found (unusual — check the unknown panel)."
            />
          </div>

          {unknown.length > 0 && (
            <section className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <header className="mb-3 flex items-center justify-between">
                <h3 className="font-medium text-[var(--fg-2)]">
                  <span className="mr-2">⚪</span>Couldn&apos;t audit
                </h3>
                <span className="text-sm tabular-nums text-[var(--fg-3)]">{unknown.length}</span>
              </header>
              <p className="mb-3 text-xs text-[var(--fg-3)]">
                These dependencies hit a network error or rate limit. They&apos;re counted
                but not scored — re-run to retry (results are cached, so it&apos;s fast).
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {unknown.map((d) => (
                  <DependencyCard key={d.package_name} dep={d} onClick={() => setDrillDown(d)} />
                ))}
              </div>
            </section>
          )}

          <section className="mt-12">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-[var(--fg-3)]">
              The query Coral ran
            </h2>
            <CoralQueryDisplay sql={data.query} />
          </section>
        </>
      )}

      {drillDown && (
        <RiskDrillDown dep={drillDown} onClose={() => setDrillDown(null)} />
      )}
    </main>
  );
}

function Summary({
  danger, watch, healthy, unknown,
}: { danger: number; watch: number; healthy: number; unknown: number }) {
  const cols = unknown > 0 ? 'grid-cols-4' : 'grid-cols-3';
  return (
    <div className={`grid ${cols} gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-center`}>
      <Stat label="Danger" value={danger} color="text-risk-danger" />
      <Stat label="Watch"  value={watch}  color="text-risk-watch" />
      <Stat label="Healthy" value={healthy} color="text-risk-healthy" />
      {unknown > 0 && <Stat label="Unknown" value={unknown} color="text-[var(--fg-2)]" />}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className={`text-3xl font-semibold ${color}`}>{value}</div>
      <div className="text-xs uppercase tracking-wider text-[var(--fg-3)]">{label}</div>
    </div>
  );
}

function Column({
  title, emoji, color, count, items, onPick, emptyText,
}: {
  title: string;
  emoji: string;
  color: string;
  count: number;
  items: ScoredDependency[];
  onPick: (d: ScoredDependency) => void;
  emptyText: string;
}) {
  return (
    <section className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
      <header className="mb-3 flex items-center justify-between">
        <h3 className={`font-medium ${color === 'risk-danger' ? 'text-risk-danger' : color === 'risk-watch' ? 'text-risk-watch' : 'text-risk-healthy'}`}>
          <span className="mr-2">{emoji}</span>{title}
        </h3>
        <span className="text-sm tabular-nums text-[var(--fg-3)]">{count}</span>
      </header>
      {items.length === 0 ? (
        <p className="text-sm text-[var(--fg-4)]">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {items.map((d) => (
            <DependencyCard key={d.package_name} dep={d} onClick={() => onPick(d)} />
          ))}
        </div>
      )}
    </section>
  );
}

function LoadingState({ progress, stage }: { progress: number; stage: string }) {
  const pct = Math.min(100, Math.round(progress));

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      {/* Pirate-ship video sailing behind the whole loading view */}
      <video
        className="loading-video"
        autoPlay
        muted
        loop
        playsInline
        aria-hidden="true"
      >
        <source src="/pirate-ship.mp4" type="video/mp4" />
      </video>
      <div className="loading-video-scrim" aria-hidden="true" />

      {/* A single glass progress card floating over the clearly-visible video */}
      <div className="w-full max-w-xl rounded-2xl border border-white/15 bg-black/45 p-6 shadow-2xl backdrop-blur-md">
        <div className="mb-3 flex items-end justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-coral-500" />
            <span className="text-base font-medium text-white">{stage}</span>
          </div>
          <span className="font-mono text-4xl font-extrabold tabular-nums text-coral-400 drop-shadow-[0_0_12px_rgba(255,98,66,0.5)]">
            {pct}
            <span className="ml-0.5 align-top text-lg text-zinc-300">%</span>
          </span>
        </div>

        <div
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Audit progress"
          className="relative h-6 w-full overflow-hidden rounded-full border border-white/15 bg-black/40 shadow-inner"
        >
          <div
            className="relative h-full rounded-full bg-gradient-to-r from-coral-600 via-coral-500 to-coral-300 shadow-[0_0_20px_rgba(255,61,23,0.55)] transition-[width] duration-300 ease-out"
            style={{ width: `${Math.max(pct, 3)}%` }}
          >
            {/* moving sheen */}
            <div className="absolute inset-0 animate-progress-sheen bg-[linear-gradient(110deg,transparent_25%,rgba(255,255,255,0.45)_50%,transparent_75%)] bg-[length:200%_100%]" />
          </div>
        </div>

        <p className="mt-3 text-center text-xs text-zinc-300">
          Charting the waters — joining OSV + npm + GitHub through Coral. Results are cached, so re-runs are instant.
        </p>
      </div>
    </div>
  );
}
