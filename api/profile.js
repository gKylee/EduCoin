const { ok, bad, methodNotAllowed, sbFetch, usernameIsValid } = require("./_util");

module.exports = async (req, res) => {
  if (req.method !== "GET") return methodNotAllowed(res);

  const url = new URL(req.url, "http://localhost");
  const username = (url.searchParams.get("username") || "").trim();
  if (!usernameIsValid(username)) return bad(res, 400, "INVALID_USERNAME");

  const q = await sbFetch(
    `/rest/v1/users?username=eq.${encodeURIComponent(username)}&select=username,balance,created_at&limit=1`,
    { method: "GET" }
  );
  if (!q.ok) return bad(res, 500, "DB_ERROR", { detail: q.data });
  if (!Array.isArray(q.data) || q.data.length === 0) return bad(res, 404, "NOT_FOUND");

  const user = q.data[0];
  return ok(res, { username: user.username, balance: user.balance ?? 0, created_at: user.created_at });
};

