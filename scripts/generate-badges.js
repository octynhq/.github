// Regenerates SVG badges for the octynhq org profile.
// Runs hourly via .github/workflows/refresh-badges.yml.
// Reads env: GITHUB_TOKEN (repo-scoped, provided by Actions automatically).

import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const ORG = 'octynhq';
const OUT_DIR = 'profile/badges';
const TOKEN = process.env.GITHUB_TOKEN || '';

const SITES = [
  { label: 'usemooney.app',     url: 'https://usemooney.app/' },
  { label: 'agency.whofits.co', url: 'https://agency.whofits.co/' },
  { label: 'ops.whofits.co',    url: 'https://ops.whofits.co/' },
  { label: 'admin.octyn.co',    url: 'https://admin.octyn.co/' },
  { label: 'coolify.octyn.co',  url: 'https://coolify.octyn.co/' },
];

const ghHeaders = () => ({
  accept: 'application/vnd.github+json',
  'user-agent': 'octynhq-badges-cron',
  ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}),
});

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function shield({ label, message, labelColor = '#555', color = '#4c1' }) {
  const labelW = 6 + label.length * 6.6;
  const msgW = 10 + message.length * 6.6;
  const total = labelW + msgW;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="20" role="img" aria-label="${esc(label)}: ${esc(message)}">
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <clipPath id="c"><rect width="${total}" height="20" rx="3"/></clipPath>
  <g clip-path="url(#c)">
    <rect width="${labelW}" height="20" fill="${labelColor}"/>
    <rect x="${labelW}" width="${msgW}" height="20" fill="${color}"/>
    <rect width="${total}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${labelW/2}" y="15">${esc(label)}</text>
    <text x="${labelW + msgW/2}" y="15">${esc(message)}</text>
  </g>
</svg>`;
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

function writeSvg(name, content) {
  const path = resolve(OUT_DIR, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  console.log(`wrote ${path}`);
}

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
  const rowH = 22;
  const width = 320;
  const height = SITES.length * rowH + 24;
  const rows = results.map((r, i) => {
    const y = 16 + i * rowH;
    const fill = r.ok ? '#3fb950' : '#f85149';
    return `<circle cx="16" cy="${y}" r="6" fill="${fill}"/>
    <text x="32" y="${y + 4}" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="13" fill="#e6edf3">${r.label}</text>
    <text x="${width - 12}" y="${y + 4}" text-anchor="end" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="11" fill="#7d8590">${r.status}</text>`;
  }).join('\n');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" role="img" aria-label="OCTYN uptime pulse">
  <rect width="100%" height="100%" fill="#0d1117"/>
  ${rows}
</svg>`;
  writeSvg('uptime.svg', svg);
}

async function genLastDeploy() {
  let text = 'never';
  let color = '#8b949e';
  try {
    const r = await fetch(`https://api.github.com/orgs/${ORG}/events?per_page=30`, { headers: ghHeaders() });
    if (r.ok) {
      const events = await r.json();
      const push = Array.isArray(events) ? events.find((e) => e.type === 'PushEvent') : null;
      if (push) {
        const age = Date.now() - new Date(push.created_at).getTime();
        text = humanizeAgo(age);
        color = age < 3 * 86400 * 1000 ? '#4c1' : age < 14 * 86400 * 1000 ? '#dfb317' : '#e05d44';
      }
    }
  } catch (e) {
    console.error('last-deploy:', e.message);
  }
  writeSvg('last-deploy.svg', shield({ label: 'last shipped', message: text, color }));
}

function genStatus() {
  let text = 'shipping';
  try {
    const raw = readFileSync('profile/status.md', 'utf8');
    const first = raw.trim().split('\n')[0].trim();
    if (first) text = first.slice(0, 60);
  } catch {}
  writeSvg('status.svg', shield({ label: 'currently', message: text, color: '#1f6feb' }));
}

async function genLines() {
  const weekAgo = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
  let total = 0;
  try {
    const reposRes = await fetch(`https://api.github.com/orgs/${ORG}/repos?type=public&per_page=100&sort=pushed`, { headers: ghHeaders() });
    if (!reposRes.ok) throw new Error(`repos ${reposRes.status}`);
    const repos = (await reposRes.json()).slice(0, 20); // cap recent 20 by pushed
    for (const repo of repos) {
      const commitsRes = await fetch(`https://api.github.com/repos/${ORG}/${repo.name}/commits?since=${weekAgo}&per_page=100`, { headers: ghHeaders() });
      if (!commitsRes.ok) continue;
      const commits = await commitsRes.json();
      if (!Array.isArray(commits) || !commits.length) continue;
      for (const c of commits.slice(0, 30)) {
        try {
          const d = await fetch(`https://api.github.com/repos/${ORG}/${repo.name}/commits/${c.sha}`, { headers: ghHeaders() });
          if (!d.ok) continue;
          const j = await d.json();
          total += (j.stats?.additions || 0) + (j.stats?.deletions || 0);
        } catch {}
      }
    }
  } catch (e) {
    console.error('lines:', e.message);
    writeSvg('lines.svg', shield({ label: 'lines this week', message: 'err', color: '#e05d44' }));
    return;
  }
  const msg = total.toLocaleString('en-US');
  writeSvg('lines.svg', shield({ label: 'lines this week', message: msg, color: '#8250df' }));
}

