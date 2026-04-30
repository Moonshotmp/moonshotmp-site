# moonshotmp-site — Test Harness

Vitest-powered unit tests for the recommendation engines and scoring
instruments behind the Moonshot Medical quiz funnel.

## Why this exists

The peptide quiz at `/quiz/peptides/` converts at 10.3% CTR. Every new
quiz we ship (menopause, andropause, sleep apnea, bone density) will
include an algorithmic component — a scoring instrument or a
recommendation engine. **An algorithm that misclassifies a patient is
medico-legal exposure.** A STOP-BANG that calls a high-risk OSA patient
"low risk", an MRS that calls a severe-symptom patient "moderate", or a
peptide engine that recommends Wolverine to someone who can't afford it
— each one is a defensible-design problem.

This harness pins behavior in CI so we can ship fast without breaking
trust.

## Quick start

```bash
npm install
npm run test:run     # one-shot, exits with status code
npm run test         # watch mode
```

Tests live under `tests/`. Each `*.test.js` file is run in isolation in
the Node environment (no jsdom — tests target pure logic, not DOM).

## Files

- `tests/peptide-recommendation.test.js` — pins the peptide quiz
  recommendation engine. Covers every goal × concern × budget branch,
  the budget guard, and catalog integrity.
- `tests/scoring-helpers.test.js` — `it.todo()` placeholders for
  validated screening instruments (MRS, ADAM, STOP-BANG, OST, BMI).
  The expected behavior is encoded in the test names. When the
  instruments ship, replace `it.todo` with `it` and add assertions.

## The IIFE testability problem

Most of the moonshotmp-site quizzes are vanilla-JS IIFEs loaded as
non-module `<script>` tags. They run side effects on import — DOM
lookups, event listeners, `getElementById('quiz-root')`, etc. You
**cannot** import them in Vitest without those side effects firing
(and crashing the test, since Node has no `document`).

### How we handle this

For the peptide quiz we **extracted the pure recommendation logic** to
a sibling module:

- `quiz/peptides/quiz-engine.js` — the live IIFE (UI, state, events,
  recommendation logic)
- `quiz/peptides/recommendation.js` — a pure ESM module exporting just
  `getRecommendation`, `budgetValue`, `PEPTIDES`, and `secondaryMap`

`recommendation.js` is the canonical, tested copy. `quiz-engine.js`
keeps a private duplicate of the logic so it can run as a non-module
script tag without a build step. **The two MUST stay in sync.**

When you change recommendation logic:
1. Edit `quiz/peptides/recommendation.js` (the canonical copy).
2. Mirror the change in `quiz/peptides/quiz-engine.js` (the IIFE copy).
3. Update tests if behavior changed; otherwise tests should still pass.
4. Run `npm run test:run` and confirm zero failures.
5. Manually QA the live quiz at `/quiz/peptides/` — load the page,
   complete the flow with a known input, verify the recommendation
   matches the test fixture for that input.

For **future quizzes**, do not duplicate. Build the new quiz so the
non-module IIFE consumes a global exposed by an ESM module loaded
through a separate `<script type="module">` tag, or just adopt a build
step. Duplication was a pragmatic one-time choice for the existing
peptide engine to avoid risk to a production conversion surface.

## Adding tests for a new quiz

Template:

1. **Extract the pure logic.** Create
   `quiz/<topic>/<topic>-recommendation.js` (or
   `shared/scoring/<instrument>.js`) with named exports for the pure
   functions. No DOM, no globals, no side effects.

2. **Create the test file.** `tests/<topic>-recommendation.test.js`
   following the structure in `peptide-recommendation.test.js`:
   - Describe block per logical surface (mapping fns, primary
     selection, secondary selection, edge cases).
   - Use `it.each` for table-driven tests covering every branch.
   - Test names should read like patient scenarios so failures
     diagnose themselves: `"injury + tendon at premium budget
     recommends Wolverine Blend"` not `"test case 14"`.

3. **Cover boundary conditions explicitly.** Off-by-one errors in
   threshold logic (e.g. STOP-BANG count of 3 = intermediate, not low)
   are the most common scoring bug. Pin both sides of every boundary.

4. **Cover catalog integrity.** Iterate the recommendation map and
   assert every referenced key resolves to a real entry. Catches
   typos that would otherwise return `undefined` to the results
   screen.

5. **Cover the dead-code defensive branches.** If the logic has a
   guard for a case that doesn't currently fire (e.g. the peptide
   engine's premium-secondary downgrade), assert that fact so a
   future change that activates the guard is detected.

## What NOT to test

- Don't test DOM rendering inside Vitest — we don't load jsdom and
  shouldn't. Use Playwright for end-to-end UI tests if/when that
  becomes warranted.
- Don't test analytics calls (`window.gtag`) — those are integration
  concerns, mock or skip them.
- Don't test `localStorage` persistence — same.
- Don't test the IIFE engines directly — they have unavoidable DOM
  side effects on import. Test the extracted pure module instead.

## CI

Not yet wired into CI. When wiring: `npm run test:run` is the
single command to invoke. Exit code is non-zero on any failure.
GitHub Actions or Netlify build hooks both work. Add a check to
the deploy pipeline so a failing test blocks merge to `main`.
