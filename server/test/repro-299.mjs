import Interview from "../models/interview.model.js";
import { submitAnswer } from "../controllers/interview.controller.js";

const foundInterview = () => ({
  questions: [{ question: "Q1", timeLimit: 60, score: 0, feedback: "", answer: "" }],
  save: async () => {},
});

let findByIdImpl = async () => foundInterview();
Interview.findById = (...args) => findByIdImpl(...args);

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
const missingEmpty = await scenario("questionIndex missing + empty answer -> 400 (validation)", { interviewId: "fakeid", answer: "" }, 400);
const missing = await scenario("questionIndex missing -> 400 (validation)", { interviewId: "fakeid", answer: "a" }, 400);
const outOfRange = await scenario("questionIndex 5 (out of range) -> 400 (validation)", { interviewId: "fakeid", questionIndex: 5, answer: "a" }, 400);
const negative = await scenario("questionIndex -1 -> 400 (validation)", { interviewId: "fakeid", questionIndex: -1, answer: "a" }, 400);
const nonNumeric = await scenario("questionIndex 'abc' -> 400 (validation)", { interviewId: "fakeid", questionIndex: "abc", answer: "a" }, 400);
const nonInteger = await scenario("questionIndex 0.5 -> 400 (validation)", { interviewId: "fakeid", questionIndex: 0.5, answer: "a" }, 400);

findByIdImpl = async () => null;
const unknownId = await scenario("unknown interviewId -> 404 (not found)", { interviewId: "missingid", questionIndex: 0, answer: "a" }, 404);
findByIdImpl = async () => foundInterview();

if (positive && missingEmpty && missing && outOfRange && negative && nonNumeric && nonInteger && unknownId) {
  console.log("R5: all invalid questionIndex variants return 400, unknown interviewId -> 404 (bug fixed)");
  process.exit(0);
} else {
  console.log("R5: bug NOT reproduced - some scenarios failed");
  process.exit(1);
}