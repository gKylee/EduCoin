const EduCoin = (() => {
  const USERNAME_KEY = "educoin.username";

  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function $all(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  }

  function setActiveNav() {
    const path = location.pathname.split("/").pop() || "index.html";
    $all("[data-nav]").forEach((a) => {
      a.classList.toggle("active", a.getAttribute("href") === path);
    });
  }

  function getUsername() {
    return localStorage.getItem(USERNAME_KEY) || "";
  }

  function setUsername(username) {
    localStorage.setItem(USERNAME_KEY, username);
  }

  function clearUsername() {
    localStorage.removeItem(USERNAME_KEY);
  }

  function usernameIsValid(username) {
    // 3-18 chars, letters/numbers/underscore, must start with letter
    return /^[a-zA-Z][a-zA-Z0-9_]{2,17}$/.test(username);
  }

  async function api(path, { method = "GET", body, headers } = {}) {
    const res = await fetch(path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(headers || {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    let data = null;
    const text = await res.text();
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { ok: false, error: "BAD_JSON", raw: text };
    }
    if (!res.ok) {
      return { ok: false, status: res.status, ...(data || {}) };
    }
    return data || { ok: true };
  }

  function showNotice(el, { type = "info", title, message }) {
    if (!el) return;
    el.classList.remove("good", "bad");
    if (type === "good") el.classList.add("good");
    if (type === "bad") el.classList.add("bad");
    el.innerHTML = `<strong>${escapeHtml(title || "")}</strong><div style="margin-top:6px">${escapeHtml(
      message || ""
    )}</div>`;
    el.hidden = false;
  }

  function hideNotice(el) {
    if (!el) return;
    el.hidden = true;
    el.textContent = "";
    el.classList.remove("good", "bad");
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function requireUsernameOrRedirect() {
    const u = getUsername();
    if (!u) {
      location.href = "index.html";
      return null;
    }
    return u;
  }

  async function refreshTopbar() {
    const username = getUsername();
    const usernameEl = $("#topbarUsername");
    const balanceEl = $("#topbarBalance");
    const logoutEl = $("#logoutBtn");
    if (usernameEl) usernameEl.textContent = username || "—";

    if (logoutEl) {
      logoutEl.onclick = () => {
        clearUsername();
        location.href = "index.html";
      };
    }

    if (!balanceEl) return;
    if (!username) {
      balanceEl.textContent = "0";
      return;
    }
    const prof = await api(`/api/profile?username=${encodeURIComponent(username)}`);
    if (prof?.ok) {
      balanceEl.textContent = String(prof.balance ?? 0);
    }
  }

  return {
    $,
    $all,
    api,
    showNotice,
    hideNotice,
    usernameIsValid,
    setActiveNav,
    getUsername,
    setUsername,
    clearUsername,
    requireUsernameOrRedirect,
    refreshTopbar,
    escapeHtml,
  };
})();

window.addEventListener("DOMContentLoaded", () => {
  EduCoin.setActiveNav();
  EduCoin.refreshTopbar();
});

