import Interview from "../models/interview.model.js";
import { submitAnswer } from "../controllers/interview.controller.js";

Interview.findById = async () => ({
  questions: [{ question: "Q1", timeLimit: 60, score: 0, feedback: "", answer: "" }],
  save: async () => {},
});

const res = {
  _status: 200,
  _body: null,
  status(code) { this._status = code; return this; },
  json(body) { this._body = body; },
};

const scenario = async (name, body, expectStatus) => {
  res._status = 200;
  res._body = null;
  try {
    await submitAnswer({ body }, res);
    const ok = res._status === expectStatus;
    console.log(
      `${ok ? "PASS" : "FAIL"}: ${name} -> status=${res._status} (expected ${expectStatus}), body=${JSON.stringify(res._body)}`
    );
    return ok;
  } catch (e) {
    console.log(`ERROR: ${name} -> threw ${e.constructor.name}: ${e.message}`);
    return false;
  }
};

const positive = await scenario("valid questionIndex + empty answer -> 200", { interviewId: "fakeid", questionIndex: 0, answer: "" }, 200);
const missingEmpty = await scenario("questionIndex missing + empty answer -> 500 (issue error)", { interviewId: "fakeid", answer: "" }, 500);
const missing = await scenario("questionIndex missing -> 500", { interviewId: "fakeid", answer: "a" }, 500);
const outOfRange = await scenario("questionIndex 5 (out of range) -> 500", { interviewId: "fakeid", questionIndex: 5, answer: "a" }, 500);
const negative = await scenario("questionIndex -1 -> 500", { interviewId: "fakeid", questionIndex: -1, answer: "a" }, 500);
const nonNumeric = await scenario("questionIndex 'abc' -> 500", { interviewId: "fakeid", questionIndex: "abc", answer: "a" }, 500);

const exactIssueError = res._body && typeof res._body.message === "string" &&
  res._body.message.includes("Cannot set properties of undefined (setting 'score')");

if (positive && missingEmpty && missing && outOfRange && negative && nonNumeric) {
  if (exactIssueError) console.log("R5+exact: error text matches issue #299 (setting 'score')");
  else console.log("R5 (exact message not on this last scenario — see individual scenarios above)");
  console.log("R5: bug reproduced — all invalid questionIndex variants return 500");
  process.exit(0);
} else {
  console.log("R5: bug NOT reproduced");
  process.exit(1);
}