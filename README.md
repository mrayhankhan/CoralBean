# 🏴‍☠️ Dependency Risk Auditor

> Built for [Pirates of the Coral-bean Hackathon](https://withcoral.com), Track 2 (Personal Agent).

Paste any GitHub repo URL. The auditor joins **three live data sources in a single Coral SQL query** and tells you which of the repo's npm dependencies are **healthy / watch / danger** — in under 20 seconds.

The three sources, joined in `sql/audit-query.sql` (all public, all no-auth):

| Source | Host | What it tells us |
|---|---|---|
| **`npm.packages`** *(custom spec, this repo)* | `registry.npmjs.org` | Latest version · maintainer · last publish · repo URL |
| **`osv.vulnerabilities`** *(custom spec, this repo)* | `api.osv.dev` | Every known advisory affecting the package, with severity |
| **`npm_downloads.downloads_last_month` / `_last_week`** *(custom spec, this repo)* | `api.npmjs.org` | Current download popularity + short-term momentum |

GitHub maintainer-activity (last push, archived flag) is layered on top by the app via the **bundled `github` Coral source** when a token is configured — it is deliberately kept out of the headline JOIN so the demo query runs with **zero auth**.

The point of Coral is that the cross-source `JOIN` lives in the data layer, not in your agent's context window. The query the dashboard runs is in [`sql/audit-query.sql`](./sql/audit-query.sql) — read it. That's the entire engine.

---

## What's in the box

```
├── sources/
│   ├── osv.yaml             ← OSV custom source spec        (🐠 bounty entry)
│   ├── npm.yaml             ← npm registry source spec      (🐠 bounty entry)
│   └── npm_downloads.yaml   ← npm download-counts spec       (🐠 bounty entry)
├── sql/
│   └── audit-query.sql      ← The killer JOIN — the demo's centrepiece
├── app/                     ← Next.js 14 dashboard (TypeScript + Tailwind)
│   ├── page.tsx             ← Landing: paste a repo URL
│   ├── audit/[owner]/[repo]/page.tsx
│   ├── api/audit/route.ts   ← Server route that fans out to Coral
│   └── components/          ← DependencyCard · RiskDrillDown · CoralQueryDisplay
├── lib/
│   ├── coral.ts             ← Coral CLI wrapper + transparent HTTP fallback
│   ├── github.ts            ← package.json fetcher + URL parser
│   ├── risk.ts              ← Pure scoring function (unit-tested)
│   └── risk.test.ts
├── scripts/install-coral.sh
└── BLOG.md, DEMO.md, SUBMISSION.md
```

---

## Quickstart

```bash
# 1. Install Coral and register the three custom source specs.
bash scripts/install-coral.sh

# 2. Install app deps and launch the dashboard.
npm install
npm run dev
# → http://localhost:3000
```

> The app works **without** Coral on PATH — it falls back to direct HTTP against the same APIs. The header shows `coral CLI` vs `direct HTTP fallback` so judges can see the difference. Coral is the production path; the fallback exists so the demo never breaks on a fresh laptop.

### Optional: GitHub token

Without auth, GitHub allows 60 requests/hour per IP. With a (read-only) personal access token, that becomes 5,000.

```bash
cp .env.example .env.local
# fill in GITHUB_TOKEN
```

---

## The custom source specs (bounty entries)

All three APIs are public and require no auth, which is why they're an ideal AI-buildable bounty target ([per Coral's own docs](https://withcoral.com/docs/custom-source-spec)). Each spec is `dsl_version: 3`, `backend: http`.

### `sources/osv.yaml` — OSV (Open Source Vulnerabilities)

One table, `vulnerabilities`, backed by the public [OSV API](https://google.github.io/osv.dev/api/) `POST /v1/query`. Filter on `package_name` (required) and `ecosystem`. Severity is pulled from the nested `database_specific.severity` GHSA label, and `affected__package__name` is surfaced as a top-level JOIN key.

```sql
SELECT id, summary, database_specific__severity
FROM osv.vulnerabilities
WHERE package_name = 'minimist' AND ecosystem = 'npm';
```

### `sources/npm.yaml` — npm registry

One table, `packages`, backed by `registry.npmjs.org/{package}`. Surfaces `latest_version` (from `dist-tags.latest`), `repository__url`, `time__created` / `time__modified`, license, maintainers, and more.

```sql
SELECT name, latest_version, repository__url, time__modified
FROM npm.packages
WHERE package_name = 'react';
```

### `sources/npm_downloads.yaml` — npm download counts

Two tables, `downloads_last_month` and `downloads_last_week`, backed by `api.npmjs.org/downloads/point/...`. This is a **separate** source from `npm.yaml` because download counts live on a different host (`api.npmjs.org`) than package metadata (`registry.npmjs.org`), and a Coral source has a single `base_url`.

```sql
SELECT downloads FROM npm_downloads.downloads_last_month
WHERE package_name = 'lodash';
```

### Validate them

```bash
npm run coral:lint    # lint all three
npm run coral:add     # register all three
npm run coral:test    # run each spec's declared test_queries
```

---

## The killer JOIN

This is the SQL the dashboard runs once per dependency (the host substitutes `:pkg`). Three genuinely separate live systems, one result set:

```sql
-- abridged — full version in sql/audit-query.sql
WITH pkg AS (
  SELECT name, latest_version, repository__url, time__modified AS last_publish_at
  FROM npm.packages WHERE package_name = :pkg
),
cves AS (
  SELECT affected__package__name AS package_name,
         COUNT(*) AS cve_count,
         MAX(CASE database_specific__severity
               WHEN 'CRITICAL' THEN 4 WHEN 'HIGH' THEN 3
               WHEN 'MODERATE' THEN 2 WHEN 'LOW' THEN 1 ELSE 0 END) AS worst_sev_rank
  FROM osv.vulnerabilities
  WHERE package_name = :pkg AND ecosystem = 'npm' AND withdrawn IS NULL
  GROUP BY affected__package__name
),
dl_month AS (
  SELECT downloads AS downloads_last_month
  FROM npm_downloads.downloads_last_month WHERE package_name = :pkg
)
SELECT pkg.*, COALESCE(cves.cve_count,0) AS cve_count,
       COALESCE(cves.worst_sev_rank,0) AS worst_severity_rank,
       dl_month.downloads_last_month
FROM pkg
LEFT JOIN cves     ON cves.package_name = pkg.name
LEFT JOIN dl_month ON 1 = 1;
```

> Read it aloud during the demo. **No ChatGPT instance on earth can run that query.** It needs Coral. Verified output for `minimist`: `cve_count: 2`, `worst_severity_rank: 4` (CRITICAL), `downloads_last_month: 531,001,061`.

---

## Scoring

`lib/risk.ts` is a pure function — `AuditRow → { risk, headline, signals }`. It's unit-tested (`npm test`, 12 tests) and tries to mirror how a security-conscious developer would actually triage:

- HIGH or CRITICAL CVE → 🔴 danger (instant)
- Deprecated in npm, or archived upstream on GitHub → 🔴 danger
- Maintainer silent > 1 year **and** downloads collapsing > 30% → 🔴 danger *(the xz-utils pattern)*
- Maintainer quiet 6–12 months, or LOW/MODERATE advisories, or downloads dipping > 40% → 🟡 watch
- Otherwise → 🟢 healthy

---

## Verification

```bash
npm test                  # 12 unit tests for risk scoring
npm run coral:lint        # all three specs are well-formed
npm run coral:add         # register + run declared test_queries
npm run build             # Next.js production build
npm run dev               # → smoke-test against facebook/react or chalk/chalk
```

---

## Bounty stack this project plays for

- 🐠 **Chart New Waters** (Top-10 custom source specs) — three specs: `osv.yaml`, `npm.yaml`, `npm_downloads.yaml`
- ⌨️ **Captain's Log** blog post — [`BLOG.md`](./BLOG.md)
- 📦 **Tell the Tale** showcase — see [`DEMO.md`](./DEMO.md) and [`SUBMISSION.md`](./SUBMISSION.md)
- 🧭 **Track 2 — Personal Agent** — main prize

---

## License

MIT. See [`LICENSE`](./LICENSE).
