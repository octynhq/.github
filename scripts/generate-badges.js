// Regenerates SVG badges for the octynhq org profile.
// Runs hourly via .github/workflows/refresh-badges.yml.
//
// Env:
//   ORG_READ_TOKEN — PAT with `repo` + `read:org` (needed to see PRIVATE repos
//                    and ALL branches across the org). Falls back to the
//                    default GITHUB_TOKEN if unset, which only sees public
//                    repos and the current repository.

import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const ORG = 'octynhq';
const OUT_DIR = 'profile/badges';
const TOKEN = process.env.ORG_READ_TOKEN || process.env.GITHUB_TOKEN || '';
const HAS_ORG_TOKEN = !!process.env.ORG_READ_TOKEN;

// -------- brand tokens (from ~/Code/OCTYN-Brain/octyn-logo.html) --------

const C = {
  bg:        '#1c1008',   // warm-dark
  bgAlt:     '#241508',   // warm-dark-2
  bgAlt2:    '#2a1c14',   // warm-dark-3
  border:    '#3a2820',
  text:      '#f2dfc0',   // cream
  muted:     '#c8a882',   // muted-cream
  ember:     '#e87040',
  emberDeep: '#c25a32',
  emberMid:  '#8a4a2c',
  emberFade: '#4a2e1a',
  gold:      '#d4981e',
  down:      '#7a5548',   // dim ember-brown for "down" state
};

const FONT = "'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, monospace";

// PUBLIC-facing surfaces only. Internal / auth-gated surfaces
// (ops.whofits.co, admin.octyn.co, coolify.octyn.co) are deliberately
// excluded so they don't leak into the public org page. Add here only
// when a site is genuinely intended for external eyes.
const SITES = [
  { label: 'usemooney.app',     url: 'https://usemooney.app/' },
  { label: 'whofits.co',        url: 'https://whofits.co/' },
  { label: 'agency.whofits.co', url: 'https://agency.whofits.co/' },
];

// -------- helpers --------

