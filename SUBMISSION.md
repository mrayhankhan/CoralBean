# 🏴‍☠️ Submission roadmap — Dependency Risk Auditor

> **One project, four prize tracks.** This file is the single source of truth
> for what's built, what's verified, and exactly how to submit each piece
> before the deadline. Everything below has been run against live APIs.

**Deadline:** Sat **31 May 2026, 23:59 IST**. Today is 30 May — one day of buffer.
**Discord channel for showcases:** `#show-and-tell`.

---

## TL;DR — what this is

Paste a GitHub repo URL → the app reads its `package.json`, then runs one
Coral SQL query **per dependency** that joins **three separate live systems**
and scores every dep 🟢 healthy / 🟡 watch / 🔴 danger.

The cross-source `JOIN` is the whole point: it can only exist because of Coral.
No single API — and no LLM — can answer "which of my dependencies are
vulnerable **and** abandoned **and** losing users" in one shot.

---

## The four tracks we're submitting for

| # | Track / bounty | Deliverable in this repo | Status |
|---|---|---|---|
| 1 | **Track 2 — Personal Agent** (main prize) | The whole app + demo video | ✅ built & verified |
| 2 | **Chart New Waters** — Top-10 custom source specs | `sources/osv.yaml`, `sources/npm.yaml`, `sources/npm_downloads.yaml` | ✅ 3 specs, all lint + test pass |
| 3 | **Captain's Log** — blog post | `BLOG.md` → [published on Dev.to](https://dev.to/m_rayhankhan_71c3f2ed50c/how-i-built-a-dependency-risk-scanner-with-coral-in-7-days-4p9) | ✅ live |
| 4 | **Tell the Tale** — Discord/social showcase | `DEMO.md` + `SOCIAL.md` | ✅ scripted |

---

## Evidence it actually works (run these yourself)

### All three source specs register and pass their tests
```bash
npm run coral:add
# osv            ✓ 1/1 test passed
# npm            ✓ 1/1 test passed
# npm_downloads  ✓ 1/1 test passed
```

### The killer cross-source JOIN returns real data
```bash
coral sql --format json -- "$(sed "s/:pkg/'minimist'/g" sql/audit-query.sql)"
```
Verified output (abridged):
```json
{
  "package_name": "minimist",
  "latest_version": "1.2.8",
  "cve_count": 2,
  "worst_severity_rank": 4,            // CRITICAL
  "downloads_last_month": 531001061,
  "downloads_trend_pct": -7.0,
  "days_since_last_publish": 85,
  "cve_list": [
    { "id": "GHSA-vh95-rmgr-6w4m", "severity": "MODERATE", "summary": "Prototype Pollution in minimist" },
    { "id": "GHSA-xvch-5gv4-984h", "severity": "CRITICAL", "summary": "Prototype Pollution in minimist" }
  ]
}
```

### The app audits a real repo end-to-end via the Coral CLI
```bash
npm run build && PORT=3111 npm run start &
curl -s -X POST localhost:3111/api/audit -H 'Content-Type: application/json' \
     -d '{"repo":"chalk/chalk"}'
```
Verified: `mode: coral`, 10 dependencies scored in ~17 s, **0 errors**, and
`color-convert` correctly flagged 🔴 **danger** ("2 high CVEs") — the real
2025 npm supply-chain compromise — while stale-but-safe deps land in 🟡 watch.

### Unit tests + types
```bash
npm test        # 12 passing
npx tsc --noEmit # clean
npm run build   # 4 routes, compiles
```

---

## Track 2 — Personal Agent (main prize)

**Project name:** Dependency Risk Auditor
**One-liner:** Paste a GitHub repo, get every npm dependency scored
healthy/watch/danger by joining OSV + npm registry + npm downloads in one
Coral query.

**Submission copy (paste into the form):**

