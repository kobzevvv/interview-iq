# Bug #299 — Root Cause Analysis (step 3/13, root-cause)

Issue: https://github.com/enginow-in/interview-iq/issues/299
Work repo (FORK): https://github.com/kobzevvv/interview-iq (branch eng/playbooks-e2e-plan-ac8b8492)

## Root cause (confirmed by reproduction)

`submitAnswer` (server/controllers/interview.controller.js:226) reads `questionIndex`
straight from `req.body` and uses it directly as an array index:

```js
const question = interview.questions[questionIndex]   // line 231
if (!answer) {
  question.score = 0;                                  // 💥 line 235
```

- `questionIndex` is **never validated**: no type check, no bounds check, no presence check.
- For `questionIndex` missing / `-1` / `99` / `"abc"` / any non-integer or out-of-range value,
  `interview.questions[questionIndex]` returns `undefined`.
- Dereferencing `question.score` (empty-answer path) throws
  `TypeError: Cannot set properties of undefined (setting 'score')` — the exact issue text.
- On the truthy-answer path the first deref is `question.timeLimit` (line 247) → same root cause,
  different message (`reading 'timeLimit'`).

Reproduction: `cd server && npm test` → exit 0 = bug reproduced (harness `server/test/repro-299.mjs`,
commits dfd0667/a82fe88). All 5 invalid variants → 500; valid index → 200.

## 5 Whys (symptom → source)

1. Why the crash? `question.score = 0` executed on `undefined`.
2. Why is `question` undefined? `interview.questions[questionIndex]` returned `undefined`.
3. Why did the index access return undefined? `questionIndex` was missing/non-numeric/out-of-bounds.
4. Why was such an index accepted? The controller performs zero validation of `questionIndex` (and of `interviewId`).
5. Why no validation/tests? No input-validation layer (no zod/joi/express-validator), no tests, no CI.
   The codebase trusts the client; only the happy path was ever exercised.

Data → code → contract → process:
- **Data/code**: unvalidated index into a nested array.
- **Contract**: API expects `questionIndex` to be a valid 0-based integer, but the contract is
  implicit — nothing enforces it server-side.
- **Process**: no negative-path tests, no CI, no input schema → defect shipped in Initial commit.

## Git bisect
⏭ Not applicable. Bug present since Initial commit (5bf9487); repo has exactly 3 commits,
nothing "changed recently" to bisect. "Раньше работало" — нет, не работало никогда.

## Why wasn't this caught earlier (missing check)
- **Missing:** any negative-path test on `submitAnswer` (repo has zero tests at all).
- **Missing:** input-validation layer / schema for request bodies.
- **Missing:** CI that runs tests on push/PR (no CI exists).
- **Missing:** error handler would mask it anyway — every error is folded into
  `500 {message: "failed to submit answer " + error}`.

## Same pattern elsewhere (scan of server/controllers)
- **interview.controller.js:231** `interview.questions[questionIndex]` — THE bug.
- **interview.controller.js:230** `Interview.findById(interviewId)` then `interview.questions`
  — adjacent latent bug: invalid/missing `interviewId` → `interview` is null →
  `Cannot read properties of null (reading 'questions')`. Guard needed in same fix.
- **interview.controller.js:340/415** `finishInterview` / `getInterviewReport` DO check `if (!interview)`
  — correct pattern to follow.
- **interview.controller.js:97** `generateQuestion` checks `if (!user)` — correct pattern.
- **user.controller.js:8**, **payment.controller.js:9** — check nulls/required fields — correct pattern.
- Conclusion: `submitAnswer` is the **only** controller missing both guards
  (null check + index validation). No other unvalidated array-index access exists in the repo.

## Fix direction (for step 4)
1. 404 if `interview` not found (aligns with finishInterview/getInterviewReport).
2. 400 if `questionIndex` is not an integer within `[0, interview.questions.length)`.
3. Keep behavior otherwise unchanged; extend `server/test/repro-299.mjs` as regression tests.