// Sinners chat: our own chat room for each stream, stored by the Worker.
// Anyone can read it; logging in with Discord lets you write.
// mountSinnersChat(container, room) shows the chat and returns a function that stops it.

const CHAT_POLL_MS = 3000;

function mountSinnersChat(container, room) {
  // Room names are already URL-safe (e.g. "kick:lexor2k")
  const api = `${WORKER_URL.replace(/\/$/, "")}/chat/${room}`;
  const box = document.createElement("div");
  box.className = "sinners-chat";
  const list = document.createElement("div");
  list.className = "chat-messages";
  list.setAttribute("role", "log");
  list.setAttribute("aria-live", "polite");
  const footer = document.createElement("div");
  footer.className = "chat-footer";
  box.append(list, footer);
  container.append(box);

  let lastId = 0;
  let stopped = false;
  let timer = null;
  const shown = new Map(); // message id -> element

  function status(text) {
    if (list.querySelector(".chat-msg")) return;
    list.replaceChildren(Object.assign(document.createElement("p"), { className: "chat-status", textContent: text }));
  }

  function addMessages(messages) {
    if (!messages.length) return;
    const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
    list.querySelector(".chat-status")?.remove();
    messages.forEach((m) => {
      if (shown.has(m.id)) return;
      const row = document.createElement("div");
      row.className = "chat-msg" + (SinnersAuth.user && m.userId === SinnersAuth.user.id ? " mine" : "");
      if (m.avatar) {
        const img = document.createElement("img");
        img.src = m.avatar;
        img.alt = "";
        img.loading = "lazy";
        row.append(img);
      } else {
        row.append(Object.assign(document.createElement("span"), { className: "chat-avatar", textContent: m.name.charAt(0).toUpperCase() }));
      }
      const content = document.createElement("div");
      const name = Object.assign(document.createElement("strong"), { textContent: m.name });
      const time = Object.assign(document.createElement("time"), {
        textContent: new Date(m.created).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
      const text = Object.assign(document.createElement("p"), { textContent: m.text });
      content.append(name, time, text);
      row.append(content);
      list.append(row);
      shown.set(m.id, row);
      lastId = Math.max(lastId, m.id);
    });
    // Keep the list from growing forever
    while (shown.size > 200) {
      const [id, row] = shown.entries().next().value;
      row.remove();
      shown.delete(id);
    }
    if (atBottom) list.scrollTop = list.scrollHeight;
  }

  async function poll() {
    if (stopped) return;
    if (!box.isConnected) return; // its page was closed
    // Don't use up requests in background tabs, or while its page is parked behind another section
    if (document.hidden || box.closest(".page-parked")) return schedule();
    try {
      const res = await fetch(lastId ? `${api}?after=${lastId}` : api);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Chat unavailable");
      addMessages(data.messages || []);
      (data.deleted || []).forEach((id) => {
        shown.get(id)?.remove();
        shown.delete(id);
      });
      if (!shown.size) status("No messages yet. Say hi!");
    } catch (err) {
      status("Chat is unavailable right now.");
    }
    schedule();
  }

  function schedule() {
    if (!stopped) timer = setTimeout(poll, CHAT_POLL_MS);
  }

  function renderFooter() {
    footer.replaceChildren();
    if (!SinnersAuth.user) {
      const btn = Object.assign(document.createElement("button"), {
        type: "button",
        className: "button discord-btn",
        textContent: "Log in with Discord to chat",
      });
      btn.addEventListener("click", SinnersAuth.login);
      footer.append(btn);
      return;
    }
    const form = document.createElement("form");
    form.className = "chat-form";
    form.autocomplete = "off";
    const input = Object.assign(document.createElement("input"), {
      type: "text",
      maxLength: 300,
      placeholder: `Chat as ${SinnersAuth.user.name}…`,
    });
    input.setAttribute("aria-label", "Chat message");
    const send = Object.assign(document.createElement("button"), { type: "submit", className: "button", textContent: "Send" });
    const error = Object.assign(document.createElement("p"), { className: "form-msg error" });
    form.append(input, send);
    footer.append(form, error);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      send.disabled = true;
      error.textContent = "";
      try {
        const res = await fetch(api, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SinnersAuth.token}` },
          body: JSON.stringify({ text }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401 || res.status === 403) SinnersAuth.expire();
        if (!res.ok) throw new Error(data.error || "Couldn't send.");
        input.value = "";
        addMessages([data.message]);
        list.scrollTop = list.scrollHeight;
      } catch (err) {
        error.textContent = err.message;
      } finally {
        send.disabled = false;
        input.focus();
      }
    });
  }

  status("Loading chat…");
  renderFooter();
  const stopListening = SinnersAuth.onChange(() => !stopped && renderFooter());
  poll();

  return () => {
    stopped = true;
    clearTimeout(timer);
    stopListening();
  };
}
