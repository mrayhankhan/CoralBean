# How I built a dependency risk scanner with Claude Code + Coral in 7 days

*— Captain's Log entry for the Pirates of the Coral-bean Hackathon.*

## Why this project

Every developer has 5-10 side projects with rotting dependencies and doesn't know it. The 2024 xz-utils backdoor was caught **by accident** — one engineer noticed SSH was 500 ms slower than usual. That's how close it came.

Tools like Snyk and Dependabot catch known CVEs after they're published. Nothing checks the three signals that *together* predict a future supply-chain attack: **active CVEs · abandoned maintainer · collapsing downloads**.

That three-way signal only exists if you can JOIN across **OSV** (Google's vulnerability database), the **npm registry**, and the **npm download API**. Which is exactly what Coral does.

## The query that took me 6 days to earn

```sql
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
  SELECT downloads FROM npm_downloads.downloads_last_month WHERE package_name = :pkg
)
SELECT pkg.*, COALESCE(cves.cve_count, 0) AS cve_count,
       COALESCE(cves.worst_sev_rank, 0)   AS worst_severity_rank,
       dl_month.downloads
FROM pkg
LEFT JOIN cves     ON cves.package_name = pkg.name
LEFT JOIN dl_month ON 1 = 1;
```

One query. Three live systems — three different hosts (`registry.npmjs.org`, `api.osv.dev`, `api.npmjs.org`). Zero glue code. **No ChatGPT instance on earth can run this.** Verified against `minimist`: 2 CVEs, worst severity CRITICAL, 531M downloads/month.

## Day 1 — The OSV source spec

OSV is a public REST API. The Coral source spec is a single YAML file. Claude Code had a working draft fast once I pointed it at the source-spec reference and the OSV docs.

The `vulnerabilities` table uses `POST /v1/query`. Two things bit me, and both were about *reading the response shape correctly* rather than writing YAML:

1. **The `__` flatten convention isn't automatic.** I assumed a column named `database_specific__severity` would auto-resolve the nested `database_specific.severity`. It didn't — it came back `null`. Nested fields need an explicit `expr`:

   ```yaml
   - name: database_specific__severity
     type: Utf8
     expr:
       kind: path
       path: [database_specific, severity]
   ```

2. **Array indexing uses string keys.** To lift the package name out of the `affected[]` array as a JOIN key, the path is `[affected, "0", package, name]` — `"0"` as a *string*, not an integer (the integer form fails schema validation).

`coral source lint` caught my structural mistakes offline; the nested-path mistakes only showed up when I ran a real query against `lodash` and `minimist` and saw `null` columns.

## Day 2 — The npm specs (note the plural)

This is where I learned the most. npm is really two APIs: `registry.npmjs.org` for package metadata and `api.npmjs.org` for download counts. My first instinct was one source spec with a per-table `base_url` override.

**That field doesn't exist.** A Coral source has exactly one `base_url`. The clean fix turned out to be better than the hack: **two source specs**. `npm.yaml` (the `packages` table) and `npm_downloads.yaml` (`downloads_last_month` + `downloads_last_week`). That's not a workaround — it's a second genuinely reusable spec, and it doubled my bounty surface area.

The other lesson: a declared `filter` must *also* be declared as a column for `WHERE package_name = ...` to resolve, and the filter value isn't echoed back automatically — so JOINs key off real returned columns (`npm.packages.name`, `downloads.package`, `osv.affected__package__name`).

## Day 3 — The fan-out

The auditor reads `package.json` from a GitHub raw URL, collects every dependency (including devDependencies — supply-chain attacks via dev tools are real, see event-stream), and runs the query once per dep with 6-way concurrency. `chalk/chalk` finished in ~17 seconds. `lib/concurrency.ts` is 30 lines.

## Day 4 — The dashboard

Three columns: 🟢 healthy / 🟡 watch / 🔴 danger. Click a card → drill-down with every signal and a direct link to the OSV record. The whole UI is in [`app/components/`](./app/components/) — three files, all client components, Tailwind for styling. GitHub maintainer-activity (last push, archived) is layered on top via the bundled `github` source when a token is present — deliberately kept *out* of the headline query so the demo runs with zero auth.

## Day 5 — The scoring rules

`lib/risk.ts` is a pure function. Easy to unit-test. Rules I landed on:

- **CVE HIGH/CRITICAL → instant danger.** No nuance needed.
- **Stale + collapsing → danger.** Maintainer silent > 1 year AND downloads down > 30%. This is the xz-utils pattern.
- **Stale OR declining → watch.** Either alone is a yellow flag, not red.
- **Otherwise → healthy.**

The compound rule was the one that took the most reading. A package can have no CVE filed yet and still be the most dangerous thing in your repo if the maintainer has gone dark.

## Day 6 — The fallback path

I built a transparent HTTP fallback (`lib/coral.ts` path B) so the demo doesn't break on a laptop without Coral installed. **Same data, same row shape**, just bypassing the CLI. The header shows `coral CLI` vs `direct HTTP fallback` so judges can see which path is active. The fallback is a safety net; Coral is the production engine.

One subtlety: Coral's SQL engine is DataFusion, not SQLite. So `julianday()` and `json_group_array()` don't exist — the date math is `date_part('day', now() - to_timestamp(col))` and the CVE list is `array_agg(named_struct(...))`. Worth knowing before you write the query.

## What I learned

**Three insights I didn't expect:**

1. **The hard part of source specs isn't writing them — it's reading the API docs accurately.** Claude Code wrote the YAML in minutes. I spent far more time confirming OSV's nested field paths against real responses than authoring the spec. Every `null` column was a docs-reading miss, not a syntax error.

2. **The cross-source JOIN really does feel like magic in the terminal.** Three completely separate systems, one result set, one query. The demo moment isn't the dashboard — it's the `coral sql` invocation. Everyone leans forward.

3. **Pure scoring functions are worth their weight in unit tests.** Once `lib/risk.ts` was unit-tested I could change the rules without fear. The 12 tests in `risk.test.ts` caught two regressions during the hackathon.

## Try it

The repo is on GitHub. Three custom source specs, one Next.js app, MIT licensed:

```bash
git clone https://github.com/mrayhankhan/CoralBean.git
bash scripts/install-coral.sh
npm install && npm run dev
```

Paste `facebook/react` (mostly green) or `chalk/chalk` (watch `color-convert` go red) and watch.

🏴‍☠️
