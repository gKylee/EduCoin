const fs = require("fs");
const path = require("path");
const { ok, bad, methodNotAllowed } = require("./_util");

function loadQuiz(id) {
  const p = path.join(process.cwd(), "quizzes", "quizzes.json");
  const raw = fs.readFileSync(p, "utf8");
  const parsed = JSON.parse(raw);
  const q = (parsed.quizzes || []).find((x) => x.id === id);
  if (!q) return null;
  return {
    id: q.id,
    title: q.title,
    description: q.description || "",
    reward: q.reward,
    perCorrect: q.perCorrect,
    questions: (q.questions || []).map((qq) => ({
      prompt: qq.prompt,
      choices: qq.choices,
    })),
  };
}

module.exports = async (req, res) => {
  if (req.method !== "GET") return methodNotAllowed(res);
  const url = new URL(req.url, "http://localhost");
  const id = url.searchParams.get("id");
  if (!id) return bad(res, 400, "MISSING_ID");
  try {
    const quiz = loadQuiz(id);
    if (!quiz) return bad(res, 404, "NOT_FOUND");
    ok(res, { quiz });
  } catch (e) {
    bad(res, 500, "QUIZ_LOAD_ERROR", { message: e.message });
  }
};

