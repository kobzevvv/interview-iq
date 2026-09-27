# Bug #299 — Context (step 1/13, bug-context)

Issue: https://github.com/enginow-in/interview-iq/issues/299 (open, labels: bug, points: bugfix, priority: low)
Assignee: Vedrob (opened 2026-07-25). Work repo (FORK): https://github.com/kobzevvv/interview-iq (branch eng/playbooks-e2e-plan-ac8b8492).
FORBIDDEN: no writes to enginow-in/interview-iq.

## Report
- Who/what: reporter Vedrob. submitAnswer destructures `questionIndex` from req.body and uses it
  directly as array index with ZERO validation.
- Payloads that crash: `questionIndex` missing, `-1`, `99` (out of bounds), `"abc"` (non-numeric string).
- Exact error: `TypeError: Cannot set properties of undefined (setting 'score')`
- Consequence: raw 500, answer never saved.
- Expected: 400 with descriptive message on invalid index.

## Code (confirmed identical at head, sha d01efeda, in BOTH upstream and fork)
server/controllers/interview.controller.js → `submitAnswer`:
```
const { interviewId, questionIndex, answer, timeTaken } = req.body
const interview = await Interview.findById(interviewId)
const question = interview.questions[questionIndex]   // undefined if index invalid
if (!answer) {
  question.score = 0;                                  // 💥
```
Route: POST /api/interview/submit-answer (interview.route.js, isAuth + submitAnswer).

## History / what changed
- Repo has exactly 3 commits (Initial commit → env templates → README). Bug is present since
  Initial commit (5bf9487 base). Nothing changed "recently" — no deploys/merges/CI that introduced it.
- No tests in repo, no CI, no prod logs available (no deploy per task).

## Related
- qa_log_lookup: 0 hits.
- Upstream PR #302 (open, Vedrob, "Validate questionIndex bounds in submitAnswer") — a fix already
  proposed in the ORIGINAL repo. Read-only note; we work independently in the fork.
- Adjacent latent bug (out of scope): missing/invalid `interviewId` → `interview` is null →
  `interview.questions` throws "Cannot read properties of null (reading 'questions')".
- Unrelated open upstream issues #316, #337, #338.

## R level: R5
- R5 (auto repro, one command): `cd server && npm test` → exit 0 = reproduced.
  Harness: `server/test/repro-299.mjs` imports the real controller, stubs `Interview.findById`,
  asserts HTTP status per scenario. Confirmed crash variants: questionIndex missing, 5, -1, "abc".
  Exact issue text `Cannot set properties of undefined (setting 'score')` on the empty-answer path;
  `Cannot read properties of undefined (reading 'timeLimit')` on the truthy-answer path.
  Positive control (valid index + empty answer → 200) passes — no network involved.
- R3 (clear repro steps from user): 4 concrete payloads + endpoint in issue body. ✅
- R2 (exact non-default error text): confirmed in repro output. ✅
- Note: with a truthy answer the crash surfaces at `question.timeLimit` (line after `question.score=0`),
  with empty/missing answer at `question.score = 0` — same root cause, both covered by the harness.