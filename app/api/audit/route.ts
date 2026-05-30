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
import type { AuditResponse } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_CONCURRENCY = Number(process.env.AUDIT_CONCURRENCY ?? 6);

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

  const settled = await mapWithConcurrency(trimmed, DEFAULT_CONCURRENCY, async ([name, range]) => {
    const row = await auditOneDependency({
      packageName: name,
      declaredRange: range,
      githubToken: token,
    });
    return scoreDependency(row);
  });

  const dependencies = [];
  const errors: string[] = [];
  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    if (result.status === 'fulfilled') {
      dependencies.push(result.value);
    } else {
      errors.push(`${trimmed[i][0]}: ${result.reason?.message ?? String(result.reason)}`);
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

  return NextResponse.json(response, {
    headers: {
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
