#!/usr/bin/env node
// Rewrites every em dash (U+2014 and &mdash;) in served or sent text with a
// context-aware replacement, and logs each change (file:line, rule, before,
// after) to a report file. Idempotent: a second run finds nothing to change.
//
// Usage: node scripts/strip-em-dashes.mjs [--report <path>] [--dry] [files...]
// With no files it walks the repo (same scope as tests/no-em-dashes.test.js).
//
// Rules, in order (see README "No em dashes"):
//   C  code/markup comment            " - "
//   1  <title>, og:title, twitter:title  " | "
//   S  dash standing alone (placeholder, empty cell)  "-"
//   R  digit-dash-digit range         en dash
//   6  dash opens the text (attribution, decoration)  removed
//   E  dash closes the text           removed
//   3  "A - b - c" in one sentence     comma pair, or parentheses when b has commas
//   2  price or label pair            ", $285" in links/buttons, " · " label·label, ", " after a sentence
//   2b short label then description   ": "
//   5L right side is a list or explanation  ": "
//   4  capital after a complete clause      ". "
//   4b lowercase independent clause (it's, we, you...)  ". " and capitalised
//   Ref reference-list entry           ": " (publication subtitle)
//   5  everything else                ", "

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join, relative, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXTS = new Set(['.html', '.js', '.mjs', '.ts', '.txt', '.xml', '.json', '.md']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'images', 'fonts', 'videos', 'scripts', 'tests', '.netlify']);
const SKIP_FILES = new Set(['package-lock.json', 'deno.lock']);

const args = process.argv.slice(2);
let reportPath = null;
let dry = false;
const explicit = [];
for (let i = 0; i < args.length; i++) {
    if (args[i] === '--report') reportPath = args[++i];
    else if (args[i] === '--dry') dry = true;
    else explicit.push(args[i]);
}

export function walk(dir, out = []) {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        const st = statSync(p);
        if (st.isDirectory()) {
            if (!SKIP_DIRS.has(name)) walk(p, out);
        } else if (EXTS.has(extname(name)) && !SKIP_FILES.has(name)) {
            out.push(p);
        }
    }
    return out;
}

// ---------------------------------------------------------------- scanning

// The em dash in every spelling the site uses: the character, the named and
// numeric HTML entities, and the JS/JSON escape.
const DASH_SRC = '(?:—|&mdash;|&#8212;|&#x2014;|\\\\u2014)';
const DASH_ONE = new RegExp(DASH_SRC, 'i');
const DASH_RE = new RegExp('[ \\t]*(?:\\r?\\n[ \\t]*)?' + DASH_SRC + '[ \\t]*(?:\\r?\\n[ \\t]*)?', 'gi');
const INLINE_TAGS = new Set(['a', 'strong', 'em', 'b', 'i', 'span', 'abbr', 'sup', 'sub', 'small', 'mark', 'u', 'code', 'cite', 'q', 'time', 'label']);

