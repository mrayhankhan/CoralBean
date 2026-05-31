import { NextResponse } from 'next/server';
import {
  collectAllDependencies,
  fetchPackageJson,
  parseRepoInput,
} from '@/lib/github';
import {
  auditOneDependency,
  isCoralAvailable,
  loadAuditQueryTemplate,
} from '@/lib/coral';
import { mapWithConcurrency } from '@/lib/concurrency';
import { scoreDependency } from '@/lib/risk';
import type { AuditResponse, ScoredDependency } from '@/lib/types';

/**
 * A dependency whose data couldn't be fetched (network error, rate limit,
 * timeout). Rendered as a muted "unknown" card so it never silently vanishes
 * from the report — keeping the dependency count stable across runs.
 */
function unknownDependency(name: string, range: string, reason: string): ScoredDependency {
  return {
    package_name: name,
    declared_range: range,
    latest_version: null,
    license: null,
    repository__url: null,
    last_publish_at: null,
    first_publish_at: null,
    deprecated: null,
    cve_count: 0,
    worst_severity_rank: 0,
    cve_list: [],
    downloads_last_month: null,
    downloads_last_week: null,
    downloads_trend_pct: null,
    gh_last_push_at: null,
    gh_last_updated_at: null,
    open_issues_count: null,
    stargazers_count: null,
    gh_archived: null,
    days_since_last_publish: null,
    days_since_github_push: null,
    risk: 'unknown',
    headline: 'Couldn’t be audited — network or rate-limit error. Try again.',
    signals: [reason],
  };
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Kept modest on purpose: OSV/npm return HTTP 429 when we fan out too
// aggressively, which used to drop random dependencies and make the report
// differ run-to-run. 3 in flight + per-dep retry/backoff keeps it stable.
const DEFAULT_CONCURRENCY = Number(process.env.AUDIT_CONCURRENCY ?? 3);

export async function POST(req: Request) {
  const started = Date.now();

  let body: { repo?: string } = {};
  try { body = await req.json(); } catch { /* fall through */ }

  const repoInput = body.repo?.trim();
  if (!repoInput) {
    return NextResponse.json(
      { error: 'Missing `repo` in request body.' },
      { status: 400 },
    );
  }

  const parsed = parseRepoInput(repoInput);
  if (!parsed) {
    return NextResponse.json(
      { error: `Could not parse "${repoInput}" as a GitHub repo. Try "owner/repo" or a github.com URL.` },
      { status: 400 },
    );
  }

  const token = process.env.GITHUB_TOKEN || undefined;

  let pkgJson;
  try {
    pkgJson = await fetchPackageJson(parsed.owner, parsed.repo, token);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 404 },
    );
  }

  const deps = collectAllDependencies(pkgJson);
  const depEntries = Object.entries(deps);

  if (depEntries.length === 0) {
    return NextResponse.json(
      { error: `No dependencies found in package.json for ${parsed.owner}/${parsed.repo}.` },
      { status: 404 },
    );
  }

  // Hard cap so a misconfigured monorepo doesn't trigger thousands of
  // outbound requests in one click.
  const MAX_DEPS = 250;
  const trimmed = depEntries.slice(0, MAX_DEPS);
  const total = trimmed.length;

  // Stream newline-delimited JSON so the client can show a real progress bar
  // that tracks how many dependencies have actually been scored.
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));

      send({ type: 'meta', total, repo: parsed });

      let completed = 0;
      const settled = await mapWithConcurrency(trimmed, DEFAULT_CONCURRENCY, async ([name, range]) => {
        try {
          const row = await auditOneDependency({
            packageName: name,
            declaredRange: range,
            githubToken: token,
          });
          return scoreDependency(row);
        } finally {
          completed++;
          send({ type: 'progress', completed, total });
        }
      });

      const dependencies = [];
      const errors: string[] = [];
      for (let i = 0; i < settled.length; i++) {
        const result = settled[i];
        const [name, range] = trimmed[i];
        if (result.status === 'fulfilled') {
          dependencies.push(result.value);
        } else {
          // Don't drop the dependency — surface it as `unknown` so the total
          // count always matches package.json and the report is deterministic
          // regardless of a flaky network or a transient rate limit.
          const reason = result.reason?.message ?? String(result.reason);
          errors.push(`${name}: ${reason}`);
          dependencies.push(unknownDependency(name, range, reason));
        }
      }

      // Sort: danger first, watch next, healthy last; within each tier by
      // worst-severity then days-since-last-publish.
      const rank: Record<string, number> = { danger: 0, watch: 1, healthy: 2, unknown: 3 };
      dependencies.sort((a, b) =>
        rank[a.risk] - rank[b.risk] ||
        b.worst_severity_rank - a.worst_severity_rank ||
        (b.days_since_last_publish ?? 0) - (a.days_since_last_publish ?? 0),
      );

      const query = await loadAuditQueryTemplate();

      const response: AuditResponse = {
        repo: parsed,
        generatedAt: new Date().toISOString(),
        durationMs: Date.now() - started,
        query,
        mode: (await isCoralAvailable()) ? 'coral' : 'fallback',
        dependencies,
        errors,
      };

      send({ type: 'done', response });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      coralAvailable: await isCoralAvailable(),
      hint: 'POST { "repo": "facebook/react" } to this endpoint.',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
