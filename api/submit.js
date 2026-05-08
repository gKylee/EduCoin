const fs = require("fs");
const path = require("path");
const {
  ok,
  bad,
  methodNotAllowed,
  readBody,
  sbFetch,
  usernameIsValid,
  isUniqueViolation,
} = require("./_util");

function loadQuizWithAnswers(id) {
  const p = path.join(process.cwd(), "quizzes", "quizzes.json");
  const raw = fs.readFileSync(p, "utf8");
  const parsed = JSON.parse(raw);
  return (parsed.quizzes || []).find((x) => x.id === id) || null;
}

function countCorrect(quiz, answers) {
  const qs = quiz.questions || [];
  let correct = 0;
  for (let i = 0; i < qs.length; i++) {
    const a = answers[i];
    if (Number.isInteger(a) && a === qs[i].answerIndex) correct++;
  }
  return correct;
}

async function rpcAwardQuiz({ username, quizId, earned }) {
  // Optional: if you created the RPC in Supabase, this is atomic.
  return sbFetch("/rest/v1/rpc/award_quiz", {
    method: "POST",
    body: { p_username: username, p_quiz_id: quizId, p_earned: earned },
  });
}

async function fallbackAwardQuiz({ username, quizId, earned }) {
  // 1) Insert attempt (unique constraint prevents re-claim)
  const ins = await sbFetch("/rest/v1/quiz_attempts", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: { username, quiz_id: quizId, earned },
  });
  if (!ins.ok) {
    if (isUniqueViolation(ins.status, ins.data)) return { ok: false, status: 409, error: "ALREADY_ATTEMPTED" };
    return { ok: false, status: 500, error: "DB_ERROR", detail: ins.data };
  }

  // 2) Increment balance using a single SQL expression is not available via PostgREST PATCH.
  // We read + write. This is not perfectly atomic but is acceptable for MVP.
  const q = await sbFetch(`/rest/v1/users?username=eq.${encodeURIComponent(username)}&select=balance&limit=1`);
  if (!q.ok) return { ok: false, status: 500, error: "DB_ERROR", detail: q.data };
  const balance = (Array.isArray(q.data) && q.data[0]?.balance != null) ? Number(q.data[0].balance) : 0;
  const next = balance + earned;

  const upd = await sbFetch(`/rest/v1/users?username=eq.${encodeURIComponent(username)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: { balance: next },
  });
  if (!upd.ok) return { ok: false, status: 500, error: "DB_ERROR", detail: upd.data };
  const user = Array.isArray(upd.data) ? upd.data[0] : upd.data;
  return { ok: true, balance: user.balance ?? next };
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return methodNotAllowed(res);

  const rb = await readBody(req);
  if (!rb.ok) return bad(res, 400, "BAD_JSON");

  const username = (rb.body?.username || "").trim();
  const quizId = (rb.body?.quizId || "").trim();
  const answers = rb.body?.answers;

  if (!usernameIsValid(username)) return bad(res, 400, "INVALID_USERNAME");
  if (!quizId) return bad(res, 400, "MISSING_QUIZ");
  if (!Array.isArray(answers)) return bad(res, 400, "BAD_ANSWERS");

  let quiz;
  try {
    quiz = loadQuizWithAnswers(quizId);
  } catch (e) {
    return bad(res, 500, "QUIZ_LOAD_ERROR", { message: e.message });
  }
  if (!quiz) return bad(res, 404, "QUIZ_NOT_FOUND");

  const totalQuestions = (quiz.questions || []).length;
  if (answers.length !== totalQuestions) return bad(res, 400, "BAD_ANSWERS_LENGTH");

  const correctCount = countCorrect(quiz, answers);
  const perCorrect = Number(quiz.perCorrect ?? 0);
  const maxReward = Number(quiz.reward ?? 0);
  const earned = Math.max(0, Math.min(maxReward, correctCount * perCorrect));

  // Ensure user exists (and also prevents awarding to non-registered usernames)
  const userQ = await sbFetch(`/rest/v1/users?username=eq.${encodeURIComponent(username)}&select=username&limit=1`);
  if (!userQ.ok) return bad(res, 500, "DB_ERROR", { detail: userQ.data });
  if (!Array.isArray(userQ.data) || userQ.data.length === 0) return bad(res, 404, "USER_NOT_FOUND");

  // Prefer atomic RPC if present; fallback otherwise
  const rpc = await rpcAwardQuiz({ username, quizId, earned });
  if (rpc.ok) {
    // RPC should return new balance
    const newBalance =
      (typeof rpc.data === "number" ? rpc.data : rpc.data?.balance ?? rpc.data?.new_balance ?? null) ?? null;
    return ok(res, { earned, correctCount, totalQuestions, balance: newBalance });
  }

  // Detect missing function and fallback
  const msg = (rpc.data?.message || rpc.data?.hint || rpc.data?.error || "").toString().toLowerCase();
  const missingFn =
    rpc.status === 404 ||
    msg.includes("could not find the function") ||
    msg.includes("function") && msg.includes("does not exist");

  if (!missingFn && rpc.status === 409) {
    return bad(res, 409, "ALREADY_ATTEMPTED");
  }

  const fb = await fallbackAwardQuiz({ username, quizId, earned });
  if (!fb.ok) return bad(res, fb.status || 500, fb.error || "DB_ERROR", { detail: fb.detail });

  return ok(res, { earned, correctCount, totalQuestions, balance: fb.balance });
};

