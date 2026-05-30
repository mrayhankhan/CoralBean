// Wraps the Coral CLI to run the audit query for one dependency at a time.
// Falls back to direct HTTP against OSV + npm + GitHub if `coral` is not on
// PATH — this keeps the demo working on a fresh laptop while still being
// the *exact same data* you'd get through Coral. The fallback path is
// labelled `mode: 'fallback'` in the response so judges can see the
// difference (and so the demo terminal still shows the SQL that Coral runs).

import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { AuditRow, OsvCveSummary, Severity } from './types';
import { parseGithubRepoFromUrl } from './github';

const CORAL_BIN = process.env.CORAL_BIN ?? 'coral';

let coralAvailability: boolean | null = null;

export async function isCoralAvailable(): Promise<boolean> {
  if (coralAvailability !== null) return coralAvailability;
  try {
    await runCommand(CORAL_BIN, ['--version'], 3000);
    coralAvailability = true;
  } catch {
    coralAvailability = false;
  }
  return coralAvailability;
}

export async function loadAuditQueryTemplate(): Promise<string> {
  const p = path.join(process.cwd(), 'sql', 'audit-query.sql');
  return fs.readFile(p, 'utf-8');
}

interface AuditInputs {
  packageName: string;
  declaredRange: string;
  githubToken?: string;
}

/**
 * Returns one AuditRow for one dependency. Internally this fans out 4-5
 * HTTP calls (or one Coral SQL invocation), then collapses the results
 * into the shape the SQL in sql/audit-query.sql would have returned.
 */
export async function auditOneDependency(inputs: AuditInputs): Promise<AuditRow> {
  if (await isCoralAvailable()) {
    return auditViaCoral(inputs);
  }
  return auditViaHttp(inputs);
}

// ─────────────────────────────────────────────────────────────────────────
// Path A — real Coral CLI
// ─────────────────────────────────────────────────────────────────────────

async function auditViaCoral({ packageName, declaredRange, githubToken }: AuditInputs): Promise<AuditRow> {
  // The headline JOIN (sql/audit-query.sql) spans three token-free sources:
  // npm.packages + osv.vulnerabilities + npm_downloads.*. We only substitute
  // :pkg. GitHub maintainer-activity is layered on afterwards via HTTP when a
  // token is available (the bundled `github` Coral source needs its own
  // secret configured, which we don't assume on a fresh laptop).
  const template = await loadAuditQueryTemplate();
  const bound = template.replaceAll(':pkg', `'${esc(packageName)}'`);

  const rows = await runCoralSql(bound);
  const row = rows?.[0] ?? {};

  // Optional GitHub enrichment using the repo URL the JOIN returned.
  const gh = parseGithubRepoFromUrl(row.repository__url ?? null);
  let ghRepo: any | null = null;
  if (gh) {
    try {
      ghRepo = await fetchGithubRepo(gh.owner, gh.repo, githubToken);
    } catch {
      ghRepo = null; // GitHub is best-effort; never fail the audit on it.
    }
  }
  if (ghRepo) {
    row.gh_last_push_at = ghRepo.pushed_at ?? null;
    row.gh_last_updated_at = ghRepo.updated_at ?? null;
    row.open_issues_count = ghRepo.open_issues_count ?? null;
    row.stargazers_count = ghRepo.stargazers_count ?? null;
    row.gh_archived = typeof ghRepo.archived === 'boolean' ? ghRepo.archived : null;
    row.days_since_github_push = ghRepo.pushed_at ? daysSince(ghRepo.pushed_at) : null;
  }

  return hydrateRow(packageName, declaredRange, row);
}

