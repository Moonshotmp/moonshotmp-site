// Owner rule (Tom): no em dashes in public copy. Fails with file:line for any
// em dash in served or sent text: the character, the named or numeric HTML
// entity, or the JS/JSON escape. Fix with `node scripts/strip-em-dashes.mjs`
// (or by hand), not by widening the skips.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const EXTS = new Set(['.html', '.js', '.mjs', '.ts', '.txt', '.xml', '.json', '.md']);
const SKIP_DIRS = new Set(['node_modules', '.git', '.netlify', 'images', 'fonts', 'videos', 'scripts', 'tests']);
const SKIP_FILES = new Set(['package-lock.json']);
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
const EM_DASH = new RegExp([EM, '&mdash;', '&#8212;', '&#x2014;', '\\\\u2014'].join('|'), 'i');

function walk(dir, out = []) {
    for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
            if (!SKIP_DIRS.has(name)) walk(path, out);
        } else if (EXTS.has(extname(name)) && !SKIP_FILES.has(name)) {
            out.push(path);
        }
    }
    return out;
}

describe('no em dashes in served or sent text', () => {
    const files = walk(ROOT);

    it('scans the site (pages, shared JS, quiz engines, email functions) and skips internals', () => {
        const rel = files.map((f) => relative(ROOT, f));
        expect(rel).toContain('index.html');
        expect(rel).toContain('shared/header.js');
        expect(rel).toContain('llms.txt');
        expect(rel.some((f) => f.startsWith('netlify/functions/'))).toBe(true);
        expect(rel.some((f) => /^quiz\/[^/]+\/quiz-engine\.js$/.test(f))).toBe(true);
        expect(rel.some((f) => f.startsWith('node_modules/') || f.startsWith('tests/'))).toBe(false);
    });

    it('catches every spelling of the em dash and leaves en dash ranges alone', () => {
        expect(EM_DASH.test(`Book Lab Work ${EM} $285`)).toBe(true);
        expect(EM_DASH.test('Book Lab Work &mdash; $285')).toBe(true);
        expect(EM_DASH.test('Book Lab Work &#8212; $285')).toBe(true);
        expect(EM_DASH.test("text: 'Book Lab Work \\u2014 $285'")).toBe(true);
        expect(EM_DASH.test(`Ages 20${EN}39, $1,000${EN}1,500`)).toBe(false);
        expect(EM_DASH.test('Book Lab Work, $285')).toBe(false);
    });

    it('finds no em dash anywhere', () => {
        const hits = [];
        for (const file of files) {
            const lines = readFileSync(file, 'utf8').split('\n');
            lines.forEach((line, i) => {
                if (EM_DASH.test(line)) hits.push(`${relative(ROOT, file)}:${i + 1}: ${line.trim().slice(0, 120)}`);
            });
        }
        expect(hits, `em dashes found (run node scripts/strip-em-dashes.mjs):\n${hits.join('\n')}`).toEqual([]);
    });
});