const ghHeaders = () => ({
  accept: 'application/vnd.github+json',
  'user-agent': 'octynhq-badges-cron',
  ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}),
});

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function writeSvg(name, content) {
  const path = resolve(OUT_DIR, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  console.log(`wrote ${path}`);
}

function humanizeAgo(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

// -------- shield (redesigned: warm-dark, ember accent, mono type) --------

function shield({ label, message, accent = C.ember }) {
  const CHAR_W = 6.9;
  const labelW = 14 + label.length * CHAR_W;
  const msgW = 14 + message.length * CHAR_W;
  const total = Math.round(labelW + msgW);
  const H = 22;
  const R = 4;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${H}" role="img" aria-label="${esc(label)}: ${esc(message)}">
  <clipPath id="c"><rect width="${total}" height="${H}" rx="${R}"/></clipPath>
  <g clip-path="url(#c)">
    <rect width="${total}" height="${H}" fill="${C.bg}"/>
    <rect width="${labelW}" height="${H}" fill="${C.bgAlt}"/>
    <rect width="3" height="${H}" fill="${accent}"/>
  </g>
  <g font-family="${FONT}" font-size="11">
    <text x="10" y="15" fill="${C.muted}">${esc(label)}</text>
    <text x="${labelW + 7}" y="15" fill="${C.text}">${esc(message)}</text>
  </g>
</svg>`;
}

// -------- uptime pulse (redesigned) --------

async function genUptime() {
  const results = await Promise.all(SITES.map(async (s) => {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 8000);
      const r = await fetch(s.url, { method: 'GET', redirect: 'manual', signal: ctl.signal });
      clearTimeout(timer);
      return { ...s, ok: r.status < 500, status: r.status };
    } catch {
      return { ...s, ok: false, status: 'ERR' };
    }
  }));

  const rowH = 26;
  const PAD_L = 18;
  const width = 340;
  const height = 44 + SITES.length * rowH + 10;

  const rows = results.map((r, i) => {
    const y = 44 + i * rowH;
    const dotY = y + 5;
    const dotFill = r.ok ? C.ember : C.bgAlt2;
    const dotStroke = r.ok ? C.ember : C.down;
    const statusColor = r.ok ? C.muted : C.down;
    return `<circle cx="${PAD_L + 6}" cy="${dotY}" r="5" fill="${dotFill}" stroke="${dotStroke}" stroke-width="1"/>
    <text x="${PAD_L + 22}" y="${y + 10}" font-family="${FONT}" font-size="12" fill="${C.text}">${esc(r.label)}</text>
    <text x="${width - 16}" y="${y + 10}" text-anchor="end" font-family="${FONT}" font-size="10" fill="${statusColor}">${esc(String(r.status))}</text>`;
  }).join('\n  ');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" role="img" aria-label="OCTYN uptime">
  <rect width="100%" height="100%" rx="6" fill="${C.bg}"/>
  <rect width="100%" height="100%" rx="6" fill="none" stroke="${C.border}" stroke-width="1"/>
  <text x="${PAD_L}" y="24" font-family="${FONT}" font-size="11" fill="${C.muted}">OCTYN / uptime</text>
  <line x1="${PAD_L}" y1="32" x2="${width - PAD_L}" y2="32" stroke="${C.border}" stroke-width="1"/>
  ${rows}
</svg>`;
  writeSvg('uptime.svg', svg);
}

// -------- last deploy --------

async function genLastDeploy() {
  let text = 'never';
  let accent = C.emberFade;
  try {
    const r = await fetch(`https://api.github.com/orgs/${ORG}/events?per_page=30`, { headers: ghHeaders() });
    if (r.ok) {
      const events = await r.json();
      const push = Array.isArray(events) ? events.find((e) => e.type === 'PushEvent') : null;
      if (push) {
        const age = Date.now() - new Date(push.created_at).getTime();
        text = humanizeAgo(age);
        accent = age < 3 * 86400 * 1000 ? C.ember : age < 14 * 86400 * 1000 ? C.gold : C.down;
      }
    }
  } catch (e) {
    console.error('last-deploy:', e.message);
  }
  writeSvg('last-deploy.svg', shield({ label: 'last shipped', message: text, accent }));
}

// -------- currently --------

function genStatus() {
  let text = 'shipping';
  try {
    const raw = readFileSync('profile/status.md', 'utf8');
    const first = raw.trim().split('\n')[0].trim();
    if (first) text = first.slice(0, 60);
  } catch {}
  writeSvg('status.svg', shield({ label: 'currently', message: text, accent: C.ember }));
}

// -------- shared: fetch commits across all repos + branches --------

async function collectOrgCommits({ sinceISO }) {
  const commits = new Map(); // sha -> { date, repo, branch }

  const repoType = HAS_ORG_TOKEN ? 'all' : 'public';
  const reposRes = await fetch(
    `https://api.github.com/orgs/${ORG}/repos?type=${repoType}&per_page=100&sort=pushed`,
    { headers: ghHeaders() }
  );
  if (!reposRes.ok) throw new Error(`repos list ${reposRes.status}`);
  const repos = (await reposRes.json()).slice(0, 40);

  for (const repo of repos) {
    let branches = [];
    try {
      const br = await fetch(
        `https://api.github.com/repos/${ORG}/${repo.name}/branches?per_page=100`,
        { headers: ghHeaders() }
      );
      if (br.ok) branches = await br.json();
    } catch {}
    if (!Array.isArray(branches) || !branches.length) {
      branches = [{ name: repo.default_branch || 'main' }];
    }

    for (const branch of branches) {
      try {
        const cr = await fetch(
          `https://api.github.com/repos/${ORG}/${repo.name}/commits?sha=${encodeURIComponent(branch.name)}&since=${sinceISO}&per_page=100`,
          { headers: ghHeaders() }
        );
        if (!cr.ok) continue;
        const list = await cr.json();
        if (!Array.isArray(list)) continue;
        for (const c of list) {
          if (!c.sha || commits.has(c.sha)) continue;
          const iso = c.commit?.author?.date || c.commit?.committer?.date;
          if (!iso) continue;
          commits.set(c.sha, { date: iso, repo: repo.name, branch: branch.name });
        }
      } catch {}
    }
  }
  return commits;
}

// -------- lines this week --------

async function genLines() {
  const weekAgo = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
  let total = 0;

  try {
    const commits = await collectOrgCommits({ sinceISO: weekAgo });
    const entries = [...commits.entries()].slice(0, 400);
    const CHUNK = 8;
    for (let i = 0; i < entries.length; i += CHUNK) {
      const chunk = entries.slice(i, i + CHUNK);
      const results = await Promise.all(chunk.map(async ([sha, meta]) => {
        try {
          const d = await fetch(`https://api.github.com/repos/${ORG}/${meta.repo}/commits/${sha}`, { headers: ghHeaders() });
          if (!d.ok) return 0;
          const j = await d.json();
          return (j.stats?.additions || 0) + (j.stats?.deletions || 0);
        } catch { return 0; }
      }));
      total += results.reduce((a, b) => a + b, 0);
    }
  } catch (e) {
    console.error('lines:', e.message);
    writeSvg('lines.svg', shield({ label: 'lines this week', message: 'err', accent: C.down }));
    return;
  }
  writeSvg('lines.svg', shield({ label: 'lines this week', message: total.toLocaleString('en-US'), accent: C.ember }));
}

// -------- activity heatmap (redesigned: ember-scale on warm-dark) --------

async function genActivity() {
  const WEEKS = 12;

  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  const dayOfWeek = now.getUTCDay();
  const currentWeekStart = new Date(now);
  currentWeekStart.setUTCDate(now.getUTCDate() - dayOfWeek);
  const start = new Date(currentWeekStart);
  start.setUTCDate(currentWeekStart.getUTCDate() - (WEEKS - 1) * 7);
  const sinceISO = start.toISOString();

  const buckets = new Map();
  try {
    const commits = await collectOrgCommits({ sinceISO });
    for (const { date } of commits.values()) {
      const day = date.slice(0, 10);
      buckets.set(day, (buckets.get(day) || 0) + 1);
    }
  } catch (e) {
    console.error('activity:', e.message);
  }

  const active = [...buckets.values()].filter((v) => v > 0);
  const max = Math.max(1, ...active);
  const q1 = Math.max(1, max / 4);
  const q2 = Math.max(2, max / 2);
  const q3 = Math.max(3, (max * 3) / 4);
  const colorFor = (n) => {
    if (n === 0) return C.bgAlt;
    if (n <= q1) return C.emberFade;
    if (n <= q2) return C.emberMid;
    if (n <= q3) return C.emberDeep;
    return C.ember;
  };

  const CELL = 16;
  const GAP = 4;
  const PAD_L = 22;
  const PAD_T = 56;    // room for header + subtitle rows, no collision
  const PAD_R = 22;
  const PAD_B = 46;    // room for the legend on its own row below the grid
  const gridW = WEEKS * (CELL + GAP) - GAP;
  // Enforce a min width so the subtitle never clips.
  const minWidth = 400;
  const width = Math.max(minWidth, PAD_L + gridW + PAD_R);
  const height = PAD_T + 7 * (CELL + GAP) - GAP + PAD_B;
  // Center the grid if the min-width kicked in.
  const gridX = Math.round((width - gridW) / 2);

  const pad2 = (n) => String(n).padStart(2, '0');
  const isoOf = (d) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;

  let cells = '';
  let total = 0;
  for (let w = 0; w < WEEKS; w++) {
    for (let d = 0; d < 7; d++) {
      const cellDate = new Date(currentWeekStart);
      cellDate.setUTCDate(currentWeekStart.getUTCDate() - (WEEKS - 1 - w) * 7 + d);
      if (cellDate > now) continue;
      const key = isoOf(cellDate);
      const count = buckets.get(key) || 0;
      total += count;
      const x = gridX + w * (CELL + GAP);
      const y = PAD_T + d * (CELL + GAP);
      cells += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${colorFor(count)}"><title>${key}: ${count} commit${count === 1 ? '' : 's'}</title></rect>\n  `;
    }
  }

  // Legend on its own row below the grid — no overlap with subtitle.
  const legendRectW = 12;
  const legendGap = 4;
  const legendBlockW = 5 * (legendRectW + legendGap) - legendGap;
  const legendLabelW = 30; // "less" / "more"
  const legendFullW = legendLabelW + 6 + legendBlockW + 6 + legendLabelW;
  const legendXStart = Math.round((width - legendFullW) / 2) + legendLabelW + 6;
  const legendY = PAD_T + 7 * (CELL + GAP) - GAP + 24;
  const legend =
    `<text x="${legendXStart - 6}" y="${legendY}" text-anchor="end" font-family="${FONT}" font-size="10" fill="${C.muted}">less</text>` +
    [0, q1 * 0.5, q1 * 1.5, q2 * 1.5, q3 * 1.5]
      .map((v, i) => `<rect x="${legendXStart + i * (legendRectW + legendGap)}" y="${legendY - 10}" width="${legendRectW}" height="10" rx="2" fill="${colorFor(v)}"/>`)
      .join('') +
    `<text x="${legendXStart + legendBlockW + 6}" y="${legendY}" font-family="${FONT}" font-size="10" fill="${C.muted}">more</text>`;

  const scopeNote = HAS_ORG_TOKEN ? 'all repos + branches' : 'public repos only';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" role="img" aria-label="OCTYN commit activity — last ${WEEKS} weeks · ${scopeNote}">
  <rect width="100%" height="100%" rx="6" fill="${C.bg}"/>
  <rect width="100%" height="100%" rx="6" fill="none" stroke="${C.border}" stroke-width="1"/>
  <text x="${PAD_L}" y="24" font-family="${FONT}" font-size="12" fill="${C.text}">OCTYN / activity</text>
  <text x="${PAD_L}" y="40" font-family="${FONT}" font-size="10" fill="${C.muted}">${total} commit${total === 1 ? '' : 's'} · last ${WEEKS} weeks · ${scopeNote}</text>
  ${cells}
  ${legend}
</svg>`;
  writeSvg('activity.svg', svg);
}

// -------- run --------

await Promise.all([genUptime(), genLastDeploy(), genStatus(), genLines(), genActivity()]);
