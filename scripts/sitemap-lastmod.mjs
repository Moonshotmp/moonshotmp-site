#!/usr/bin/env node
// Rewrites every <lastmod> in sitemap.xml to the date of the last commit that
// touched the page's file (git log -1 --format=%cs -- <file>).
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

function lastCommitDate(file) {
  return execFileSync('git', ['log', '-1', '--format=%cs', '--', file], { encoding: 'utf8' }).trim();
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
