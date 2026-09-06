// Builds the Markdown body an app's bump PR carries: what actually changed between
// the version it was on and the one it is moving to. Modelled on Dependabot's
// layout — collapsed <details> sections, so the PR reads as one line until asked.
//
// Everything here is best-effort. A bump PR with a thin description is a nuisance;
// a bump PR that failed to open is a broken release, so every failure path returns
// what it has rather than throwing.

const API = 'https://api.github.com';

/** Compare two semver strings. Prereleases sort before their release. */
export function compareVersions(a, b) {
  const split = (v) => {
    const [core, pre] = String(v).replace(/^v/, '').split('-');
    return [core.split('.').map(Number), pre];
  };
  const [ac, ap] = split(a);
  const [bc, bp] = split(b);
  for (let i = 0; i < 3; i++) {
    const d = (ac[i] ?? 0) - (bc[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  if (ap === bp) return 0;
  if (ap === undefined) return 1;
  if (bp === undefined) return -1;
  return ap < bp ? -1 : 1;
}

async function api(pathname, token) {
  const res = await fetch(`${API}${pathname}`, {
    headers: {
      accept: 'application/vnd.github+json',
      'user-agent': 'web-core-release-notes',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`GET ${pathname} -> ${res.status}`);
  return res.json();
}

function details(summary, body) {
  // The blank lines are load-bearing: GitHub only renders Markdown inside a
  // <details> block when the content is separated from the HTML tags.
  return `<details>\n<summary>${summary}</summary>\n\n${body}\n</details>\n`;
}

/**
 * @returns {Promise<string>} Markdown, or '' when nothing could be gathered.
 */
export async function releaseNotes({ repo, from, to, token }) {
  const sections = [];
  const tag = (v) => `v${String(v).replace(/^v/, '')}`;

  try {
    const releases = await api(`/repos/${repo}/releases?per_page=100`, token);
    const inRange = releases
      .filter((r) => !r.draft)
      .filter((r) => compareVersions(r.tag_name, from) > 0 && compareVersions(r.tag_name, to) <= 0)
      .sort((a, b) => compareVersions(b.tag_name, a.tag_name));

    if (inRange.length) {
      const body = inRange
        .map((r) => {
          // Demote the release body's own headings so they nest under the version.
          const body = (r.body || '_No notes._').trim().replace(/^(#{1,4}) /gm, '$1## ');
          return `### ${r.name || r.tag_name}\n\n${body}`;
        })
        .join('\n\n');
      sections.push(
        details(
          'Release notes',
          `_Sourced from [${repo}'s releases](https://github.com/${repo}/releases)._\n\n${body}\n`,
        ),
      );
    }
  } catch {
    // No releases section; the commits section may still work.
  }

  try {
    const cmp = await api(`/repos/${repo}/compare/${tag(from)}...${tag(to)}`, token);
    const commits = cmp.commits ?? [];
    if (commits.length) {
      const shown = commits.slice(-100).reverse();
      const lines = shown.map((c) => {
        const subject = c.commit.message.split('\n')[0];
        return `- [\`${c.sha.slice(0, 7)}\`](${c.html_url}) ${subject}`;
      });
      if (commits.length > shown.length) {
        lines.push(`- _…and ${commits.length - shown.length} more commits._`);
      }
      sections.push(
        details(
          `Commits (${commits.length})`,
          `${lines.join('\n')}\n\n[Full changelog](https://github.com/${repo}/compare/${tag(from)}...${tag(to)})\n`,
        ),
      );
    }
  } catch {
    // Leave the section out rather than claiming an empty diff.
  }

  return sections.join('\n');
}
