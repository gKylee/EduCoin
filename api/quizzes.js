const fs = require("fs");
const path = require("path");
const { ok, bad, methodNotAllowed } = require("./_util");

function loadQuizzes() {
  const p = path.join(process.cwd(), "quizzes", "quizzes.json");
  const raw = fs.readFileSync(p, "utf8");
  const parsed = JSON.parse(raw);
  const quizzes = (parsed.quizzes || []).map((q) => ({
    id: q.id,
    title: q.title,
    description: q.description || "",
    reward: q.reward,
    perCorrect: q.perCorrect,
    questionCount: (q.questions || []).length,
  }));
  return quizzes;
}

module.exports = async (req, res) => {
  if (req.method !== "GET") return methodNotAllowed(res);
  try {
    const quizzes = loadQuizzes();
    ok(res, { quizzes });
  } catch (e) {
    bad(res, 500, "QUIZ_LOAD_ERROR", { message: e.message });
  }
};

