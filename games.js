// Mini games with a shared leaderboard (stored by the Worker).
// Anyone can play; logged-in players' best scores go on the leaderboard and earn points.
// Points can be bet in two multiplayer games (Color Clash, Lucky Number) that run in
// one-minute rounds for everyone at once; the Worker decides results and pays winners.

const API = WORKER_URL.replace(/\/$/, "");
const PENDING_KEY = "sinners-pending-score"; // a score waiting for the player to log in
const ROUND_SECONDS = 30;

const GAMES = {
  reaction: {
    icon: "⚡",
    title: "Quick Draw",
    blurb: "Wait for green, then click as fast as you can. Average of 5 rounds.",
    lowerIsBetter: true,
    format: (v) => `${Math.round(v)} ms`,
    start: startReaction,
  },
  aim: {
    icon: "🎯",
    title: "Target Rush",
    blurb: `Hit as many targets as you can in ${ROUND_SECONDS} seconds.`,
    format: (v) => `${v} hits`,
    start: startAim,
  },
  typing: {
    icon: "⌨️",
    title: "Chat Typer",
    blurb: `Type the words as they appear. ${ROUND_SECONDS} seconds, as many as you can.`,
    format: (v) => `${v} words`,
    start: startTyping,
  },
  colors: {
    icon: "🎨",
    title: "Color Clash",
    blurb: "Bet points on red, green or blue. Every minute one color wins: its backers split the whole pot, plus a 10% site bonus.",
    bet: true,
    odds: "1 in 3",
    bonusText: "+10% of your bet",
    example: ["Red", "Blue"],
    choices: [
      ["red", "Red"],
      ["green", "Green"],
      ["blue", "Blue"],
    ],
  },
  lucky: {
    icon: "🍀",
    title: "Lucky Number",
    blurb: "Pick a number from 1 to 10 and bet. Every minute one number is drawn: winners split the pot plus a 20% site bonus; if nobody picked it, the pot grows into a jackpot.",
    bet: true,
    odds: "1 in 10",
    bonusText: "+20% of your bet",
    example: ["7", "3"],
    choices: Array.from({ length: 10 }, (_, i) => [String(i + 1), String(i + 1)]),
  },
};

const WORDS = (
  "stream clutch raid headshot respawn lobby victory squad combo loot sniper reload strafe spawn speedrun " +
  "boss level quest pixel arcade joystick console replay highlight overtime camera ranked queue frag bonus " +
  "rocket shield potion dragon castle portal crystal thunder shadow neon turbo glitch laser rookie legend " +
  "champion jackpot hype friendly chat emote follow subscribe donate moderator channel online offline " +
  "keyboard mouse headset monitor controller victory defeat dungeon arena ultimate critical stealth zombie"
).split(" ");

const picker = document.getElementById("game-picker");
const stage = document.getElementById("game-stage");
const result = document.getElementById("game-result");
const lbList = document.getElementById("lb-list");
const lbHint = document.getElementById("lb-hint");
const pointsBar = document.getElementById("points-bar");
const lbTitle = document.querySelector(".leaderboard h3");

let currentGame = "reaction";
let timers = [];
let cleanupGame = null;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function later(fn, ms) {
  const id = setTimeout(fn, ms);
  timers.push(id);
  return id;
}

function stopGame() {
  timers.forEach((id) => {
    clearTimeout(id);
    clearInterval(id);
  });
  timers = [];
  if (cleanupGame) cleanupGame();
  cleanupGame = null;
}

// ---------- Picking a game ----------

function renderPicker() {
  picker.replaceChildren(
    ...Object.entries(GAMES).map(([id, g]) => {
      const b = el("button", "game-tab" + (id === currentGame ? " active" : ""));
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", id === currentGame);
      b.append(el("span", "game-tab-icon", g.icon), el("span", "game-tab-title", g.title));
      b.addEventListener("click", () => pick(id));
      return b;
    })
  );
}