async function runCoralSql(sql: string): Promise<Record<string, any>[]> {
  // `--format json` must precede the SQL, and `--` terminates flag parsing so
  // a query that begins with a `--` SQL comment isn't mistaken for a CLI flag.
  const stdout = await runCommand(CORAL_BIN, ['sql', '--format', 'json', '--', sql], 30_000);
  try {
    const parsed = JSON.parse(stdout);
    // `coral sql --format json` returns either {rows: [...]} or [...] depending on version.
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.rows)) return parsed.rows;
    return [];
  } catch (e) {
    throw new Error(`Coral returned non-JSON output: ${stdout.slice(0, 200)}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Path B — direct HTTP fallback (same data, no Coral binary required)
// ─────────────────────────────────────────────────────────────────────────

async function auditViaHttp({ packageName, declaredRange, githubToken }: AuditInputs): Promise<AuditRow> {
  const [npmPkg, osvList, dlMonth, dlWeek] = await Promise.all([
    fetchNpmPackage(packageName),
    fetchOsvVulnerabilities(packageName),
    fetchNpmDownloadsPoint(packageName, 'last-month'),
    fetchNpmDownloadsPoint(packageName, 'last-week'),
  ]);

  const repoUrl = npmPkg?.repository?.url ?? null;
  const gh = parseGithubRepoFromUrl(repoUrl);
  const ghRepo = gh ? await fetchGithubRepo(gh.owner, gh.repo, githubToken) : null;

  // Re-shape into the same row Coral's SQL would have produced.
  const cveSummaries: OsvCveSummary[] = (osvList ?? []).map((v: any) => ({
    id: v.id,
    severity: normalizeSeverity(v.database_specific?.severity ?? readCvssSeverity(v.severity)),
    summary: v.summary ?? '',
  }));

  const worstRank = cveSummaries.reduce((acc, c) => Math.max(acc, severityRank(c.severity)), 0);

  const trendPct =
    typeof dlMonth?.downloads === 'number' && typeof dlWeek?.downloads === 'number' && dlMonth.downloads > 0
      ? Math.round(
          ((dlWeek.downloads * 4 - dlMonth.downloads) / dlMonth.downloads) * 1000,
        ) / 10
      : null;

  const lastPublish = npmPkg?.time?.modified ?? null;
  const firstPublish = npmPkg?.time?.created ?? null;
  const latestVersion: string | null = npmPkg?.['dist-tags']?.latest ?? null;
  const deprecated: string | null =
    latestVersion && npmPkg?.versions?.[latestVersion]?.deprecated
      ? String(npmPkg.versions[latestVersion].deprecated)
      : null;

  return {
    package_name: packageName,
    declared_range: declaredRange,
    latest_version: latestVersion,
    license: typeof npmPkg?.license === 'string' ? npmPkg.license : npmPkg?.license?.type ?? null,
    repository__url: repoUrl,
    last_publish_at: lastPublish,
    first_publish_at: firstPublish,
    deprecated,
    cve_count: cveSummaries.length,
    worst_severity_rank: worstRank,
    cve_list: cveSummaries,
    downloads_last_month: dlMonth?.downloads ?? null,
    downloads_last_week: dlWeek?.downloads ?? null,
    downloads_trend_pct: trendPct,
    gh_last_push_at: ghRepo?.pushed_at ?? null,
    gh_last_updated_at: ghRepo?.updated_at ?? null,
    open_issues_count: ghRepo?.open_issues_count ?? null,
    stargazers_count: ghRepo?.stargazers_count ?? null,
    gh_archived: ghRepo?.archived ?? null,
    days_since_last_publish: lastPublish ? daysSince(lastPublish) : null,
    days_since_github_push: ghRepo?.pushed_at ? daysSince(ghRepo.pushed_at) : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers shared by both paths
// ─────────────────────────────────────────────────────────────────────────

function hydrateRow(packageName: string, declaredRange: string, raw: Record<string, any>): AuditRow {
  // Coral's array_agg(named_struct(...)) returns a JSON array directly; older
  // shapes returned a JSON string. parseJsonColumn handles both. We then
  // normalise each severity label so the scorer ranks it correctly.
  const rawList = parseJsonColumn(raw.cve_list) ?? [];
  const cveList: OsvCveSummary[] = Array.isArray(rawList)
    ? rawList
        .filter((c: any) => c && c.id)
        .map((c: any) => ({
          id: c.id,
          severity: normalizeSeverity(c.severity),
          summary: c.summary ?? '',
        }))
    : [];
  const worstRankFromList = cveList.reduce((acc, c) => Math.max(acc, severityRank(c.severity)), 0);
  return {
    package_name: raw.package_name ?? packageName,
    declared_range: declaredRange,
    latest_version: raw.latest_version ?? null,
    license: raw.license ?? null,
    repository__url: raw.repository__url ?? null,
    last_publish_at: raw.last_publish_at ?? null,
    first_publish_at: raw.first_publish_at ?? null,
    deprecated: raw.deprecated ?? null,
    cve_count: Number(raw.cve_count ?? cveList.length),
    worst_severity_rank: Math.max(Number(raw.worst_severity_rank ?? 0), worstRankFromList),
    cve_list: cveList,
    downloads_last_month: nullableNumber(raw.downloads_last_month),
    downloads_last_week: nullableNumber(raw.downloads_last_week),
    downloads_trend_pct: nullableNumber(raw.downloads_trend_pct),
    gh_last_push_at: raw.gh_last_push_at ?? null,
    gh_last_updated_at: raw.gh_last_updated_at ?? null,
    open_issues_count: nullableNumber(raw.open_issues_count),
    stargazers_count: nullableNumber(raw.stargazers_count),
    gh_archived: typeof raw.gh_archived === 'boolean' ? raw.gh_archived : null,
    days_since_last_publish: nullableNumber(raw.days_since_last_publish),
    days_since_github_push: nullableNumber(raw.days_since_github_push),
  };
}

function nullableNumber(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseJsonColumn(v: any): any {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return null; }
}

function severityRank(s: Severity): number {
  return ({ CRITICAL: 4, HIGH: 3, MODERATE: 2, LOW: 1, UNKNOWN: 0 } as const)[s];
}

function normalizeSeverity(input: string | undefined | null): Severity {
  if (!input) return 'UNKNOWN';
  const v = input.toUpperCase();
  if (v === 'CRITICAL' || v === 'HIGH' || v === 'MODERATE' || v === 'LOW') return v;
  if (v === 'MEDIUM') return 'MODERATE';
  return 'UNKNOWN';
}

/**
 * OSV records expose `severity[]` as CVSS vectors. Convert the highest
 * CVSS base score into a coarse label.
 */
function readCvssSeverity(arr: any[] | undefined | null): string | null {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  let best = 0;
  for (const entry of arr) {
    const score = parseCvssBaseScore(entry?.score);
    if (score !== null && score > best) best = score;
  }
  if (best >= 9.0) return 'CRITICAL';
  if (best >= 7.0) return 'HIGH';
  if (best >= 4.0) return 'MODERATE';
  if (best > 0)    return 'LOW';
  return null;
}

function parseCvssBaseScore(vector: string | undefined): number | null {
  if (!vector || typeof vector !== 'string') return null;
  // OSV stores either a numeric score or a CVSS vector. Numeric first.
  const asNum = Number(vector);
  if (Number.isFinite(asNum)) return asNum;
  const match = vector.match(/\/?\s*([0-9]+\.[0-9])\s*$/);
  return match ? Number(match[1]) : null;
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
}

function esc(s: string): string {
  return s.replace(/'/g, "''");
}

// ─────────────────────────────────────────────────────────────────────────
// HTTP clients for the fallback path. Kept minimal: same endpoints the
// Coral source specs in sources/*.yaml point at.
// ─────────────────────────────────────────────────────────────────────────

async function fetchNpmPackage(name: string): Promise<any | null> {
  const url = `https://registry.npmjs.org/${encodeURIComponent(name).replace('%40', '@')}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`npm registry: ${res.status} for ${name}`);
  return res.json();
}

async function fetchOsvVulnerabilities(name: string): Promise<any[]> {
  const res = await fetch('https://api.osv.dev/v1/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ package: { name, ecosystem: 'npm' } }),
  });
  if (!res.ok) throw new Error(`OSV: ${res.status} for ${name}`);
  const data = await res.json();
  return Array.isArray(data?.vulns) ? data.vulns : [];
}

async function fetchNpmDownloadsPoint(
  name: string,
  period: 'last-month' | 'last-week',
): Promise<{ downloads: number; start: string; end: string } | null> {
  const url = `https://api.npmjs.org/downloads/point/${period}/${encodeURIComponent(name).replace('%40', '@')}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

async function fetchGithubRepo(owner: string, repo: string, token?: string): Promise<any | null> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub repos: ${res.status} for ${owner}/${repo}`);
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────
// child_process wrapper with timeout
// ─────────────────────────────────────────────────────────────────────────

function runCommand(cmd: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = ''; let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`${cmd} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on('data', (b) => { out += b.toString(); });
    child.stderr.on('data', (b) => { err += b.toString(); });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(`${cmd} exited ${code}: ${err.trim() || out.trim()}`));
    });
  });
}
