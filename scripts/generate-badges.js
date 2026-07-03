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

await Promise.all([genUptime(), genLastDeploy(), genStatus(), genLines()]);
