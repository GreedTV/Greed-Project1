// Pixel art for the adventure: the adventurer and their gear, drawn as SVG pixels.
// Gear looks like its tier's material (Wooden, Iron, Bogsteel, Frost, Abyssal), and higher tiers get
// more detail: trims, shoulder pads, horns, gems, bigger blades and glowing flames.
//   SinnersArt.heroSvg(look, worn, style)   the character (32 x 48); worn = { slot: item }, style = cosmetics { hat, cape }
//   SinnersArt.gearIcon(item)        a 24 x 24 icon of one item ({ slot, tier })
//   SinnersArt.auraOf(worn)          "frost" / "abyss" when most of the gear is tier 4 / 5
//
// Drawings are lists of [x, y, "row"]. A row is letters with optional counts, separated by spaces:
// "o s3 . p2" = one outline pixel, three skin, one see-through, two pupils. Letters map to colors.

const SinnersArt = (() => {
  const NS = "http://www.w3.org/2000/svg";
  const TIERS = [
    null,
    { name: "Wooden", main: "#a16207", dark: "#5c3a12", light: "#d6a85c", accent: "#78350f", gem: "#d6a85c" },
    { name: "Iron", main: "#9ca3af", dark: "#4b5563", light: "#f3f4f6", accent: "#6b7280", gem: "#cbd5e1" },
    { name: "Bogsteel", main: "#0f766e", dark: "#083d39", light: "#5eead4", accent: "#eab308", gem: "#facc15" },
    { name: "Frost", main: "#38bdf8", dark: "#075985", light: "#e0f2fe", accent: "#a5f3fc", gem: "#f0f9ff", glow: "#7dd3fc" },
    { name: "Abyssal", main: "#991b1b", dark: "#2a0808", light: "#f87171", accent: "#f59e0b", gem: "#fde047", glow: "#ef4444" },
  ];
  const OUTLINE = "#140c10";
  const tierOf = (item) => TIERS[Math.min(5, Math.max(1, (item && item.tier) || 1))];
  const tierNum = (item) => Math.min(5, Math.max(1, (item && item.tier) || 1));

  // ---------- Colors ----------
  function mix(hex, other, amount) {
    const a = parseInt(hex.slice(1), 16);
    const b = parseInt(other.slice(1), 16);
    const ch = (v, s) => (v >> s) & 255;
    const m = (s) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * amount);
    return `#${((1 << 24) | (m(16) << 16) | (m(8) << 8) | m(0)).toString(16).slice(1)}`;
  }
  const darker = (hex, n = 0.28) => mix(hex, "#000000", n);
  const lighter = (hex, n = 0.3) => mix(hex, "#ffffff", n);
  const tierPalette = (t) => ({
    o: OUTLINE,
    m: t.main,
    d: t.dark,
    l: t.light,
    a: t.accent,
    g: t.gem,
    e: t.glow || t.accent,
    w: "#5b3a1e",
    W: "#3d2513",
    k: "#0d0a0c",
  });

  // ---------- Drawing ----------
  function expand(row) {
    let out = "";
    row.split(" ").forEach((tok) => {
      if (!tok) return;
      const n = tok.length > 1 ? parseInt(tok.slice(1), 10) : 1;
      out += tok[0].repeat(Number.isFinite(n) ? n : 1);
    });
    return out;
  }

  // Paints segments onto a pixel grid (later layers cover earlier ones)
  function paint(grid, segments, palette) {
    segments.forEach(([x, y, row]) => {
      [...expand(row)].forEach((ch, i) => {
        if (ch === ".") return;
        const color = palette[ch];
        if (color) grid.set(`${x + i},${y}`, color);
      });
    });
  }

  function toSvg(grid, viewBox, className, label) {
    const root = document.createElementNS(NS, "svg");
    root.setAttribute("viewBox", viewBox);
    root.setAttribute("shape-rendering", "crispEdges");
    root.setAttribute("class", className);
    root.setAttribute("role", "img");
    if (label) root.setAttribute("aria-label", label);
    const byColor = {};
    grid.forEach((color, key) => {
      const [x, y] = key.split(",");
      (byColor[color] = byColor[color] || []).push(`M${x} ${y}h1v1h-1z`);
    });
    Object.entries(byColor).forEach(([color, d]) => {
      const p = document.createElementNS(NS, "path");
      p.setAttribute("d", d.join(""));
      p.setAttribute("fill", color);
      root.append(p);
    });
    return root;
  }

  // ---------- Item icons (24 x 24) ----------

  const ICONS = {
    weapon(n) {
      if (n === 1) {
        // a studded wooden club
        const s = [[9, 1, "o6"]];
        for (let y = 2; y <= 9; y++) s.push([8, y, "o l m4 d o"]);
        s.push([11, 4, "d"], [13, 7, "d"], [10, 6, "a"], [12, 3, "a"]);
        for (let y = 10; y <= 13; y++) s.push([9, y, "o l m2 d o"]);
        for (let y = 14; y <= 21; y++) s.push([10, y, y % 2 ? "o w W o" : "o W w o"]);
        s.push([10, 22, "o4"]);
        return s;
      }
      const broad = n >= 3;
      const s = [[11, 0, "o2"]];
      if (broad) {
        s.push([10, 1, "o l d o"]);
        for (let y = 2; y <= 14; y++) s.push([9, y, "o l m d2 o"]);
        s.push([11, 3, "l"]);
      } else {
        for (let y = 1; y <= 14; y++) s.push([10, y, "o l m o"]);
      }
      s.push([5, 15, "o a12 o"], [6, 16, "o d10 o"]);
      for (let y = 17; y <= 20; y++) s.push([10, y, y % 2 ? "o w W o" : "o W w o"]);
      s.push([9, 21, "o a4 o"], [10, 22, "o4"]);
      if (n >= 4) s.push([11, 15, "g2"], [11, 21, "g2"]);
      if (n >= 5) s.push([7, 3, "e"], [16, 6, "e"], [7, 9, "e"], [16, 12, "e"], [8, 13, "e"]);
      return s;
    },
    shield(n) {
      const s = [[5, 1, "o14"]];
      for (let y = 2; y <= 11; y++) s.push([4, y, "o l m12 d o"]);
      s.push([5, 12, "o l m10 d o"], [6, 13, "o l m8 d o"], [7, 14, "o l m6 d o"], [8, 15, "o m6 o"], [9, 16, "o m4 o"], [10, 17, "o m2 o"], [11, 18, "o2"]);
      s.push([5, 2, "l14"]);
      if (n === 1) for (let y = 3; y <= 13; y++) s.push([8, y, "d"], [15, y, "d"]); // planks
      if (n >= 2) s.push([10, 6, "o4"], [9, 7, "o l2 d2 o"], [9, 8, "o l d3 o"], [10, 9, "o4"]); // boss
      if (n >= 3) {
        for (let y = 3; y <= 15; y++) s.push([11, y, "a2"]);
        s.push([5, 7, "a14"], [5, 8, "a14"]);
      }
      if (n >= 4) s.push([11, 7, "g2"], [11, 8, "g2"]);
      if (n >= 5) s.push([4, 1, "e"], [19, 1, "e"], [6, 12, "e"], [17, 12, "e"]);
      return s;
    },
    helmet(n) {
      const s = [[7, 3, "o10"], [6, 4, "o l2 m7 d o"], [5, 5, "o l m10 d o"]];
      for (let y = 6; y <= 9; y++) s.push([4, y, "o l m12 d o"]);
      s.push([4, 10, n >= 3 ? "o a14 o" : "o d14 o"]);
      for (let y = 11; y <= 15; y++) s.push([4, y, "o m3 d k6 d m3 o"]);
      s.push([5, 16, "o m3 o"], [14, 16, "o m3 o"], [6, 17, "o3"], [15, 17, "o3"]);
      s.push([7, 5, "l2"]);
      if (n >= 2) s.push([11, 11, "d2"], [11, 12, "d2"], [11, 13, "d2"]);
      if (n >= 3) s.push([3, 7, "o a"], [2, 6, "o a2"], [2, 5, "o a"], [2, 4, "l"], [20, 7, "a o"], [20, 6, "a2 o"], [21, 5, "a o"], [21, 4, "l"]);
      if (n >= 4) s.push([10, 2, "o a2 o"], [11, 3, "g2"]);
      if (n >= 5) s.push([9, 1, "e"], [14, 1, "e"], [11, 0, "e2"], [11, 1, "e2"]);
      return s;
    },
    chest(n) {
      const s = [];
      if (n >= 2) {
        s.push([2, 3, "o5"], [17, 3, "o5"], [2, 4, "o l m3"], [17, 4, "m3 d o"]);
        for (let y = 5; y <= 7; y++) s.push([2, y, "o m4"], [17, y, "m4 o"]);
        s.push([2, 8, "o5"], [17, 8, "o5"]);
      }
      s.push([6, 5, "o l m2 o4 m2 d o"], [6, 6, "o l m3 d2 m3 d o"]);
      for (let y = 7; y <= 11; y++) s.push([6, y, "o l m8 d o"]);
      s.push([10, 8, "a4"], [10, 9, "a4"]);
      s.push([6, 12, "o d10 o"]);
      for (let y = 13; y <= 16; y++) s.push([6, y, "o l m8 d o"]);
      s.push([6, 17, n >= 3 ? "o a10 o" : "o d10 o"], [6, 18, "o m3 d m2 d m2 d o"], [6, 19, "o12"]);
      if (n >= 3) s.push([3, 4, "a3"], [18, 4, "a3"]);
      if (n >= 4) s.push([11, 8, "g2"], [11, 9, "g2"]);
      if (n >= 5) s.push([3, 2, "e"], [5, 2, "e"], [18, 2, "e"], [20, 2, "e"]);
      return s;
    },
    legs(n) {
      const s = [[5, 3, "o14"], [5, 4, n >= 3 ? "o a12 o" : "o d12 o"]];
      for (let y = 5; y <= 8; y++) s.push([5, y, "o l m10 d o"]);
      for (let y = 9; y <= 19; y++) s.push([5, y, "o l m3 d o"], [12, y, "o l m3 d o"]);
      s.push([5, 20, "o7"], [12, 20, "o7"]);
      if (n >= 2) s.push([6, 12, "o a3 o"], [13, 12, "o a3 o"], [6, 13, "o d3 o"], [13, 13, "o d3 o"]);
      if (n >= 4) s.push([11, 4, "g2"]);
      if (n >= 5) s.push([4, 9, "e"], [19, 9, "e"], [4, 16, "e"], [19, 16, "e"]);
      return s;
    },
    shoes(n) {
      const s = [[4, 7, n >= 3 ? "o a5 o" : "o d5 o"], [13, 7, n >= 3 ? "o a5 o" : "o d5 o"]];
      for (let y = 8; y <= 13; y++) s.push([4, y, "o l m3 d o"], [13, y, "o l m3 d o"]);
      for (let y = 14; y <= 16; y++) s.push([2, y, "o l m6 d o"], [12, y, "o l m6 d o"]);
      s.push([2, 17, "o10"], [12, 17, "o10"]);
      if (n >= 3) s.push([3, 15, "a2"], [19, 15, "a2"]);
      if (n >= 4) s.push([7, 10, "g"], [16, 10, "g"]);
      if (n >= 5) s.push([3, 6, "e"], [10, 6, "e"], [12, 6, "e"], [19, 6, "e"]);
      return s;
    },
    gloves(n) {
      const s = [[7, 3, "o9"]];
      for (let y = 4; y <= 10; y++) s.push([7, y, "o l m d m d m d o"]);
      for (let y = 8; y <= 11; y++) s.push([4, y, "o l m2"]);
      s.push([4, 12, "o4"]);
      for (let y = 11; y <= 13; y++) s.push([7, y, "o l m5 d o"]);
      s.push([6, 14, n >= 3 ? "o a9 o" : "o d9 o"]);
      for (let y = 15; y <= 19; y++) s.push([6, y, "o l m7 d o"]);
      s.push([6, 20, "o11"]);
      if (n >= 4) s.push([10, 17, "g2"]);
      if (n >= 5) s.push([5, 4, "e"], [17, 6, "e"], [17, 16, "e"]);
      return s;
    },
    ring(n) {
      const s = [[8, 6, "o m6 o"], [7, 7, "o l m o4 m d o"]];
      for (let y = 8; y <= 12; y++) s.push([6, y, "o l m o .4 o m d o"]);
      s.push([7, 13, "o m2 o4 d2 o"], [8, 14, "o d6 o"], [9, 15, "o6"]);
      if (n >= 2) s.push([10, 2, "o4"], [9, 3, "o g l g2 o"], [9, 4, "o g4 o"], [10, 5, "o4"]);
      if (n >= 5) s.push([8, 1, "e"], [15, 1, "e"], [7, 4, "e"], [16, 4, "e"]);
      return s;
    },
  };

  function gearIcon(item) {
    const t = tierOf(item);
    const n = tierNum(item);
    const draw = ICONS[item.slot] || ICONS.ring;
    const grid = new Map();
    paint(grid, draw(n), tierPalette(t));
    return toSvg(grid, "0 0 24 24", `gear-art tier-${n}`, `${t.name} ${item.slot}`);
  }

  // ---------- The adventurer (32 x 48) ----------

  const CAPES = { "cape-red": ["#b91c1c", "#7f1d1d"], "cape-purple": ["#7e22ce", "#4c1d95"], "cape-gold": ["#eab308", "#a16207"] };

  // Head, body, shirt, pants and boots
  function bodyLayer() {
    const torso = ["L c3 s4 c3 C", "L c4 s2 c4 C", "L c9 C2", "L c9 C2", "L c9 C2", "L c9 C2", "L c9 C2", "L c9 C2", "C c9 C2", "w5 k2 w5"];
    const s = [
      // head
      [11, 3, "o10"],
      [10, 4, "o h2 s8 o"],
      [9, 5, "o h s11 o"],
      [9, 6, "o s12 o"],
      [9, 7, "o s12 o"],
      [9, 8, "o s2 b3 s2 b3 s2 o"],
      [9, 9, "o s3 p2 s2 p2 s3 o"],
      [9, 10, "o s3 i p s2 i p s3 o"],
      [9, 11, "o s3 p2 s2 p2 s3 o"],
      [9, 12, "o s2 q s2 n2 s2 q s2 o"],
      [9, 13, "o s12 o"],
      [9, 14, "o s4 m s2 m s4 o"],
      [9, 15, "o S s4 m2 s4 S o"],
      [10, 16, "o S2 s6 S2 o"],
      [11, 17, "o10"],
      // ears
      [7, 9, "o s"], [7, 10, "o S"], [7, 11, "o s"],
      [23, 9, "s o"], [23, 10, "S o"], [23, 11, "s o"],
      // neck and shoulders
      [14, 18, "o S2 o"],
      [6, 19, "o20"],
    ];
    torso.forEach((row, i) => {
      const y = 20 + i;
      const arm = y <= 25 ? ["c C", "C c"] : ["s S", "S s"];
      s.push([6, y, `o ${arm[0]} o ${row} o ${arm[1]} o`]);
    });
    s.push([6, 30, "o s S o t4 T2 t4 T2 o S s o"]);
    s.push([6, 31, "o4 t4 T o2 t4 T o4"]);
    for (let y = 32; y <= 38; y++) s.push([9, y, "o t4 T o2 t4 T o"]);
    for (let y = 39; y <= 42; y++) s.push([9, y, "o f4 F o2 f4 F o"]);
    s.push([9, 43, "o f5 o2 f5 o"], [9, 44, "o14"]);
    return s;
  }

  const HAIR = {
    0: [
      [11, 1, "r H2 r7"],
      [9, 2, "r2 H3 r7 R2"],
      [8, 3, "r H2 r10 R2 r"],
      [8, 4, "r R r12 R r"],
      [8, 5, "r R r12 R r"],
      [8, 6, "r R r3 . r5 . r2 R r"],
      [8, 7, "r R .12 R r"],
      [8, 8, "r R .12 R r"],
      [8, 9, "R .14 R"],
    ],
    2: [
      [11, 0, "r .2 r .2 r .2 r"],
      [10, 1, "r2 H r2 H r2 H r3"],
      [9, 2, "r2 H3 r7 R2"],
      [8, 3, "r H2 r10 R2 r"],
      [8, 4, "r R r12 R r"],
      [8, 5, "r R r12 R r"],
      [8, 6, "r R r2 . r3 . r2 . r2 R r"],
      [8, 7, "r R .12 R r"],
      [8, 8, "R .14 R"],
    ],
  };
  HAIR[1] = HAIR[0].slice(0, 8).concat(
    [9, 10, 11, 12, 13, 14, 15].map((y) => [8, y, "r R .12 R r"]),
    [[8, 16, "r R"], [22, 16, "R r"], [8, 17, "r R"], [22, 17, "R r"], [7, 18, "r R"], [23, 18, "R r"]]
  );
  HAIR[3] = HAIR[0].concat([[13, 0, "r H r2 R r"], [14, -1, "r H r R"]]);

  function heroSvg(look, worn, style = {}) {
    worn = worn || {};
    style = style || {};
    const skin = look.skin || "#e0ac87";
    const hair = look.hair || "#2b1b17";
    const shirt = look.shirt || "#475569";
    const pants = look.pants || "#334155";
    const pal = {
      o: OUTLINE,
      s: skin,
      S: darker(skin, 0.18),
      h: lighter(skin, 0.25),
      q: mix(skin, "#e11d48", 0.28),
      n: darker(skin, 0.22),
      m: "#7a2e2e",
      b: darker(hair, 0.25),
      p: look.eyes || "#1e293b",
      i: "#ffffff",
      c: shirt,
      C: darker(shirt),
      L: lighter(shirt, 0.18),
      t: pants,
      T: darker(pants),
      f: "#3b2a1e",
      F: "#24170f",
      w: "#4a3220",
      k: "#d4a017",
      r: hair,
      R: darker(hair, 0.3),
      H: lighter(hair, 0.28),
    };
    const grid = new Map();

    // Cape (cosmetic), behind everything; it flares out around the body
    const cape = CAPES[style.cape];
    if (cape) {
      const cp = { c: cape[0], d: cape[1], l: lighter(cape[0], 0.2), o: OUTLINE };
      const c = [[8, 19, "o c14 o"]];
      for (let y = 20; y <= 26; y++) c.push([7, y, "o d c14 d o"]);
      for (let y = 27; y <= 35; y++) c.push([6, y, "o d c16 d o"]);
      for (let y = 36; y <= 43; y++) c.push([5, y, "o d c18 d o"]);
      c.push([5, 44, "o d2 o c2 d2 o d2 o c2 d2 o d o"]);
      c.push([8, 22, "l"], [7, 30, "l"], [6, 38, "l"]);
      paint(grid, c, cp);
    }

    paint(grid, bodyLayer(), pal);
    if (!worn.helmet) paint(grid, HAIR[look.style] || HAIR[0], pal);

    // Gear, in each item's tier material
    const gear = (slot, segs) => paint(grid, segs(tierNum(worn[slot])), tierPalette(tierOf(worn[slot])));
    if (worn.legs) {
      gear("legs", (n) => {
        const s = [];
        for (let y = 30; y <= 38; y++) s.push([10, y, "l m2 m d"], [17, y, "l m2 m d"]);
        if (n >= 2) s.push([10, 34, "d a3 d"], [17, 34, "d a3 d"], [10, 35, "d5"], [17, 35, "d5"]);
        if (n >= 3) s.push([10, 29, "d5 a2 d5"]);
        if (n >= 5) s.push([11, 37, "e"], [20, 37, "e"]);
        return s;
      });
    }
    if (worn.shoes) {
      gear("shoes", (n) => {
        const s = [];
        for (let y = 39; y <= 42; y++) s.push([10, y, "l m2 d"], [17, y, "l m2 d"]);
        s.push([10, 39, n >= 3 ? "a4" : "d4"], [17, 39, n >= 3 ? "a4" : "d4"], [10, 43, "m4 d"], [17, 43, "m4 d"]);
        if (n >= 4) s.push([12, 41, "g"], [19, 41, "g"]);
        return s;
      });
    }
    if (worn.chest) {
      gear("chest", (n) => {
        const s = [
          [10, 20, "d l m2 .4 m3 d"],
          [10, 21, "d l m2 d4 m3 d"],
          [10, 22, "d l m3 a2 m4 d"],
          [10, 23, "d l m3 a2 m4 d"],
          [10, 24, "d l m9 d"],
          [10, 25, "d m10 d"],
          [10, 26, "d12"],
          [10, 27, "d l m9 d"],
          [10, 28, "d m10 d"],
        ];
        for (let y = 20; y <= 25; y++) s.push([7, y, "m d"], [23, y, "d m"]); // sleeves
        if (n >= 2) s.push([5, 19, "o l m2 d o"], [5, 20, "o m3 d o"], [6, 21, "o d3"], [21, 19, "o d m2 l o"], [21, 20, "o d m3 o"], [23, 21, "d3 o"]);
        if (n >= 3) s.push([6, 19, "a3"], [23, 19, "a3"]);
        if (n >= 4) s.push([15, 22, "g2"]);
        if (n >= 5) s.push([6, 18, "a . a"], [23, 18, "a . a"], [12, 24, "e"], [19, 24, "e"]);
        return s;
      });
    }
    if (worn.gloves) {
      gear("gloves", (n) => {
        const s = [];
        for (let y = 27; y <= 30; y++) s.push([7, y, "m d"], [23, y, "d m"]);
        s.push([6, 26, n >= 3 ? "o a2 o" : "o d2 o"], [22, 26, n >= 3 ? "o a2 o" : "o d2 o"], [7, 28, "l"], [24, 28, "l"]);
        if (n >= 4) s.push([7, 27, "g"], [24, 27, "g"]);
        return s;
      });
    }
    if (worn.helmet) {
      gear("helmet", (n) => {
        const s = [
          [11, 1, "o10"],
          [10, 2, "o l3 m6 d o"],
          [9, 3, "o l2 m9 d o"],
          [8, 4, "o l m11 d2 o"],
          [8, 5, "o m14 o"],
          [8, 6, n >= 3 ? "o a14 o" : "o d14 o"],
          [8, 7, "o m2 .10 m2 o"],
        ];
        for (let y = 8; y <= 12; y++) s.push([8, y, "o m d .10 d m o"]);
        s.push([8, 13, "o m"], [22, 13, "m o"]);
        if (n >= 2) s.push([15, 7, "d2"], [15, 8, "d2"], [15, 9, "d2"]);
        if (n >= 3) s.push([6, 4, "a2"], [5, 3, "a2"], [4, 2, "a2"], [4, 1, "a"], [4, 0, "l"], [24, 4, "a2"], [25, 3, "a2"], [26, 2, "a2"], [27, 1, "a"], [27, 0, "l"]);
        if (n >= 4) s.push([14, 0, "a g2 a"]);
        if (n >= 5) s.push([12, 0, "e"], [19, 0, "e"], [10, 1, "e"], [21, 1, "e"], [15, -1, "e2"]);
        return s;
      });
    }
    if (worn.weapon) {
      gear("weapon", (n) => {
        if (n === 1) {
          const s = [[6, 11, "o4"]];
          for (let y = 12; y <= 18; y++) s.push([5, y, "o l m2 d o"]);
          s.push([7, 14, "d"], [6, 17, "a"]);
          for (let y = 19; y <= 27; y++) s.push([6, y, "o l m o"]);
          for (let y = 28; y <= 31; y++) s.push([7, y, "w W"]);
          return s;
        }
        const s = [];
        if (n >= 3) {
          s.push([7, 7, "o2"], [6, 8, "o l m o"]);
          for (let y = 9; y <= 26; y++) s.push([5, y, "o l m2 d o"]);
          s.push([3, 27, "o a8 o"]);
        } else {
          s.push([7, 10, "o2"]);
          for (let y = 11; y <= 26; y++) s.push([6, y, "o l m o"]);
          s.push([4, 27, "o a6 o"]);
        }
        for (let y = 28; y <= 31; y++) s.push([7, y, y % 2 ? "w W" : "W w"]);
        s.push([6, 32, "o a2 o"]);
        if (n >= 4) s.push([7, 27, "g2"]);
        if (n >= 5) s.push([3, 10, "e"], [11, 13, "e"], [3, 16, "e"], [11, 19, "e"], [4, 23, "e"]);
        return s;
      });
    }
    if (worn.shield) {
      gear("shield", (n) => {
        const s = [[22, 21, "o7"]];
        for (let y = 22; y <= 28; y++) s.push([21, y, "o l m5 d o"]);
        s.push([22, 29, "o l m3 d o"], [23, 30, "o m3 o"], [24, 31, "o m o"], [25, 32, "o"]);
        if (n === 1) for (let y = 22; y <= 29; y++) s.push([24, y, "d"]);
        if (n >= 2) s.push([24, 25, "l3"], [25, 24, "l"], [25, 26, "l"]);
        if (n >= 3) {
          for (let y = 22; y <= 30; y++) s.push([25, y, "a"]);
          s.push([22, 25, "a7"]);
        }
        if (n >= 4) s.push([25, 25, "g"]);
        if (n >= 5) s.push([21, 21, "e"], [29, 21, "e"], [22, 30, "e"], [28, 30, "e"]);
        return s;
      });
    }
    if (worn.ring) gear("ring", (n) => [[8, 30, n >= 2 ? "g" : "m"]]);

    // The cape's collar and clasp sit over the shoulders
    if (cape) paint(grid, [[10, 19, "c12"], [15, 19, "g2"]], { c: cape[0], g: style.cape === "cape-gold" ? "#e0123c" : "#facc15" });

    // Hat (cosmetic), over hair and helmet
    const hats = {
      "hat-crown": [[11, -2, "y .2 y .2 y .2 y"], [11, -1, "y l y8"], [11, 0, "y2 r y4 b y2"], [11, 1, "Y10"]],
      "hat-wizard": [[16, -4, "P"], [15, -3, "p2"], [14, -2, "p3 P"], [13, -1, "p2 y p2 P"], [12, 0, "p7 P"], [11, 1, "p9 P"], [6, 2, "P20"]],
      "hat-horns": [[8, -2, "r"], [8, -1, "r2"], [9, 0, "r2"], [10, 1, "r"], [23, -2, "r"], [22, -1, "r2"], [21, 0, "r2"], [21, 1, "r"]],
      "hat-halo": [[12, -4, "y8"], [11, -3, "y .8 y"], [12, -2, "y8"]],
    };
    if (hats[style.hat]) {
      paint(grid, hats[style.hat], {
        y: style.hat === "hat-halo" ? "#fde68a" : "#facc15",
        Y: "#ca8a04",
        l: "#fff7cc",
        r: "#dc2626",
        b: "#3b82f6",
        p: "#7c3aed",
        P: "#5b21b6",
      });
    }

    // A soft shadow under the feet
    paint(grid, [[8, 45, "x16"], [10, 46, "x12"]], { x: "rgba(0,0,0,0.28)" });

    const root = toSvg(grid, "0 -5 32 53", "hero-sprite", "Your adventurer");
    const aura = auraOf(worn);
    if (aura) root.classList.add(`aura-${aura}`);
    return root;
  }

  // Most of the gear (5 of 8 slots) in tier 5 / tier 4 or better makes the adventurer glow
  function auraOf(worn) {
    const items = Object.values(worn || {});
    if (items.filter((i) => (i.tier || 1) >= 5).length >= 5) return "abyss";
    if (items.filter((i) => (i.tier || 1) >= 4).length >= 5) return "frost";
    return "";
  }

  return { heroSvg, gearIcon, auraOf, tiers: TIERS, paint, toSvg, mix, darker, lighter };
})();