function pick(id) {
  stopGame();
  currentGame = id;
  history.replaceState(null, "", `#${id}`);
  renderPicker();
  showIntro();
  loadLeaderboard();
}

function showIntro() {
  const g = GAMES[currentGame];
  if (g.bet) {
    result.replaceChildren();
    stage.className = "game-stage bet";
    stage.replaceChildren();
    startBet(currentGame);
    return;
  }
  result.replaceChildren();
  stage.className = "game-stage intro";
  const box = el("div", "game-intro");
  box.append(el("div", "game-intro-icon", g.icon), el("h2", null, g.title), el("p", null, g.blurb));
  const start = el("button", "button", "▶ Play");
  start.type = "button";
  start.addEventListener("click", (e) => {
    e.stopPropagation();
    stage.className = "game-stage";
    stage.replaceChildren();
    g.start();
  });
  box.append(start);
  stage.replaceChildren(box);
}

function timerBar(seconds, onEnd) {
  const bar = el("div", "game-hud");
  const time = el("span", "game-time", `${seconds}s`);
  const score = el("span", "game-score", "0");
  bar.append(time, score);
  let left = seconds;
  const id = setInterval(() => {
    left--;
    time.textContent = `${left}s`;
    if (left <= 5) time.classList.add("low");
    if (left <= 0) {
      clearInterval(id);
      onEnd();
    }
  }, 1000);
  timers.push(id);
  return { bar, setScore: (v) => (score.textContent = v) };
}

// ---------- ⚡ Quick Draw ----------

function startReaction() {
  const times = [];
  let state = "idle";
  let shownAt = 0;
  const panel = el("div", "reaction-panel");
  const big = el("div", "reaction-big");
  const small = el("div", "reaction-small");
  panel.append(big, small);
  stage.append(panel);

  const set = (cls, a, b) => {
    panel.className = `reaction-panel ${cls}`;
    big.textContent = a;
    small.textContent = b;
  };

  const nextRound = () => {
    state = "waiting";
    set("wait", "Wait for green…", `Round ${times.length + 1} of 5`);
    later(() => {
      state = "go";
      shownAt = performance.now();
      set("go", "CLICK!", "");
    }, 1200 + Math.random() * 2300);
  };

  const onPress = (e) => {
    e.preventDefault();
    if (state === "waiting") {
      stopGame();
      cleanupGame = attach();
      state = "early";
      set("early", "Too soon!", "Click to try this round again");
    } else if (state === "go") {
      const ms = performance.now() - shownAt;
      times.push(ms);
      if (times.length === 5) {
        state = "done";
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        set("done", `${Math.round(avg)} ms`, times.map((t) => Math.round(t)).join(" · "));
        finish(Math.round(avg));
      } else {
        state = "between";
        set("between", `${Math.round(ms)} ms`, "Click for the next round");
      }
    } else if (state === "between" || state === "early" || state === "idle") {
      nextRound();
    }
  };

  const attach = () => {
    panel.addEventListener("pointerdown", onPress);
    return () => panel.removeEventListener("pointerdown", onPress);
  };
  cleanupGame = attach();
  set("idle", "Click to start", "5 rounds. Don't click before it turns green!");
}

// ---------- 🎯 Target Rush ----------

function startAim() {
  let hits = 0;
  let misses = 0;
  const field = el("div", "aim-field");
  const hud = timerBar(ROUND_SECONDS, () => {
    field.replaceChildren();
    finish(hits, `${misses} missed click${misses === 1 ? "" : "s"}`);
  });
  stage.append(hud.bar, field);

  const spawn = () => {
    const t = el("button", "aim-target");
    t.type = "button";
    t.setAttribute("aria-label", "Target");
    const size = 46;
    const w = field.clientWidth - size;
    const h = field.clientHeight - size;
    t.style.left = `${Math.random() * Math.max(w, 0)}px`;
    t.style.top = `${Math.random() * Math.max(h, 0)}px`;
    t.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      hits++;
      hud.setScore(hits);
      t.remove();
      spawn();
    });
    field.append(t);
  };
  const onMiss = () => {
    misses++;
  };
  field.addEventListener("pointerdown", onMiss);
  cleanupGame = () => field.removeEventListener("pointerdown", onMiss);
  spawn();
}

