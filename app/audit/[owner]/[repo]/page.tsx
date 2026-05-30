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

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo: `${params.owner}/${params.repo}` }),
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
        return json as AuditResponse;
      })
      .then((json) => { if (!cancelled) setData(json); })
      .catch((e) => { if (!cancelled) setError(e.message ?? String(e)); });
    return () => { cancelled = true; };
  }, [params.owner, params.repo]);

  const danger  = data?.dependencies.filter((d) => d.risk === 'danger')  ?? [];
  const watch   = data?.dependencies.filter((d) => d.risk === 'watch')   ?? [];
  const healthy = data?.dependencies.filter((d) => d.risk === 'healthy') ?? [];

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <nav className="mb-6 flex items-center justify-between text-sm">
        <Link href="/" className="text-zinc-400 transition hover:text-coral-400">
          ← Audit another repo
        </Link>
        {data && (
          <span className="text-zinc-500">
            {data.dependencies.length} deps · ran in {(data.durationMs / 1000).toFixed(1)}s ·{' '}
            <span className={data.mode === 'coral' ? 'text-coral-400' : 'text-zinc-400'}>
              {data.mode === 'coral' ? 'coral CLI' : 'direct HTTP fallback'}
            </span>
          </span>
        )}
      </nav>

      <header className="mb-8">
        <h1 className="font-mono text-2xl text-zinc-200">
          {params.owner}/<span className="text-coral-400">{params.repo}</span>
        </h1>
        <p className="mt-1 text-zinc-500">Dependency risk report</p>
      </header>

      {error && (
        <div className="rounded-lg border border-risk-danger/40 bg-risk-danger/10 p-4 text-risk-danger">
          <p className="font-medium">Couldn&apos;t run the audit.</p>
          <p className="mt-1 text-sm">{error}</p>
        </div>
      )}

      {!data && !error && <LoadingState />}

      {data && (
        <>
          <Summary danger={danger.length} watch={watch.length} healthy={healthy.length} />

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
              emptyText="No healthy deps found (unusual — check the errors panel)."
            />
          </div>

          {data.errors.length > 0 && (
            <details className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400">
              <summary className="cursor-pointer text-zinc-300">
                {data.errors.length} dependencies couldn&apos;t be audited
              </summary>
              <ul className="mt-3 space-y-1 font-mono text-xs text-zinc-500">
                {data.errors.map((err, i) => (<li key={i}>· {err}</li>))}
              </ul>
            </details>
          )}

          <section className="mt-12">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-zinc-500">
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

function Summary({ danger, watch, healthy }: { danger: number; watch: number; healthy: number }) {
  return (
    <div className="grid grid-cols-3 gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-center">
      <Stat label="Danger" value={danger} color="text-risk-danger" />
      <Stat label="Watch"  value={watch}  color="text-risk-watch" />
      <Stat label="Healthy" value={healthy} color="text-risk-healthy" />
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className={`text-3xl font-semibold ${color}`}>{value}</div>
      <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
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
    <section className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
      <header className="mb-3 flex items-center justify-between">
        <h3 className={`font-medium ${color === 'risk-danger' ? 'text-risk-danger' : color === 'risk-watch' ? 'text-risk-watch' : 'text-risk-healthy'}`}>
          <span className="mr-2">{emoji}</span>{title}
        </h3>
        <span className="text-sm tabular-nums text-zinc-500">{count}</span>
      </header>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-600">{emptyText}</p>
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

function LoadingState() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-zinc-400">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-coral-500" />
        Reading package.json, querying OSV + npm + GitHub via Coral…
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {[0, 1, 2].map((c) => (
          <div key={c} className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
            <div className="mb-3 h-4 w-24 animate-pulse rounded bg-zinc-800" />
            {[0, 1, 2, 3].map((r) => (
              <div key={r} className="mb-2 h-14 animate-pulse rounded bg-zinc-900" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