// JS lexer: returns arrays of [start,end) ranges for comments and string contents.
function lexJs(src, base = 0, from = 0, to = src.length) {
    const comments = [];
    const strings = [];
    let i = from;
    let lastSig = '';
    const stack = []; // template nesting: entries are brace depth counters
    let braceDepth = 0;
    const regexOk = () => !lastSig || /[(,=:[!&|?{};+\-*%<>~^]$/.test(lastSig) || /\b(return|typeof|case|in|of|delete|void|throw|new)$/.test(lastSig);
    function readTemplate(start) {
        // start points just after the backtick
        let j = start;
        let segStart = start;
        while (j < to) {
            const c = src[j];
            if (c === '\\') { j += 2; continue; }
            if (c === '`') { strings.push([base + segStart, base + j, 'tpl']); return j + 1; }
            if (c === '$' && src[j + 1] === '{') {
                strings.push([base + segStart, base + j, 'tpl']);
                // lex the expression until matching }
                j = lexExpr(j + 2);
                segStart = j;
                continue;
            }
            j++;
        }
        return j;
    }
    function lexExpr(j) {
        let depth = 0;
        const save = lastSig;
        lastSig = '(';
        while (j < to) {
            const c = src[j];
            if (c === '}' && depth === 0) { lastSig = save; return j + 1; }
            if (c === '{') depth++;
            if (c === '}') depth--;
            j = step(j);
        }
        return j;
    }
    function step(j) {
        const c = src[j];
        const n = src[j + 1];
        if (c === '/' && n === '/') {
            const e = src.indexOf('\n', j);
            const end = e === -1 ? to : e;
            comments.push([base + j, base + end]);
            return end;
        }
        if (c === '/' && n === '*') {
            const e = src.indexOf('*/', j + 2);
            const end = e === -1 ? to : e + 2;
            comments.push([base + j, base + end]);
            return end;
        }
        if (c === '"' || c === "'") {
            let k = j + 1;
            while (k < to && src[k] !== c && src[k] !== '\n') { if (src[k] === '\\') k++; k++; }
            strings.push([base + j + 1, base + k, c]);
            lastSig = 'x';
            return k + 1;
        }
        if (c === '`') { const k = readTemplate(j + 1); lastSig = 'x'; return k; }
        if (c === '/' && regexOk()) {
            let k = j + 1; let cls = false;
            while (k < to && src[k] !== '\n') {
                if (src[k] === '\\') { k += 2; continue; }
                if (src[k] === '[') cls = true; else if (src[k] === ']') cls = false;
                else if (src[k] === '/' && !cls) break;
                k++;
            }
            lastSig = 'x';
            return k + 1;
        }
        if (!/\s/.test(c)) {
            if (/[A-Za-z0-9_$]/.test(c)) {
                let k = j; while (k < to && /[A-Za-z0-9_$]/.test(src[k])) k++;
                lastSig = src.slice(j, k);
                return k;
            }
            lastSig = c;
        }
        return j + 1;
    }
    void stack; void braceDepth;
    while (i < to) i = step(i);
    return { comments, strings };
}

function htmlRegions(src) {
    const regions = []; // {start,end,kind}
    const commentRe = /<!--[\s\S]*?-->/g;
    let m;
    while ((m = commentRe.exec(src))) regions.push({ start: m.index, end: m.index + m[0].length, kind: 'comment' });
    const inComment = (i) => regions.some(r => r.kind === 'comment' && i >= r.start && i < r.end);
    const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
    while ((m = scriptRe.exec(src))) {
        if (inComment(m.index)) continue;
        const cStart = m.index + m[0].indexOf('>') + 1;
        const cEnd = cStart + m[2].length;
        const ld = /application\/ld\+json/i.test(m[1]);
        regions.push({ start: cStart, end: cEnd, kind: ld ? 'jsonld' : 'script' });
    }
    const styleRe = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
    while ((m = styleRe.exec(src))) {
        const cStart = m.index + m[0].indexOf('>') + 1;
        regions.push({ start: cStart, end: cStart + m[1].length, kind: 'style' });
    }
    return regions;
}

// Find the tag (<...>) containing index i within [lo,hi), or null.
function enclosingTag(src, i, lo, hi) {
    const lt = src.lastIndexOf('<', i);
    const gt = src.lastIndexOf('>', i - 1);
    if (lt < lo || lt <= gt) return null;
    if (!/[a-zA-Z]/.test(src[lt + 1] || '')) return null;
    const end = src.indexOf('>', i);
    if (end === -1 || end >= hi) return null;
    return { start: lt, end: end + 1 };
}

// ---------------------------------------------------------------- context

const ENT = { '&amp;': '&', '&rsquo;': '’', '&lsquo;': '‘', '&ldquo;': '“', '&rdquo;': '”', '&nbsp;': ' ', '&middot;': '·', '&mdash;': '—', '&ndash;': '–', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&lt;': '<', '&gt;': '>', '&hellip;': '…', '&times;': '×', '&rarr;': '→', '&#8212;': '—', '&#x2014;': '—' };
function plain(s) {
    return s
        .replace(/\$\{[^}]*\}/g, 'X')
        .replace(/<[^>]*>/g, '')
        .replace(/&[a-z#0-9]+;/gi, (e) => ENT[e] ?? ' ')
        .replace(/\\u2014/gi, '—')
        .replace(/\\u00d7/gi, '×')
        .replace(/\\n/g, ' ')
        .replace(/\\(["'`])/g, '$1')
        .replace(/\s+/g, ' ');
}

// Walk left from i to a block boundary within [lo, i). Returns {start, inAnchor, tag}.
function blockLeft(src, lo, i) {
    let j = i;
    let inAnchor = false;
    let closedA = 0;
    while (j > lo) {
        const c = src[j - 1];
        if (c === '>') {
            const lt = src.lastIndexOf('<', j - 1);
            if (lt < lo) break;
            const tagM = /^<\/?\s*([a-zA-Z0-9]+)/.exec(src.slice(lt, j));
            if (!tagM) { j = lt; continue; }
            const name = tagM[1].toLowerCase();
            const closing = src[lt + 1] === '/';
            if (!INLINE_TAGS.has(name)) {
                return { start: j, inAnchor: inAnchor || (!closing && name === 'button'), tag: name };
            }
            if (name === 'a') { if (closing) closedA++; else if (closedA) closedA--; else inAnchor = true; }
            j = lt;
            continue;
        }
        j--;
    }
    return { start: lo, inAnchor, tag: null };
}
function blockRight(src, i, hi) {
    let j = i;
    while (j < hi) {
        const c = src[j];
        if (c === '<' && /[a-zA-Z/]/.test(src[j + 1] || '')) {
            const gt = src.indexOf('>', j);
            if (gt === -1 || gt >= hi) break;
            const name = (/^<\/?\s*([a-zA-Z0-9]+)/.exec(src.slice(j, gt + 1)) || [])[1]?.toLowerCase();
            if (name && !INLINE_TAGS.has(name)) return j;
            j = gt + 1;
            continue;
        }
        j++;
    }
    return hi;
}

// ---------------------------------------------------------------- rules

const words = (s) => s.trim().split(/\s+/).filter(Boolean);
const TERM = /[.?!]["'”’)]*$/;
const CLAUSE_OPENERS = /^(it|it's|it’s|that's|that’s|this is|this means|we|we're|we’re|we'll|we’ll|we've|we’ve|you|you're|you’re|you'll|you’ll|you've|you’ve|they|they're|they’re|there's|there’s|there is|there are|he|she|i|i'm|i’m|i've|i’ve)\b/;
const COLON_OPENERS = /^(namely|specifically,|i\.e\.|that is,)/i;
const BASE_VERBS = /^(recommends|fits|require|need|cause|show|help|make|look|depend|affect|include|mean|matter|work|take|come|feel|get|keep|tell|stay|drop|rise|last|vary|change|improve|decline|fall|occur|lead|explain|signal|track|catch|miss|cost|run|say|produce|apply|resolve|reflect|increase|decrease|deliver|target|remain|become|carry|use|give|let|happen|start)$/;
const DETS = /^(the|a|an|each|every|this|that|one|your|our|its|his|her|their|most|some|many|all|both|no|none|these|those|everything|nothing|something|anything|patients|people|women|men|results|levels)\b/;
const SUBJECT_OPENERS = /^(some|most|many|each|both|none|everything|nothing|these|those|this|that|your body|your doctor|your provider|your labs|your results|the goal|the result|the answer|the difference|the problem|the point|the reason|the data|the research|the evidence|the science|the math)\b/;
const VERBISH = /\b(is|are|was|were|has|have|had|can|can't|cannot|will|won't|do|does|don't|doesn't|did|didn't|need|needs|means|matters|works|helps|feel|feels|get|gets|show|shows|tells|makes|keeps|stays|takes|comes|goes|isn't|aren't|wasn't|should|would|could|may|might|must|produces|builds|applies|resolves|requires|depends|looks|reflects|affects|increases|decreases|drops|rises|causes|delivers|targets|remains|becomes|includes|carries|uses|gives|lets|happens|starts|lasts|varies|differs|changes|improves|declines|falls|occurs|leads|explains|signals|tracks|catches|misses|costs|runs|says)\b/;

function lastSentence(s) {
    const m = /(?:^|[.?!]["'”’)]*\s)([^.?!]*)$/.exec(s);
    return (m ? m[1] : s).trim();
}
function firstSentence(s) {
    const m = /^(.*?[.?!])(?=\s|$)/.exec(s);
    return (m ? m[1] : s).trim();
}
function isListy(s) {
    const sent = firstSentence(s).replace(/[.?!]$/, '');
    if (/^\S+(ing|ed)\b/i.test(sent) || /^(and|or|but|so|not|which|because|especially|particularly|primarily|mostly|mainly|often|usually|typically|including|meaning|from|for|with|in|on|at|by|to|of|as|if|when|while|after|before)\b/i.test(sent)) return false;
    const parts = sent.split(/,\s*/);
    if (parts.length < 3) return false;
    const last = parts.pop();
    return parts.every(p => words(p.replace(/^(and|or)\s+/, '')).length <= 4) && words(last.replace(/^(and|or)\s+/, '')).length <= 7;
}
function shortPhrase(s, max) {
    const w = words(s.replace(/[.?!]$/, ''));
    if (!w.length || w.length > max) return false;
    return !/[,;:]/.test(s);
}
function looksLabel(left) {
    const w = words(left);
    return w.length > 0 && w.length <= 6 && !TERM.test(left) && !/[,;]/.test(left);
}

// ---------------------------------------------------------------- per file

function collectSegments(src, file) {
    // Returns {comments:[[s,e]], textSegs:[[s,e,kind]], titles:[[s,e]]}
    const ext = extname(file);
    const comments = [];
    const segs = [];
    const titles = [];
    if (ext === '.js' || ext === '.mjs' || ext === '.ts') {
        const lx = lexJs(src);
        comments.push(...lx.comments);
        for (const [s, e] of lx.strings) segs.push([s, e, 'jsstr']);
        return { comments, segs, titles };
    }
    if (ext === '.txt' || ext === '.md') {
        if (file.endsWith('robots.txt')) {
            // comments only
            const re = /#[^\n]*/g; let m;
            while ((m = re.exec(src))) comments.push([m.index, m.index + m[0].length]);
        }
        segs.push([0, src.length, 'text']);
        return { comments, segs, titles };
    }
    if (ext === '.json') { segs.push([0, src.length, 'text']); return { comments, segs, titles }; }
    // html / xml
    const regions = htmlRegions(src);
    for (const r of regions) {
        if (r.kind === 'comment' || r.kind === 'style') comments.push([r.start, r.end]);
        else if (r.kind === 'script' || r.kind === 'jsonld') {
            const lx = lexJs(src, 0, r.start, r.end);
            comments.push(...lx.comments);
            for (const [s, e] of lx.strings) segs.push([s, e, r.kind === 'jsonld' ? 'jsonld' : 'jsstr']);
        }
    }
    const tRe = /<title>([\s\S]*?)<\/title>/gi; let m;
    while ((m = tRe.exec(src))) { const s = m.index + 7; titles.push([s, s + m[1].length]); }
    const metaRe = /<meta\b[^>]*(?:property|name)=["'](?:og:title|twitter:title)["'][^>]*>/gi;
    while ((m = metaRe.exec(src))) {
        const cm = /content=(["'])([\s\S]*?)\1/.exec(m[0]);
        if (cm) { const s = m.index + cm.index + 9; titles.push([s, s + cm[2].length]); }
    }
    return { comments, segs, titles, regions };
}

const inRange = (ranges, i) => ranges.find(r => i >= r[0] && i < r[1]);

export function processSource(src, file) {
    const { comments, segs, titles, regions } = collectSegments(src, file);
    const isHtml = ['.html', '.xml'].includes(extname(file));
    const occ = [];
    let m;
    DASH_RE.lastIndex = 0;
    while ((m = DASH_RE.exec(src))) occ.push({ start: m.index, end: m.index + m[0].length, raw: m[0], ent: /&/.test(m[0]), esc: /\\u2014/i.test(m[0]) });
    if (!occ.length) return { out: src, log: [] };

    for (const o of occ) {
        const dashPos = o.start + o.raw.search(DASH_ONE);
        o.dashPos = dashPos;
        if (inRange(comments, dashPos)) { o.ctx = 'comment'; continue; }
        if (inRange(titles, dashPos)) { o.ctx = 'title'; continue; }
        let seg = inRange(segs, dashPos);
        if (seg) { o.lo = seg[0]; o.hi = seg[1]; o.ctx = seg[2]; }
        else if (isHtml) {
            const inScript = regions.find(r => (r.kind === 'script' || r.kind === 'jsonld') && dashPos >= r.start && dashPos < r.end);
            if (inScript) { o.ctx = 'comment'; continue; } // code outside strings: treat as code
            const tag = enclosingTag(src, dashPos, 0, src.length);
            if (tag) {
                // attribute value
                const tagSrc = src.slice(tag.start, tag.end);
                const aRe = /([a-zA-Z:-]+)\s*=\s*(["'])([\s\S]*?)\2/g; let am;
                while ((am = aRe.exec(tagSrc))) {
                    const vs = tag.start + am.index + am[0].indexOf(am[2]) + 1;
                    const ve = vs + am[3].length;
                    if (dashPos >= vs && dashPos < ve) { o.lo = vs; o.hi = ve; o.ctx = 'attr'; o.attr = am[1].toLowerCase(); break; }
                }
                if (!o.ctx) { o.ctx = 'attr'; o.lo = tag.start; o.hi = tag.end; }
            } else { o.ctx = 'html'; o.lo = 0; o.hi = src.length; }
        } else { o.ctx = 'text'; o.lo = 0; o.hi = src.length; }
        // block boundaries inside the segment (HTML inside strings too)
        const bl = blockLeft(src, o.lo, o.start);
        o.bLo = bl.start; o.inAnchor = bl.inAnchor; o.tag = bl.tag;
        o.bHi = blockRight(src, o.end, o.hi);
        if (o.ctx === 'text' || o.ctx === 'html') {
            // plain text files: a blank line or a markdown list/heading bullet ends a block
            const prevNl = src.lastIndexOf('\n', o.start - 1);
            const nextNl = src.indexOf('\n', o.end);
            if (o.ctx === 'text') { o.bLo = Math.max(o.bLo, prevNl + 1); o.bHi = Math.min(o.bHi, nextNl === -1 ? src.length : nextNl); }
        }
        o.left = plain(src.slice(o.bLo, o.start)).trim();
        o.right = plain(src.slice(o.end, o.bHi)).trim();
        // strip markdown/list markers at block start
        if (o.ctx === 'text') o.left = o.left.replace(/^([-*#>]+|\d+\.)\s*/, '');
        // JS string edge: concatenation continues the sentence
        // JS string edge: concatenation or a template ${...} continues the sentence
        if (o.ctx === 'jsstr' && o.bHi === o.hi && (/^\s*['"`]?\s*\+/.test(src.slice(o.hi, o.hi + 4)) || src.startsWith('${', o.hi))) o.right = o.right || 'x';
        if (o.ctx === 'jsstr' && o.bLo === o.lo && (/\+=?\s*$/.test(src.slice(Math.max(0, o.lo - 5), o.lo - 1)) || src[o.lo - 1] === '}')) o.left = o.left || 'x';
    }

    // pair detection (rule 3): two dashes in the same block and sentence
    for (let k = 0; k < occ.length - 1; k++) {
        const a = occ[k], b = occ[k + 1];
        if (a.pair || ['comment', 'title'].includes(a.ctx) || a.ctx !== b.ctx || a.bLo !== b.bLo || a.bHi !== b.bHi) continue;
        if (!a.left || !b.right) continue;
        if (/^[$\d]/.test(a.right)) continue; // label · value lists, not a parenthetical
        const between = plain(src.slice(a.end, b.start)).trim();
        if (!between || /[.?!]["'”’)]*\s/.test(between + ' ') && /[.?!]["'”’)]*$/.test(between)) continue;
        if (/[.?!]\s/.test(between)) continue;
        if (words(between).length > 25) continue;
        if (looksLabel(a.left) && words(a.left).length <= 4 && !/^[a-z]/.test(between)) continue; // label: description, handled singly
        a.pair = 'open'; b.pair = 'close';
        a.parens = b.parens = /,/.test(between);
        a.inner = b.inner = between;
    }

    const log = [];
    let out = '';
    let cursor = 0;
    let pendingCap = false;
    for (const o of occ) {
        const { rule, rep, cap } = decide(o, src);
        o.rule = rule; o.rep = rep; o.cap = !!cap;
        out += pendingCap ? capFirst(src.slice(cursor, o.start)) : src.slice(cursor, o.start);
        out += rep;
        pendingCap = !!cap;
        cursor = o.end;
    }
    out += pendingCap ? capFirst(src.slice(cursor)) : src.slice(cursor);
    for (const o of occ) {
        const line = src.slice(0, o.start).split('\n').length;
        const b0 = Math.max(0, o.start - 60), a1 = Math.min(src.length, o.end + 60);
        const before = src.slice(b0, a1).replace(/\s+/g, ' ');
        const tail = src.slice(o.end, a1);
        const after = (src.slice(b0, o.start) + o.rep + (o.cap ? capFirst(tail) : tail)).replace(/\s+/g, ' ');
        log.push({ line, rule: o.rule, ctx: o.ctx + (o.attr ? ':' + o.attr : '') + (o.tag ? '<' + o.tag + '>' : '') + (o.inAnchor ? '+a' : ''), before, after });
    }
    return { out, log };
}

// Upper-case the first letter of a text chunk, skipping leading tags, entities and quotes.
function capFirst(str) {
    let j = 0;
    while (j < str.length) {
        if (str[j] === '<') { const gt = str.indexOf('>', j); if (gt === -1) return str; j = gt + 1; continue; }
        if (str[j] === '&') { const semi = str.indexOf(';', j); if (semi > j && semi - j < 10) { j = semi + 1; continue; } }
        if (/[a-z]/.test(str[j])) return str.slice(0, j) + str[j].toUpperCase() + str.slice(j + 1);
        if (/[A-Z0-9$]/.test(str[j])) return str;
        j++;
    }
    return str;
}

function nlOf(raw) {
    // keep a line break (and following indentation) if the dash token spanned one
    const m = /\r?\n[ \t]*/.exec(raw);
    return m ? m[0] : ' ';
}

function decide(o, src) {
    const d = decideRaw(o, src);
    // inside an open parenthesis, a colon or full stop reads badly: use a semicolon
    const L = o.left || '';
    const openParen = (lastSentence(L).match(/\(/g) || []).length > (lastSentence(L).match(/\)/g) || []).length;
    if (openParen && /\)/.test(o.right || '') && ['5L', '4', '4b', '2b'].includes(d.rule) && !o.pair) {
        return { rule: d.rule + ';', rep: ';' + nlOf(o.raw) };
    }
    return d;
}

function decideRaw(o, src) {
    const raw = o.raw;
    const sp = nlOf(raw);
    const hadSpace = /\s/.test(raw.replace(DASH_ONE, '|').split('|')[1] || '') || /\s/.test(raw.replace(DASH_ONE, '|').split('|')[0] || '');
    const L = o.left || '';
    const R = o.right || '';
    const mid = o.ent ? '&middot;' : o.esc ? '\\u00b7' : '·';
    if (o.ctx === 'comment') return { rule: 'C', rep: raw.replace(DASH_ONE, '-') };
    if (o.ctx === 'title') return { rule: '1', rep: ' | ' };
    if (o.ctx === 'jsstr' && /(document\.title\s*=|\b(const|let|var)\s+title\s*=)[^;\n]*$/.test(src.slice(Math.max(0, o.start - 200), o.start))) return { rule: '1', rep: ' | ' };
    if (!L && !R) return { rule: 'S', rep: hadSpace ? ' · ' : '-' };
    // one side is a concatenated or interpolated value
    if (L === 'x' && R === 'x') return { rule: 'S', rep: hadSpace ? ' · ' : '-' };
    if (L === 'x') return /^[A-Z]/.test(R) ? { rule: '4', rep: '.' + sp } : { rule: '5', rep: ',' + sp };
    if (R === 'x') return { rule: '2', rep: hadSpace ? ': ' : ':' };
    const prevCh = src[o.start - 1] || '';
    const nextCh = src[o.end] || '';
    if (!hadSpace && /\d/.test(prevCh) && /\d/.test(nextCh)) return { rule: 'R', rep: o.ent ? '&ndash;' : '–' };
    if (!L) return { rule: '6', rep: /\n/.test(raw) ? raw.replace(new RegExp('[ \\t]*' + DASH_SRC + '[ \\t]*', 'i'), '') : '' };
    if (!R) return { rule: 'E', rep: /\n/.test(raw.split(DASH_ONE)[1]) ? nlOf(raw.split(DASH_ONE)[1]) : '' };
    // right side opens with punctuation: just drop the dash
    if (/^[.,;:?!)]/.test(R)) return { rule: 'E', rep: '' };
    const leftEnd = L.slice(-1);
    if (/[,;:]/.test(leftEnd)) return { rule: '5', rep: sp };
    if (/[.?!]/.test(leftEnd) || /[.?!]["'”’]$/.test(L)) return { rule: '4', rep: sp, cap: true };

    // reference-list entries: keep the publication's subtitle with a colon
    if ((/^\d+\.\s/.test(L) || /^[A-Z][A-Za-z'-]+ [A-Z]{1,3}[,.]/.test(L)) && /\bet al\.|\b(19|20)\d\d;\s?\d+|\bdoi:|\bPMID\b|N Engl J Med|JAMA|Lancet/.test(L + ' ' + R)) return { rule: 'Ref', rep: (/:/.test(lastSentence(L)) || /:/.test(firstSentence(R)) ? ',' : ':') + sp };
    if (o.pair === 'open') return { rule: '3', rep: o.parens ? ' (' : ',' + sp };
    if (o.pair === 'close') {
        if (o.parens) return { rule: '3', rep: ')' + (/^[,.;:?!]/.test(R) ? '' : sp) };
        return { rule: '3', rep: ',' + sp };
    }

    const leftSent = lastSentence(L);
    const rawLeft = src.slice(o.bLo, o.start);
    const openIdx = Math.max(rawLeft.lastIndexOf('<strong'), rawLeft.lastIndexOf('<b>'), rawLeft.lastIndexOf('<b '));
    const strongLabel = /<\/(strong|b)>\s*$/i.test(rawLeft) && openIdx >= 0 && /^[\s•·*\-\d.]*$/.test(plain(rawLeft.slice(0, openIdx))) && words(L).length <= 8;
    const aIdx = rawLeft.lastIndexOf('<a ');
    const linkLabel = /<\/a>\s*$/i.test(rawLeft) && aIdx >= 0 && /^[\s•·*\-\d.]*$/.test(plain(rawLeft.slice(0, aIdx))) && words(L).length <= 12 && /^[A-Z]/.test(R);
    if (linkLabel) return { rule: '2b', rep: ':' + sp };
    // JSON-LD headline / name: colon, or a full stop before a capitalised question
    if (o.ctx === 'jsonld' && /"(headline|name|alternativeHeadline)"\s*:\s*$/.test(src.slice(Math.max(0, o.lo - 40), o.lo - 1))) {
        if (/^[A-Z]/.test(R) && /\?$/.test(R)) return { rule: '1', rep: '.' + sp };
        if (!/\?/.test(L + R)) return { rule: '1', rep: ':' + sp };
    }
    // credentials ("Jane Doe, DNP, APRN — Medical Director"): appositive comma
    if (/,\s*(RN|NP|DC|MD|DO|PA-C|DNP|APRN|FNP-BC|FNP-C|MS|MSc|CNS|LDN|PT|DPT|DACBN|CSCS|PhD|RD)$/.test(L) && /^[A-Z]/.test(R)) return { rule: '2', rep: ',' + sp };

    // "Yes — if ..." / "No — ..." answers
    if (/^(yes|no|not always|sometimes|usually|absolutely|probably|maybe|often|rarely|thanks|thank you|sorry|done|great)$/i.test(L.replace(/^.*[.?!]\s+/, ''))) {
        if (/^[A-Z]/.test(R)) return { rule: '4', rep: '.' + sp };
        if (CLAUSE_OPENERS.test(R.toLowerCase())) return { rule: '4b', rep: '.' + sp, cap: true };
        return { rule: '5', rep: ',' + sp };
    }
    // "(1) One-on-one care — every minute ..." numbered label
    if (/^(\(\d+\)|\d+\.)\s/.test(leftSent) && words(leftSent).length <= 6) return { rule: '2b', rep: ':' + sp };
    // byline or meta line already separated with middots
    if (/ · /.test(R) && words(firstSentence(R)).length <= 6) return { rule: '2', rep: ' ' + mid + sp };
    if (strongLabel) {
        if (/^(\$|\d+ [A-Z])/.test(R)) return { rule: '2', rep: ' ' + mid + sp };
        return { rule: '2b', rep: ':' + sp };
    }
    const rightSent = firstSentence(R);
    const blockRest = R;
    const label = looksLabel(L);
    // rule 2: price / label pair
    const rightIsPrice = /^[$\d]/.test(R);
    const rightShort = (shortPhrase(blockRest, 3) || (shortPhrase(blockRest, 4) && words(blockRest).every(w => /^[A-Z0-9(&$]/.test(w)))) && !CLAUSE_OPENERS.test(blockRest.toLowerCase());
    if (rightIsPrice || rightShort) {
        if (o.inAnchor || o.tag === 'button') return { rule: '2', rep: ',' + sp };
        if (label && /^[A-Z0-9$]/.test(R)) return { rule: '2', rep: ' ' + mid + sp };
        return { rule: '2', rep: ',' + sp };
    }
    // capitalised short phrase closing the sentence (acronym expansion, appositive)
    if (/^[A-Z]/.test(R) && words(rightSent).length <= 5 && /[.?!]$/.test(rightSent) && !CLAUSE_OPENERS.test(R.toLowerCase()) && !VERBISH.test(rightSent.toLowerCase())) {
        return { rule: '2', rep: ',' + sp };
    }
    // lowercase independent clause after a complete clause (before the label rule)
    const lcR = R.toLowerCase();
    if (/^[a-z]/.test(R) && words(leftSent).length >= 3 && (CLAUSE_OPENERS.test(lcR) || (SUBJECT_OPENERS.test(lcR) && VERBISH.test(words(lcR).slice(1, 5).join(' '))))) {
        return { rule: '4b', rep: '.' + sp, cap: true };
    }
    if (label && /:/.test(L) && /^[A-Z]/.test(R)) return { rule: '2', rep: ' ' + mid + sp };
    // rule 2b: short label then a description
    if (label && words(L).length <= 4 && !/^(the|a|an|and|or|but)\b/i.test(R)) return { rule: '2b', rep: ':' + sp };
    // rule 5L: list or explanation
    if (COLON_OPENERS.test(R) || isListy(R) || (/^(which|what|how|why|who|when|where)\b/i.test(R) && /\?$/.test(rightSent))) {
        if (!/^(which|what|how|why|who|when|where)\b/i.test(R) || /\?$/.test(rightSent)) return { rule: '5L', rep: ':' + sp };
    }
    // rule 4: capital after a complete clause
    if (/^[A-Z]/.test(R) && !/^I\b/.test(R)) {
        if (words(leftSent).length >= 3 || /\?$/.test(rightSent)) return { rule: '4', rep: '.' + sp };
        return { rule: '2b', rep: ':' + sp };
    }
    if (/^I\b/.test(R) && words(leftSent).length >= 3) return { rule: '4', rep: '.' + sp };
    // lowercase determiner + noun + finite verb: a new sentence, not an appositive
    if (words(leftSent).length >= 4 && DETS.test(lcR)) {
        const head = words(lcR).slice(1, 5);
        const pronounDet = /^(these|those|most|some|many|all|both|none|everything|nothing|something|anything|patients|people|women|men|results|levels)$/.test(words(lcR)[0]);
        let vi = head.findIndex(w => VERBISH.test(w));
        if (vi < 0) vi = head.findIndex((w, k) => BASE_VERBS.test(w) && (k >= 1 || pronounDet));
        const rel = head.findIndex(w => /^(that|which|who|whose|where|when)$/.test(w));
        if (vi >= 0 && (rel < 0 || rel > vi)) return { rule: '4b', rep: '.' + sp, cap: true };
    }
    // noun-led independent clause ("dehydration makes veins harder to find")
    if (words(leftSent).length >= 4 && /^[a-z]/.test(R)) {
        const w = words(firstSentence(R).toLowerCase().replace(/[.,;:?!)"\u201d]+/g, ' '));
        const NOT_SUBJECT = /^(about|above|across|after|against|along|among|around|as|at|before|behind|below|beneath|beside|between|beyond|by|despite|down|during|except|for|from|in|inside|into|like|near|of|off|on|onto|out|outside|over|past|per|since|than|through|throughout|to|toward|towards|under|until|up|upon|via|with|within|without|and|or|but|nor|so|yet|because|although|though|unless|whether|if|when|whenever|where|while|which|what|who|whom|whose|why|how|that|often|even|still|just|only|also|especially|particularly|usually|typically|sometimes|not|never|always|almost|roughly|nearly|far|much|more|less|well|very|too|plus|including|such|then|now|ideally|either|neither|every|any|no)$/;
        if (w.length >= 4 && !NOT_SUBJECT.test(w[0]) && !/(ly|ing|ed)$/.test(w[0]) && !/^[\d$]/.test(w[0]) && !DETS.test(w[0])) {
            for (let k = 1; k <= 2; k++) {
                const v = w[k] || '';
                const prev = w[k - 1];
                if (/['\u2019]/.test(v)) break;
                const next = w[k + 1] || '';
                const sVerb = /^[a-z]+[^su']s$/.test(v) && !/(ss|us|is|ics|ness)$/.test(v) && !/s$/.test(prev) && !NOT_SUBJECT.test(next) && !/(ed|ing)$/.test(next) && !/^[\d$]/.test(next) && !/^(one|two|three|four|five|six|seven|eight|nine|ten|fewer|more|less|greater|lower|higher|slower|faster|better|worse|dense)$/.test(w[0]);
                if (VERBISH.test(v) || sVerb) return { rule: '4b', rep: '.' + sp, cap: true };
                if (NOT_SUBJECT.test(v)) break;
            }
        }
    }
    return { rule: '5', rep: ',' + sp };
}

// ---------------------------------------------------------------- main

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
    const files = explicit.length ? explicit.map(f => join(process.cwd(), f)) : walk(ROOT);
    const lines = [];
    const counts = {};
    let total = 0;
    for (const f of files) {
        const src = readFileSync(f, 'utf8');
        if (!DASH_ONE.test(src)) continue;
        const { out, log } = processSource(src, f);
        for (const e of log) {
            counts[e.rule] = (counts[e.rule] || 0) + 1;
            total++;
            lines.push(`${relative(ROOT, f)}:${e.line}\t[${e.rule}]\t${e.ctx}\n  - ${e.before}\n  + ${e.after}`);
        }
        if (!dry && out !== src) writeFileSync(f, out);
    }
    const summary = `replacements: ${total}\nby rule: ${Object.entries(counts).sort().map(([k, v]) => `${k}=${v}`).join(' ')}\n`;
    if (reportPath) {
        mkdirSync(dirname(reportPath), { recursive: true });
        writeFileSync(reportPath, summary + '\n' + lines.join('\n') + '\n');
    }
    process.stdout.write(summary);
}