// ---------- ⌨️ Chat Typer ----------

function startTyping() {
  let typed = 0;
  let started = false;
  let word = "";
  let upcoming = [];
  const randomWord = () => WORDS[Math.floor(Math.random() * WORDS.length)];
  const wrap = el("div", "typer");
  const current = el("div", "typer-word");
  const next = el("div", "typer-next");
  const input = el("input", "typer-input");
  input.type = "text";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.setAttribute("autocapitalize", "off");
  input.placeholder = "Start typing to begin…";
  input.setAttribute("aria-label", "Type the word");
  let hud = null;

  const advance = () => {
    word = upcoming.shift() || randomWord();
    while (upcoming.length < 3) upcoming.push(randomWord());
    current.textContent = word;
    next.textContent = upcoming.join("  ·  ");
  };

  input.addEventListener("input", () => {
    if (!started) {
      started = true;
      hud = timerBar(ROUND_SECONDS, () => {
        input.disabled = true;
        finish(typed);
      });
      wrap.before(hud.bar);
    }
    const value = input.value.trim().toLowerCase();
    current.classList.toggle("wrong", !word.startsWith(value));
    if (value === word) {
      typed++;
      hud.setScore(typed);
      input.value = "";
      current.classList.remove("wrong");
      advance();
    }
  });

  wrap.append(current, next, input);
  stage.append(wrap);
  advance();
  input.focus();
}

// ---------- Score and leaderboard ----------

async function finish(score, extra = "") {
  const g = GAMES[currentGame];
  const game = currentGame;
  result.replaceChildren();
  const line = el("div", "result-line");
  line.append(el("strong", null, `Your score: ${g.format(score)}`));
  if (extra) line.append(el("span", null, extra));
  const again = el("button", "button ghost", "Play again");
  again.type = "button";
  again.addEventListener("click", () => {
    stopGame();
    stage.className = "game-stage";
    stage.replaceChildren();
    result.replaceChildren();
    g.start();
  });
  const status = el("p", "result-status");
  result.append(line, status, again);

  if (!SinnersAuth.user) {
    status.textContent = "Log in to put this score on the leaderboard.";
    const login = el("button", "button discord-btn", "Log in to save this score");
    login.type = "button";
    login.addEventListener("click", () => {
      try {
        sessionStorage.setItem(PENDING_KEY, JSON.stringify({ game, score }));
      } catch (e) {}
      SinnersAuth.login();
    });
    result.insertBefore(login, again);
    return;
  }
  await submit(game, score, status);
}

async function submit(game, score, status) {
  status.textContent = "Saving…";
  try {
    const res = await fetch(`${API}/games/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SinnersAuth.token}` },
      body: JSON.stringify({ game, score }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 || res.status === 403) SinnersAuth.expire();
    if (!res.ok) throw new Error(data.error || "Couldn't save your score.");
    SinnersToast.achievements(data.achievements);
    const g = GAMES[game];
    const points = data.pointsEarned
      ? ` +${data.pointsEarned} points 🪙`
      : data.earnedToday >= data.dailyCap
        ? " (daily points limit reached)"
        : "";
    const hero = data.heroXp
      ? ` · +${data.heroXp} adventurer XP${data.heroLevels && data.heroLevels.length ? ` ⬆️ level ${data.heroLevels[data.heroLevels.length - 1]}!` : ""}`
      : "";
    status.textContent =
      (data.newBest ? `New personal best! You're #${data.rank} on the leaderboard.` : `Saved. Your best is ${g.format(data.best)} (#${data.rank}).`) +
      points +
      hero;
    if (game === currentGame) loadLeaderboard();
    refreshPoints();
  } catch (err) {
    status.textContent = err.message;
  }
}

