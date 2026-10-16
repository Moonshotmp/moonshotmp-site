#!/usr/bin/env node
// Class coverage check for the compiled Tailwind stylesheet.
//
// Extracts every class name used by the site (class="..." attributes in all
// HTML files, plus string literals in browser JS such as shared/*.js and the
// quiz engines that build markup) and checks
// each one against the class selectors present in a compiled CSS file.
//
// Usage:
//   node scripts/check-css-coverage.mjs                       # checks shared/tailwind.css
//   node scripts/check-css-coverage.mjs --css old.css --compare shared/tailwind.css
//   node scripts/check-css-coverage.mjs --list                # print classes with no rule
//
// "No rule" is not always a bug: custom classes defined in shared/styles.css or
// inline <style> blocks, and JS hooks (e.g. "hidden-by-js"), show up too. The
// useful numbers are the deltas between two builds.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const cssPath = opt('--css') || join(root, 'shared/tailwind.css');
const comparePath = opt('--compare');
const list = args.includes('--list');

const SKIP_DIRS = new Set(['node_modules', '.git', '.netlify', 'dist']);
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// Tokens that can plausibly be a utility class name.
const TOKEN = /^-?[a-z0-9!@][a-z0-9@\[\]:\/._%#(),'=&>*+-]*$/i;
function addTokens(set, str, where) {
  for (const t of str.split(/\s+/)) {
    if (!t || t.includes('${') || !TOKEN.test(t)) continue;
    if (!set.has(t)) set.set(t, new Set());
    set.get(t).add(where);
  }
}

function usedClasses() {
  const used = new Map(); // class -> Set(files)
  const files = walk(root);
  for (const f of files) {
    const rel = relative(root, f);
    if (f.endsWith('.html')) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/\bclass(?:Name)?\s*=\s*(["'`])([\s\S]*?)\1/g)) addTokens(used, m[2], rel);
      for (const m of src.matchAll(/classList\.(?:add|remove|toggle)\(([^)]*)\)/g)) {
        for (const s of m[1].matchAll(/(["'`])([^"'`]*)\1/g)) addTokens(used, s[2], rel);
      }
    } else if (f.endsWith('.js') && !/^(netlify|tests|scripts)\//.test(rel) && !/\.config\.js$/.test(rel)) {
      const src = readFileSync(f, 'utf8');
      // class strings inside markup templates
      for (const m of src.matchAll(/\bclass(?:Name)?\s*=\s*(\\?["'])([\s\S]*?)\1/g)) addTokens(used, m[2], rel);
      // className = '...', classList.add('a', 'b'), and plain string literals
      // that look like class lists (contain at least one Tailwind-ish token)
      for (const m of src.matchAll(/(["'`])((?:\\.|(?!\1)[^\\\n])*)\1/g)) {
        const s = m[2];
        if (/(^|\s)(?:[a-z]+:)*-?(?:p[xytrbl]?|m[xytrbl]?|text|bg|flex|grid|gap|w|h|max-w|min-h|rounded|border|font|z|items|justify|shadow|hidden|block|inline|absolute|relative|fixed|sticky|top|bottom|left|right|inset|leading|tracking|uppercase|opacity|transition|duration|backdrop|hover|md|lg|sm)(?:-|\s|$)/.test(s)) {
          addTokens(used, s, rel);
        }
      }
    }
  }
  return used;
}

function unescapeCss(s) {
  return s
    .replace(/\\([0-9a-f]{1,6}) ?/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/\\(.)/g, '$1');
}

export function cssClasses(css) {
  const out = new Set();
  // strip comments and declaration bodies roughly: only look at selector text
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of noComments.matchAll(/\.((?:\\[0-9a-f]{1,6} ?|\\.|[A-Za-z0-9_-])+)/gi)) {
    const name = unescapeCss(m[1]);
    if (/^\d/.test(name)) continue; // numbers like .5rem inside values
    out.add(name);
  }
  return out;
}

const used = usedClasses();
const cssA = cssClasses(readFileSync(cssPath, 'utf8'));
const missA = [...used.keys()].filter((c) => !cssA.has(c.replace(/^!/, '')) && !cssA.has(c));

console.log(`used classes: ${used.size}`);
console.log(`${relative(root, cssPath) || cssPath}: ${cssA.size} class selectors, ${used.size - missA.length} used classes covered, ${missA.length} with no rule`);

if (comparePath) {
  const cssB = cssClasses(readFileSync(comparePath, 'utf8'));
  const missB = new Set([...used.keys()].filter((c) => !cssB.has(c.replace(/^!/, '')) && !cssB.has(c)));
  const restored = missA.filter((c) => !missB.has(c));
  const lost = [...cssA].filter((c) => !cssB.has(c));
  const newlyMissing = [...missB].filter((c) => !missA.includes(c));
  console.log(`${relative(root, comparePath) || comparePath}: ${cssB.size} class selectors, ${used.size - missB.size} used classes covered, ${missB.size} with no rule`);
  console.log(`restored (no rule before, rule now): ${restored.length}`);
  console.log(`selectors that disappeared (fine when no page uses them any more): ${lost.length}${lost.length ? ' -> ' + lost.join(' ') : ''}`);
  console.log(`used classes newly without a rule: ${newlyMissing.length}${newlyMissing.length ? ' -> ' + newlyMissing.join(' ') : ''}`);
  if (list) {
    console.log('\nrestored, by page count:');
    for (const c of restored.sort((a, b) => used.get(b).size - used.get(a).size)) console.log(`  ${c}  (${used.get(c).size} files)`);
    console.log('\nstill no rule:');
    for (const c of [...missB].sort()) console.log(`  ${c}  (${[...used.get(c)].slice(0, 3).join(', ')}${used.get(c).size > 3 ? ', ...' : ''})`);
  }
  // Fail only when a class a page still uses lost its rule.
  process.exitCode = newlyMissing.length ? 1 : 0;
} else if (list) {
  for (const c of missA.sort()) console.log(`  ${c}  (${used.get(c).size} files)`);
}
