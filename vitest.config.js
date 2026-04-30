import { defineConfig } from 'vitest/config';

// Vitest config for moonshotmp-site
//
// Tests are pure-logic units (recommendation engine, scoring instruments).
// We deliberately use the `node` environment — no jsdom — to avoid
// accidentally importing browser IIFEs that touch `document` on load.
// Quiz UI engines must NOT be imported in tests; only the extracted
// pure modules (e.g. quiz/peptides/recommendation.js) are testable.
export default defineConfig({
    test: {
        environment: 'node',
        include: ['tests/**/*.test.js'],
        // Don't traverse node_modules or netlify build outputs.
        exclude: ['node_modules/**', '.netlify/**', 'dist/**'],
        globals: false,
        // Fail fast on console.error — recommendation logic should not log.
        // (Vitest does not throw on console.error by default; this is opt-in.)
        clearMocks: true,
        restoreMocks: true
    }
});