async function genActivity() {
  const WEEKS = 12;
  const DAYS = WEEKS * 7;

  // Anchor the grid at midnight UTC "today", then walk backward.
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  const dayOfWeek = now.getUTCDay(); // 0 = Sunday
  const currentWeekStart = new Date(now);
  currentWeekStart.setUTCDate(now.getUTCDate() - dayOfWeek);

  // Data: YYYY-MM-DD -> commit count across all octynhq public repos.
  const buckets = new Map();
  const start = new Date(currentWeekStart);
  start.setUTCDate(currentWeekStart.getUTCDate() - (WEEKS - 1) * 7);
  const sinceISO = start.toISOString();

  try {
    const reposRes = await fetch(
      `https://api.github.com/orgs/${ORG}/repos?type=public&per_page=100&sort=pushed`,
      { headers: ghHeaders() }
    );
    if (!reposRes.ok) throw new Error(`repos ${reposRes.status}`);
    const repos = (await reposRes.json()).slice(0, 20);
    for (const repo of repos) {
      const commitsRes = await fetch(
        `https://api.github.com/repos/${ORG}/${repo.name}/commits?since=${sinceISO}&per_page=100`,
        { headers: ghHeaders() }
      );
      if (!commitsRes.ok) continue;
      const commits = await commitsRes.json();
      if (!Array.isArray(commits)) continue;
      for (const c of commits) {
        const iso = c.commit?.author?.date || c.commit?.committer?.date;
        if (!iso) continue;
        const day = iso.slice(0, 10);
        buckets.set(day, (buckets.get(day) || 0) + 1);
      }
    }
  } catch (e) {
    console.error('activity:', e.message);
  }

  const active = [...buckets.values()].filter((v) => v > 0);
  const max = Math.max(1, ...active);
  const q1 = max / 4;
  const q2 = max / 2;
  const q3 = (max * 3) / 4;
  const colorFor = (n) => {
    if (n === 0) return '#161b22';
    if (n <= q1) return '#0e4429';
    if (n <= q2) return '#006d32';
    if (n <= q3) return '#26a641';
    return '#39d353';
  };

  const CELL = 14;
  const GAP = 3;
  const PAD_L = 12;
  const PAD_T = 26;
  const PAD_R = 12;
  const PAD_B = 20;
  const width = PAD_L + WEEKS * (CELL + GAP) - GAP + PAD_R;
  const height = PAD_T + 7 * (CELL + GAP) - GAP + PAD_B;

  const cellPad = (n) => String(n).padStart(2, '0');
  const isoOf = (d) => `${d.getUTCFullYear()}-${cellPad(d.getUTCMonth() + 1)}-${cellPad(d.getUTCDate())}`;

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
      const x = PAD_L + w * (CELL + GAP);
      const y = PAD_T + d * (CELL + GAP);
      cells += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${colorFor(count)}"><title>${key}: ${count} commit${count === 1 ? '' : 's'}</title></rect>\n`;
    }
  }

  const header = `${total} commit${total === 1 ? '' : 's'}, last ${WEEKS} weeks`;
  const legendY = height - 8;
  const legendXStart = width - 130;
  const legend =
    `<text x="${legendXStart - 6}" y="${legendY}" text-anchor="end" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="10" fill="#7d8590">less</text>` +
    [0, q1 * 0.5, q1 * 1.5, q2 * 1.5, q3 * 1.5]
      .map((v, i) => `<rect x="${legendXStart + i * 14}" y="${legendY - 10}" width="10" height="10" rx="2" fill="${colorFor(v)}"/>`)
      .join('') +
    `<text x="${legendXStart + 5 * 14 + 4}" y="${legendY}" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="10" fill="#7d8590">more</text>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" role="img" aria-label="OCTYN commit activity — last ${WEEKS} weeks">
  <rect width="100%" height="100%" fill="#0d1117"/>
  <text x="${PAD_L}" y="17" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="12" fill="#e6edf3">${header}</text>
  ${cells}
  ${legend}
</svg>`;
  writeSvg('activity.svg', svg);
}

await Promise.all([genUptime(), genLastDeploy(), genStatus(), genLines(), genActivity()]);