> Every developer has side projects with quietly rotting dependencies. The
> 2024 xz-utils backdoor was caught by accident. Snyk and Dependabot only fire
> *after* a CVE is published — nothing watches the three signals that together
> predict a supply-chain attack: active CVEs · an abandoned maintainer ·
> collapsing downloads.
>
> Dependency Risk Auditor watches all three. Paste a GitHub repo URL; it reads
> the `package.json` and runs one Coral SQL query per dependency that JOINs
> three genuinely separate live systems — OSV's vulnerability feed
> (`api.osv.dev`), the npm registry (`registry.npmjs.org`), and npm's download
> API (`api.npmjs.org`) — then scores each dep 🟢/🟡/🔴. That cross-source JOIN
> is the entire reason it needs Coral: no single API and no LLM can answer the
> question in one shot.
>
> Three custom Coral source specs ship in the repo (`sources/*.yaml`), all
> public/no-auth and validated with `coral source test`. The app is Next.js 14 +
> TypeScript with a pure, unit-tested scoring function. A transparent HTTP
> fallback keeps the demo alive on a laptop without Coral installed — same data,
> same row shape — and the UI labels which path is live.

**To submit:** project form + 60-second video (see `DEMO.md`) + repo link.

---

## Chart New Waters — custom source specs (Top-10 bounty)

Three specs, each `dsl_version: 3`, `backend: http`, public APIs, no auth:

| Spec | Tables | API |
|---|---|---|
| `sources/osv.yaml` | `vulnerabilities` | OSV `POST /v1/query` |
| `sources/npm.yaml` | `packages` | npm registry `GET /{package}` |
| `sources/npm_downloads.yaml` | `downloads_last_month`, `downloads_last_week` | npm downloads `GET /downloads/point/...` |

**Why two npm specs?** Package metadata lives on `registry.npmjs.org` and
download counts live on `api.npmjs.org`. A Coral source has a single
`base_url`, so the clean design is two sources — which doubles as a second,
genuinely useful spec rather than a hack.

**Design notes worth mentioning in the bounty form:**
- OSV severity is nested at `database_specific.severity`; surfaced via an
  explicit `expr: { kind: path, path: [database_specific, severity] }`.
- `affected__package__name` is lifted to a top-level column
  (`path: [affected, "0", package, name]`) so it can serve as a JOIN key.
- npm's `dist-tags.latest`, `time.created/modified`, `repository.url` are all
  surfaced via `expr` paths (the `__` flatten convention is not auto-applied).

**To submit:** the Coral source-spec bounty form, one entry per spec (or as the
form allows), linking the file in this repo.

---

## Captain's Log — blog post

`BLOG.md` is a first-person build log. **Published:**
https://dev.to/m_rayhankhan_71c3f2ed50c/how-i-built-a-dependency-risk-scanner-with-coral-in-7-days-4p9
- ✅ Repo public, links filled in.
- ✅ Published on Dev.to.
- [ ] Drop the public URL into the bounty form + `#show-and-tell`.

---

## Tell the Tale — Discord / social showcase

- `DEMO.md` — 60-second video script (timed, shot-by-shot) + recovery tips.
- `SOCIAL.md` — ready-to-post copy for Discord `#show-and-tell`, X, LinkedIn.

---

## Final submission checklist

- [ ] `npm run coral:add` — all three specs pass
- [ ] `npm test` — 12 green
- [ ] `npm run build` — compiles
- [ ] Record 60 s video at 1080p (`DEMO.md`) — end on the SQL, not the dashboard
- [ ] Push repo public; fill in real links in `BLOG.md` / `SOCIAL.md`
- [ ] Submit Track 2 project form (+ video + repo)
- [ ] Submit all three specs via the source-spec bounty form
- [x] Publish `BLOG.md`; post URL
- [ ] Post showcase in `#show-and-tell` with screenshots
- [ ] Cross-post on X + LinkedIn tagging Coral

---

## Honest scope notes (for judges)

- The headline JOIN spans **three** token-free sources. GitHub maintainer
  activity (last push, archived) is layered on by the app via the bundled
  `github` Coral source **when a token is present** — kept out of the headline
  query so the demo runs with zero auth.
- Ecosystem is **npm only** (reads `package.json`). PyPI/Cargo are future work.
- No database: Coral *is* the data layer. No login: it's a single-user local tool.