async function loadLeaderboard() {
  const g = GAMES[currentGame];
  const game = currentGame;
  if (g.bet) return loadRichest();
  lbTitle.textContent = "🏆 Leaderboard";
  lbHint.textContent = g.lowerIsBetter ? `${g.title}: lowest time wins.` : `${g.title}: highest score wins.`;
  lbList.replaceChildren(el("li", "lb-empty", "Loading…"));
  try {
    const res = await fetch(`${API}/games/leaderboard?game=${game}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Leaderboard unavailable");
    if (game !== currentGame) return;
    const me = SinnersAuth.user && SinnersAuth.user.id;
    if (!data.scores.length) {
      lbList.replaceChildren(el("li", "lb-empty", "No scores yet. Be the first!"));
      return;
    }
    lbList.replaceChildren(
      ...data.scores.map((s, i) => {
        const li = el("li", "lb-row" + (s.userId === me ? " me" : ""));
        li.append(el("span", "lb-rank", ["🥇", "🥈", "🥉"][i] || `${i + 1}`));
        if (s.avatar) {
          const img = el("img");
          img.src = s.avatar;
          img.alt = "";
          img.loading = "lazy";
          li.append(img);
        } else {
          li.append(el("span", "chat-avatar", s.name.charAt(0).toUpperCase()));
        }
        li.append(el("span", "lb-name", s.name), el("span", "lb-score", g.format(s.score)));
        return li;
      })
    );
  } catch (e) {
    lbList.replaceChildren(el("li", "lb-empty", "Leaderboard unavailable right now."));
  }
}

async function loadRichest() {
  lbTitle.textContent = "🪙 Most points";
  lbHint.textContent = "Earn points by playing the other games.";
  try {
    const data = await (await fetch(`${API}/points/top`)).json();
    if (!GAMES[currentGame].bet) return;
    const me = SinnersAuth.user && SinnersAuth.user.id;
    if (!data.players || !data.players.length) {
      lbList.replaceChildren(el("li", "lb-empty", "Nobody has points yet."));
      return;
    }
    lbList.replaceChildren(
      ...data.players.map((p, i) => {
        const li = el("li", "lb-row" + (p.userId === me ? " me" : ""));
        li.append(el("span", "lb-rank", ["🥇", "🥈", "🥉"][i] || `${i + 1}`));
        if (p.avatar) {
          const img = el("img");
          img.src = p.avatar;
          img.alt = "";
          li.append(img);
        } else li.append(el("span", "chat-avatar", p.name.charAt(0).toUpperCase()));
        li.append(el("span", "lb-name", p.name), el("span", "lb-score", `${p.points} 🪙`));
        return li;
      })
    );
  } catch (e) {
    lbList.replaceChildren(el("li", "lb-empty", "Unavailable right now."));
  }
}

document.getElementById("lb-refresh").addEventListener("click", loadLeaderboard);

// ---------- Points ----------

let myPoints = null;

async function refreshPoints() {
  if (!SinnersAuth.user) {
    myPoints = null;
    pointsBar.replaceChildren(el("span", null, "🪙 Log in to get 100 free points and save your scores."));
    const login = el("button", "button discord-btn", "Log in");
    login.type = "button";
    login.addEventListener("click", SinnersAuth.login);
    pointsBar.append(login, shopButton());
    return;
  }
  try {
    const res = await fetch(`${API}/points`, { headers: { Authorization: `Bearer ${SinnersAuth.token}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    myPoints = data.points;
    pointsBar.replaceChildren(
      el("strong", "points-total", `🪙 ${data.points} points`),
      el("span", null, `Earned from games today: ${data.earnedToday} / ${data.dailyCap}`),
      shopButton()
    );
  } catch (e) {
    pointsBar.replaceChildren(el("span", null, "🪙 Points unavailable right now."));
  }
}

function shopButton() {
  const link = el("a", "button ghost shop-jump", "🛒 Shop");
  link.href = "/shop";
  return link;
}

// ---------- Betting games (Color Clash, Lucky Number) ----------

function howItWorks(g) {
  const [mine, other] = g.example;
  const box = el("details", "bet-help");
  // Open until the visitor has looked at it once
  try {
    box.open = !localStorage.getItem("sinners-bet-help-seen");
  } catch (e) {
    box.open = true;
  }
  box.addEventListener("toggle", () => {
    try {
      localStorage.setItem("sinners-bet-help-seen", "1");
    } catch (e) {}
  });
  box.append(el("summary", null, "❓ How this game works"));
  const steps = el("ol", "bet-help-steps");
  [
    "A new round starts every 60 seconds. Everyone on Sinners plays the same round.",
    `Pick ${g.choices.length > 3 ? "a number" : "a color"}, choose how many points to bet, and press Place bet. One bet per round; betting closes 5 seconds before the end.`,
    `When the timer hits 0, one ${g.choices.length > 3 ? "number" : "color"} wins at random. Each has the same ${g.odds} chance.`,
    "Every bet goes into one shared pot. The players who picked the winner split the whole pot, by how much each of them bet.",
    `Every winner also gets a site bonus of ${g.bonusText}, paid by Sinners. So a win always earns something, even if you play alone.`,
  ].forEach((s) => steps.append(el("li", null, s)));
  const example = el("div", "bet-help-example");
  example.append(
    el("strong", null, "Example"),
    el("span", null, `You bet 90 on ${mine}, Alex bets 60 on ${other}, Sam bets 30 on ${mine}. The pot is 180.`),
    el("span", null, `${mine} wins: ${mine}'s players put in 120, so you get 90/120 of the pot = 135, and Sam gets 45. Alex loses 60.`),
    el("span", null, `Plus the site bonus (${g.bonusText}): you get ${Math.floor(90 * (g.choices.length > 3 ? 0.2 : 0.1))} more and Sam ${Math.floor(30 * (g.choices.length > 3 ? 0.2 : 0.1))} more.`)
  );
  const notes = el("ul", "bet-help-notes");
  [
    ["Playing alone?", " Then the pot is only your own points: a win gives them back plus the site bonus. You win more when other people bet on the other options."],
    ["Bonus limit:", " site bonuses count toward the same 300-points-a-day limit as the solo games. Once you've earned 300 today, wins pay only your share of the pot."],
    ["Nobody picked the winner?", " Then the pot goes into the jackpot, and the next round's winners get it on top."],
    ["Where do points come from?", " You start with 100, and the solo games (Quick Draw, Target Rush, Chat Typer) earn up to 300 more a day. Points are just for fun: they can't be bought or turned into money."],
  ].forEach(([q, a]) => {
    const li = el("li");
    li.append(el("strong", null, q), document.createTextNode(a));
    notes.append(li);
  });
  box.append(steps, example, notes);
  return box;
}

function startBet(id) {
  const g = GAMES[id];
  let state = null;
  let picked = null;
  let clockSkew = 0; // server time minus our time
  let lastRound = null;

  stage.append(howItWorks(g));

  const top = el("div", "bet-top");
  const timer = el("div", "bet-timer");
  const pot = el("div", "bet-pot");
  top.append(timer, pot);

  const grid = el("div", `bet-choices ${id}`);
  const buttons = {};
  g.choices.forEach(([value, label]) => {
    const b = el("button", `bet-choice c-${value}`);
    b.type = "button";
    b.append(el("span", "bet-choice-label", label), el("span", "bet-choice-total", "0"));
    b.addEventListener("click", () => {
      picked = value;
      draw();
    });
    buttons[value] = b;
    grid.append(b);
  });

  const controls = el("form", "bet-controls");
  controls.autocomplete = "off";
  const amount = el("input");
  amount.type = "number";
  amount.min = "1";
  amount.step = "1";
  amount.value = "10";
  amount.setAttribute("aria-label", "Points to bet");
  const quick = el("div", "bet-quick");
  [10, 50, 100].forEach((n) => {
    const q = el("button", "link-btn", `${n}`);
    q.type = "button";
    q.addEventListener("click", () => (amount.value = n));
    quick.append(q);
  });
  const max = el("button", "link-btn", "Max");
  max.type = "button";
  max.addEventListener("click", () => myPoints && (amount.value = myPoints));
  quick.append(max);
  const place = el("button", "button", "Place bet");
  place.type = "submit";
  controls.append(amount, quick, place);
  amount.addEventListener("input", draw);
  quick.addEventListener("click", draw);

  const note = el("p", "bet-note");
  const history = el("div", "bet-history");
  const live = el("ul", "bet-live");
  stage.append(top, grid, controls, note, history, live);

  function draw() {
    if (!state) return;
    const now = Date.now() + clockSkew;
    const left = Math.max(0, Math.ceil((state.endsAt - now) / 1000));
    const closed = now >= state.closesAt;
    timer.textContent = closed ? "Betting closed. Drawing…" : `Round ends in 0:${String(left).padStart(2, "0")}`;
    timer.classList.toggle("low", !closed && left <= 10);
    pot.textContent = `Pot ${state.pot} 🪙` + (state.jackpot ? `  ·  Jackpot +${state.jackpot}` : "");

    g.choices.forEach(([value]) => {
      const c = state.choices[value];
      const b = buttons[value];
      b.querySelector(".bet-choice-total").textContent = c.count ? `${c.total} 🪙 · ${c.count}` : "–";
      b.classList.toggle("picked", picked === value);
      b.classList.toggle("mine", !!state.myBet && state.myBet.choice === value);
      b.disabled = closed || !!state.myBet;
    });

    const canBet = !!SinnersAuth.user && !closed && !state.myBet;
    controls.hidden = !canBet;
    if (!SinnersAuth.user) note.textContent = "Log in to bet your points.";
    else if (state.myBet) note.textContent = `You bet ${state.myBet.amount} on ${labelOf(state.myBet.choice)}. Good luck!`;
    else if (closed) note.textContent = "The next round starts in a moment.";
    else if (!picked) note.textContent = "Pick an option, choose how many points, then place your bet.";
    else note.textContent = preview();
  }

  // What the visitor would get back if their pick wins, with the bets placed so far
  function preview() {
    const bet = Math.floor(Number(amount.value));
    const name = labelOf(picked);
    if (!(bet > 0)) return `Betting on ${name}.`;
    const total = state.pot + state.jackpot + bet;
    const side = state.choices[picked].total + bet;
    const payout = Math.floor((total * bet) / side);
    const bonus = Math.max(0, Math.min(Math.floor(bet * (state.bonusRate || 0)), state.bonusLeft ?? Infinity));
    const parts = [`your ${bet} back`];
    if (payout > bet) parts.push(`${payout - bet} from other players`);
    if (bonus) parts.push(`${bonus} site bonus`);
    const capped = state.bonusLeft === 0 ? " (You've reached today's 300-point earning limit, so no bonus until tomorrow.)" : "";
    return `If ${name} wins you'd get ${payout + bonus} (+${payout + bonus - bet}): ${parts.join(" + ")}. More bets can change this.${capped}`;
  }

  const labelOf = (value) => (g.choices.find(([v]) => v === value) || [value, value])[1];

  function drawHistory() {
    history.replaceChildren(el("span", "bet-history-label", "Last results"));
    (state.history || []).forEach((r) => {
      const chip = el("span", `bet-result c-${r.outcome}`, labelOf(r.outcome));
      chip.title = !r.bets ? "No bets this round" : r.winners ? `${r.winners} winner(s) shared ${r.paid}` : `No winner, ${r.pot} rolled over to the jackpot`;
      if (!r.bets) chip.classList.add("quiet");
      history.append(chip);
    });
    if (!(state.history || []).length) history.append(el("span", "bet-history-empty", "No rounds yet"));

    live.replaceChildren(
      ...(state.bets || []).map((b) => el("li", null, `${b.name} bet ${b.amount} on ${labelOf(b.choice)}`))
    );
  }

  function announceLast() {
    const m = state.myLast;
    if (!m || m.round !== state.round - 1) return;
    let text;
    const bonus = m.bonus || 0;
    if (m.payout > 0) {
      const parts = [`your ${m.amount} back`];
      if (m.payout > m.amount) parts.push(`${m.payout - m.amount} from other players`);
      if (bonus) parts.push(`${bonus} site bonus`);
      const total = m.payout + bonus;
      text =
        total > m.amount
          ? `🎉 ${labelOf(m.outcome)} won! You got ${total} for your ${m.amount} (+${total - m.amount}): ${parts.join(" + ")}.`
          : `✅ ${labelOf(m.outcome)} won and you got your ${m.amount} back. No bonus: you've reached today's 300-point earning limit.`;
    } else text = `${labelOf(m.outcome)} won. You lost your ${m.amount} on ${labelOf(m.choice)}; it went to the winners (or the jackpot).`;
    result.replaceChildren(el("div", "result-line", text));
  }

  async function poll() {
    if (document.hidden) return;
    try {
      const headers = SinnersAuth.user ? { Authorization: `Bearer ${SinnersAuth.token}` } : {};
      const res = await fetch(`${API}/bets/state?game=${id}`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      clockSkew = data.now - Date.now();
      const newRound = lastRound !== null && data.round !== lastRound;
      state = data;
      lastRound = data.round;
      if (typeof data.points === "number" && data.points !== myPoints) refreshPoints();
      if (newRound) {
        picked = null;
        announceLast();
        loadRichest();
      }
      drawHistory();
      draw();
    } catch (e) {
      timer.textContent = "Couldn't reach the game right now.";
    }
  }

  controls.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!picked) {
      note.textContent = "Pick an option first.";
      return;
    }
    place.disabled = true;
    try {
      const res = await fetch(`${API}/bets/place`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SinnersAuth.token}` },
        body: JSON.stringify({ game: id, choice: picked, amount: Number(amount.value) }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) SinnersAuth.expire();
      if (!res.ok) throw new Error(data.error || "Couldn't place that bet.");
      myPoints = data.points;
      refreshPoints();
      await poll();
    } catch (err) {
      note.textContent = err.message;
    } finally {
      place.disabled = false;
    }
  });

  // Live: refresh the round every 2 seconds, and the countdown every second
  poll();
  timers.push(setInterval(poll, 2000));
  timers.push(setInterval(draw, 1000));
}

// ---------- Start ----------

const fromHash = location.hash.slice(1);
if (GAMES[fromHash]) currentGame = fromHash;
renderPicker();
showIntro();
loadLeaderboard();
refreshPoints();
const stopAuthWatch = SinnersAuth.onChange(refreshPoints);

// Back from Discord login with a score waiting to be saved
try {
  const pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) || "null");
  if (pending && SinnersAuth.user && GAMES[pending.game]) {
    sessionStorage.removeItem(PENDING_KEY);
    if (pending.game !== currentGame) pick(pending.game);
    const status = el("p", "result-status");
    result.replaceChildren(el("div", "result-line", `Your score: ${GAMES[pending.game].format(pending.score)}`), status);
    submit(pending.game, pending.score, status);
  }
} catch (e) {}

// In-site navigation (nav.js): stop any running game when leaving the page
SinnersNav.onLeave(() => {
  stopGame();
  stopAuthWatch();
});
