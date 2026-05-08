const { ok, bad, methodNotAllowed, readBody, sbFetch, usernameIsValid, isUniqueViolation } = require("./_util");

module.exports = async (req, res) => {
  if (req.method !== "POST") return methodNotAllowed(res);

  const rb = await readBody(req);
  if (!rb.ok) return bad(res, 400, "BAD_JSON");
  const username = (rb.body?.username || "").trim();
  if (!usernameIsValid(username)) return bad(res, 400, "INVALID_USERNAME");

  // Try insert; rely on UNIQUE(users.username)
  const insert = await sbFetch("/rest/v1/users", {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: { username },
  });

  if (!insert.ok) {
    if (isUniqueViolation(insert.status, insert.data)) return bad(res, 409, "USERNAME_TAKEN");
    return bad(res, 500, "DB_ERROR", { detail: insert.data });
  }

  const user = Array.isArray(insert.data) ? insert.data[0] : insert.data;
  return ok(res, { username: user.username, balance: user.balance ?? 0, created_at: user.created_at });
};

