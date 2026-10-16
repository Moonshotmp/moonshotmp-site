#!/usr/bin/env node
// Rewrites every <lastmod> in sitemap.xml to the date of the last commit that
// touched the page's file, skipping the boilerplate-only commits listed in
// scripts/sitemap-lastmod-ignore.txt.
// Run from the repo root after committing page changes:
//   node scripts/sitemap-lastmod.mjs          rewrite sitemap.xml
//   node scripts/sitemap-lastmod.mjs --check  exit 1 if any lastmod is stale or a page file is missing
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const SITE = 'https://moonshotmp.com';
const SITEMAP = 'sitemap.xml';
const check = process.argv.includes('--check');

function fileFor(loc) {
  const path = loc.slice(SITE.length).replace(/^\//, '');
  return path === '' || path.endsWith('/') ? `${path}index.html` : path;
}

// Site-wide boilerplate commits (see scripts/sitemap-lastmod-ignore.txt) do not count as a page change.
const IGNORE_FILE = 'scripts/sitemap-lastmod-ignore.txt';
const ignored = new Set(
  existsSync(IGNORE_FILE)
    ? readFileSync(IGNORE_FILE, 'utf8').split('\n').map((l) => l.trim().split(/\s+/)[0]).filter((sha) => /^[0-9a-f]{40}$/.test(sha))
    : []
);

function lastCommitDate(file) {
  const log = execFileSync('git', ['log', '--format=%H %cs', '--', file], { encoding: 'utf8' });
  for (const line of log.split('\n')) {
    const [sha, date] = line.split(' ');
    if (sha && !ignored.has(sha)) return date;
  }
  return '';
}

const xml = readFileSync(SITEMAP, 'utf8');
const problems = [];
let changed = 0;

const out = xml.replace(/<url>([\s\S]*?)<\/url>/g, (block, inner) => {
  const loc = inner.match(/<loc>([^<]+)<\/loc>/)?.[1];
  if (!loc || !loc.startsWith(SITE)) return block;
  const file = fileFor(loc);
  if (!existsSync(file)) { problems.push(`missing file for ${loc} (${file})`); return block; }
  const date = lastCommitDate(file);
  if (!date) { problems.push(`no commit history for ${file}`); return block; }
  if (!/<lastmod>/.test(inner)) { problems.push(`no <lastmod> for ${loc}`); return block; }
  const next = block.replace(/<lastmod>[^<]*<\/lastmod>/, `<lastmod>${date}</lastmod>`);
  if (next !== block) changed++;
  return next;
});

for (const p of problems) console.error(p);
if (check) {
  if (changed) console.error(`${changed} stale lastmod entries`);
  process.exit(problems.length || changed ? 1 : 0);
}
if (changed) writeFileSync(SITEMAP, out);
console.log(`sitemap.xml: ${changed} lastmod updated, ${problems.length} problems`);
process.exit(problems.length ? 1 : 0);
