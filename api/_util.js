function json(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}

function ok(res, obj) {
  json(res, 200, { ok: true, ...(obj || {}) });
}

function bad(res, status, error, extra) {
  json(res, status, { ok: false, error, ...(extra || {}) });
}

function methodNotAllowed(res) {
  bad(res, 405, "METHOD_NOT_ALLOWED");
}

function getEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function usernameIsValid(username) {
  // Keep server rules aligned with frontend:
  // 3-20 chars, letters/numbers/underscore
  return /^[a-zA-Z0-9_]{3,20}$/.test(username);
}

function safeJsonParse(s) {
  try {
    return { ok: true, value: JSON.parse(s) };
  } catch (e) {
    return { ok: false, error: e };
  }
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  const parsed = safeJsonParse(raw);
  if (!parsed.ok) return { ok: false, raw };
  return { ok: true, body: parsed.value };
}

async function sbFetch(path, { method = "GET", headers, body } = {}) {
  const url = `${getEnv("SUPABASE_URL")}${path}`;
  const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  const res = await fetch(url, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  return { ok: res.ok, status: res.status, data, headers: res.headers };
}

function isUniqueViolation(status, data) {
  // PostgREST usually returns 409 on unique constraint violations
  if (status !== 409) return false;
  if (!data) return true;
  if (typeof data === "string") return true;
  const msg = (data.message || data.error || "").toString().toLowerCase();
  return msg.includes("duplicate") || msg.includes("unique") || msg.includes("violat");
}

module.exports = {
  ok,
  bad,
  json,
  methodNotAllowed,
  readBody,
  sbFetch,
  usernameIsValid,
  isUniqueViolation,
};

