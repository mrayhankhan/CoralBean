// Thin GitHub helpers. Used only to:
//   1. fetch package.json for a given owner/repo
//   2. parse "git+https://github.com/owner/repo.git" → {owner, repo}

const RAW = 'https://raw.githubusercontent.com';

export interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

export interface ParsedRepo {
  owner: string;
  repo: string;
}

/**
 * Accept a wide range of pasted inputs:
 *   - facebook/react
 *   - https://github.com/facebook/react
 *   - https://github.com/facebook/react/tree/main
 *   - git+https://github.com/facebook/react.git
 *   - git@github.com:facebook/react.git
 */
export function parseRepoInput(input: string): ParsedRepo | null {
  const cleaned = input.trim()
    .replace(/^git\+/, '')
    .replace(/\.git$/, '')
    .replace(/^git@github\.com:/, 'https://github.com/');

  // Plain "owner/repo" form.
  const slashMatch = cleaned.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (slashMatch) {
    return { owner: slashMatch[1], repo: slashMatch[2] };
  }

  try {
    const url = new URL(cleaned);
    if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') return null;
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1].replace(/\.git$/, '') };
  } catch {
    return null;
  }
}

/**
 * Try `HEAD`, then `main`, then `master`. GitHub serves the default-branch
 * file under `HEAD/` in most cases but some older repos still 404 there.
 */
export async function fetchPackageJson(
  owner: string,
  repo: string,
  token?: string,
): Promise<PackageJson> {
  const branches = ['HEAD', 'main', 'master'];
  let lastError: Error | null = null;

  for (const branch of branches) {
    const url = `${RAW}/${owner}/${repo}/${branch}/package.json`;
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: 'no-store',
    });
    if (res.ok) {
      const text = await res.text();
      try {
        return JSON.parse(text) as PackageJson;
      } catch (e) {
        throw new Error(`package.json at ${url} is not valid JSON: ${(e as Error).message}`);
      }
    }
    if (res.status !== 404) {
      lastError = new Error(`GitHub returned ${res.status} for ${url}`);
    }
  }

  throw lastError ?? new Error(
    `No package.json found in ${owner}/${repo} on HEAD/main/master. ` +
    `Either the repo has no package.json, it lives in a subdirectory, or the repo is private.`,
  );
}

/**
 * Merge dependencies + devDependencies + peerDependencies into one
 * {name: declaredRange} map. We intentionally include devDeps because
 * supply-chain attacks via dev-time tools (e.g. event-stream) are real.
 */
export function collectAllDependencies(pkg: PackageJson): Record<string, string> {
  return {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
    ...(pkg.peerDependencies ?? {}),
    ...(pkg.optionalDependencies ?? {}),
  };
}

const GITHUB_URL_RE = /github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/?#]|$)/i;

/**
 * Pull {owner, repo} out of an npm repository.url field like
 * "git+https://github.com/lodash/lodash.git". Returns null if it's not
 * a GitHub URL we can parse (Bitbucket, GitLab, monorepo subpath, etc.).
 */
export function parseGithubRepoFromUrl(url: string | null | undefined): ParsedRepo | null {
  if (!url) return null;
  const match = url.match(GITHUB_URL_RE);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}
