// Gallery review: approve or reject links people shared. The password is checked by the Worker.

const API = WORKER_URL.replace(/\/$/, "");
const PASSWORD_KEY = "sinners-admin";

const loginForm = document.getElementById("login");
const passwordInput = document.getElementById("password");
const loginMsg = document.getElementById("login-msg");
const panel = document.getElementById("admin");

let password = "";
try {
  password = sessionStorage.getItem(PASSWORD_KEY) || "";
} catch (e) {}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${password}`, ...options.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "Request failed"), { status: res.status });
  return data;
}

async function refresh() {
  try {
    const data = await api("/gallery/pending");
    loginForm.hidden = true;
    panel.hidden = false;
    renderList("pending", data.pending || []);
    renderList("approved", data.approved || []);
  } catch (err) {
    if (err.status === 401) logout("Wrong password.");
    else loginMsg.textContent = err.message;
  }
}

function preview(item) {
  const box = el("div", "review-preview");
  const src = item.kind === "image" ? item.url : item.thumb;
  if (src) {
    const img = el("img");
    img.src = src;
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    box.append(img);
  } else {
    box.append(el("span", "clip-thumb-label", item.platform));
  }
  return box;
}

function renderList(which, list) {
  document.getElementById(`${which}-count`).textContent = list.length ? `(${list.length})` : "";
  const container = document.getElementById(`${which}-list`);
  if (!list.length) {
    container.replaceChildren(el("p", "gallery-empty", which === "pending" ? "Nothing waiting. 🎉" : "Nothing approved yet."));
    return;
  }
  container.replaceChildren(
    ...list.map((item) => {
      const row = el("div", "review-item");
      const info = el("div", "review-info");
      info.append(el("span", `platform ${item.platform || "image"}`, item.platform || "image"));
      info.append(el("strong", null, item.title || "(no title)"));
      const link = el("a", null, item.link || item.url);
      link.href = item.link || item.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      info.append(link);
      const meta = [item.name && `by ${item.name}`, new Date(item.created).toLocaleString()].filter(Boolean).join(" · ");
      info.append(el("small", null, meta));

      const actions = el("div", "review-actions");
      const buttons = which === "pending" ? [["approve", "✓ Approve", "button"], ["reject", "✕ Reject", "button ghost"]] : [["delete", "Remove", "button ghost"]];
      buttons.forEach(([action, label, cls]) => {
        const btn = el("button", cls, label);
        btn.type = "button";
        btn.addEventListener("click", async () => {
          if (action === "delete" && !confirm("Remove this from the gallery?")) return;
          btn.disabled = true;
          try {
            await api("/gallery/moderate", { method: "POST", body: JSON.stringify({ id: item.id, action }) });
            await refresh();
          } catch (err) {
            btn.disabled = false;
            alert(err.message);
          }
        });
        actions.append(btn);
      });

      row.append(preview(item), info, actions);
      return row;
    })
  );
}

function logout(message = "") {
  password = "";
  try {
    sessionStorage.removeItem(PASSWORD_KEY);
  } catch (e) {}
  panel.hidden = true;
  loginForm.hidden = false;
  loginMsg.className = message ? "form-msg error" : "form-msg";
  loginMsg.textContent = message;
}

loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  password = passwordInput.value;
  try {
    sessionStorage.setItem(PASSWORD_KEY, password);
  } catch (e) {}
  passwordInput.value = "";
  loginMsg.className = "form-msg";
  loginMsg.textContent = "Checking…";
  refresh();
});

document.getElementById("refresh").addEventListener("click", refresh);
document.getElementById("logout").addEventListener("click", () => logout());

if (password) refresh();
