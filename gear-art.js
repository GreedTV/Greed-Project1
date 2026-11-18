// Illustrated art for the adventure: the adventurer (a slim, cel-shaded anime warrior), their gear and the
// monsters, drawn as SVG.
// Gear looks like its tier's material, and higher tiers get more: Wooden (leather and wood), Iron
// (polished steel), Bogsteel (dark teal steel with gold trim and horns), Frost (ice crystal plate) and
// Abyssal (black-red plate with glowing cracks and spikes).
//   SinnersArt.heroSvg(look, worn, style)   the adventurer; worn = { slot: item }, style = cosmetics { hat, cape }
//   SinnersArt.gearIcon(item)               a square icon of one item ({ slot, tier })
//   SinnersArt.monsterSvg(art, { boss })    a monster: wolf, skeleton, goblin, spider, witch, scorpion, giant, golem, demon, dragon
//   SinnersArt.auraOf(worn)                 "frost" / "abyss" when most of the gear is tier 4 / 5

const SinnersArt = (() => {
  const NS = "http://www.w3.org/2000/svg";
  const INK = "#140c10"; // outlines
  const TIERS = [
    null,
    { name: "Wooden", main: "#8b5a2b", dark: "#4a2c12", light: "#c98f55", trim: "#5c3a1e", accent: "#b45309", gem: "#f59e0b" },
    { name: "Iron", main: "#9aa3ad", dark: "#4b5563", light: "#f1f5f9", trim: "#6b7280", accent: "#cbd5e1", gem: "#e2e8f0" },
    { name: "Bogsteel", main: "#1f6b65", dark: "#0b2e2c", light: "#5eead4", trim: "#d4a017", accent: "#facc15", gem: "#facc15" },
    { name: "Frost", main: "#7dd3fc", dark: "#0b5a8a", light: "#f0f9ff", trim: "#e0f2fe", accent: "#38bdf8", gem: "#ffffff", glow: "#7dd3fc" },
    { name: "Abyssal", main: "#4a0f16", dark: "#14050a", light: "#b91c1c", trim: "#f59e0b", accent: "#ef4444", gem: "#fde047", glow: "#ef4444" },
  ];
  const tierNum = (item) => Math.min(5, Math.max(1, (item && item.tier) || 1));
  const tierOf = (item) => TIERS[tierNum(item)];

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

  // Every drawing gets its own gradient ids, so many can share a page
  let uid = 0;
  function canvas(viewBox, className, label) {
    const id = `sa${++uid}`;
    const defs = [];
    const grad = (name, stops, dir = "v") => {
      const [x2, y2] = dir === "h" ? ["1", "0"] : dir === "d" ? ["1", "1"] : ["0", "1"];
      defs.push(`<linearGradient id="${id}${name}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c, op]) => `<stop offset="${o}" stop-color="${c}"${op != null ? ` stop-opacity="${op}"` : ""}/>`).join("")}</linearGradient>`);
      return `url(#${id}${name})`;
    };
    const radial = (name, stops, cx = 0.5, cy = 0.5, r = 0.5) => {
      defs.push(`<radialGradient id="${id}${name}" cx="${cx}" cy="${cy}" r="${r}">${stops.map(([o, c, op]) => `<stop offset="${o}" stop-color="${c}"${op != null ? ` stop-opacity="${op}"` : ""}/>`).join("")}</radialGradient>`);
      return `url(#${id}${name})`;
    };
    // Shaded metal (or leather) in a tier's colors
    const metal = (t, name, dir = "h") =>
      grad(name, [[0, lighter(t.light, 0.1)], [0.35, t.main], [0.75, t.dark], [1, darker(t.dark, 0.3)]], dir);
    return {
      grad,
      radial,
      metal,
      finish(body) {
        const root = document.createElementNS(NS, "svg");
        root.setAttribute("viewBox", viewBox);
        root.setAttribute("class", className);
        root.setAttribute("role", "img");
        if (label) root.setAttribute("aria-label", label);
        root.innerHTML = `<defs>${defs.join("")}</defs>${body}`;
        return root;
      },
    };
  }

  const stroke = (w = 1.4) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
  const shine = (d, op = 0.35) => `<path d="${d}" fill="none" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" opacity="${op}"/>`;

  // ---------- Gear pieces (drawn on the adventurer's 120 x 200 frame) ----------

  const PIECES = {
    helmet(c, t, n) {
      const m = c.metal(t, "helm");
      let s = "";
      if (n === 1) {
        // leather cap with ear flaps
        s += `<path d="M42 40 Q42 18 60 16 Q78 18 78 40 L76 52 L70 50 L70 38 L50 38 L50 50 L44 52 Z" fill="${m}" ${stroke()}/>`;
        s += `<path d="M44 38 Q60 32 76 38" fill="none" stroke="${t.trim}" stroke-width="2.5"/>`;
        s += `<path d="M48 26 Q60 20 72 26" fill="none" stroke="${INK}" stroke-width="0.8" stroke-dasharray="2 2" opacity="0.6"/>`;
        return s + shine("M48 26 Q54 21 60 20");
      }
      // metal dome
      s += `<path d="M41 48 Q40 14 60 12 Q80 14 79 48 L79 54 L72 54 L71 35 L49 35 L48 54 L41 54 Z" fill="${m}" ${stroke()}/>`;
      s += `<path d="M42 30 L78 30 L78 35 L42 35 Z" fill="${t.trim}" ${stroke(1)}/>`;
      if (n >= 2) s += `<path d="M58 35 L62 35 L61.5 48 L58.5 48 Z" fill="${m}" ${stroke(1)}/>`; // nose guard
      if (n === 2) s += `<path d="M60 12 L60 30" stroke="${t.dark}" stroke-width="2"/><circle cx="45" cy="32.5" r="1.2" fill="${t.light}"/><circle cx="75" cy="32.5" r="1.2" fill="${t.light}"/>`;
      if (n === 3) {
        // curved horns and a gold crest
        s += `<path d="M42 30 Q28 26 26 12 Q34 22 43 24 Z" fill="${c.grad("horn", [[0, "#fef3c7"], [1, "#a16207"]])}" ${stroke(1.2)}/>`;
        s += `<path d="M78 30 Q92 26 94 12 Q86 22 77 24 Z" fill="${c.grad("horn2", [[0, "#fef3c7"], [1, "#a16207"]])}" ${stroke(1.2)}/>`;
        s += `<path d="M56 15 L60 6 L64 15" fill="${t.trim}" ${stroke(1)}/>`;
      }
      if (n === 4) {
        // ice crystal crown
        s += `<path d="M46 20 L44 6 L51 17 L55 1 L60 15 L65 1 L69 17 L76 6 L74 20 Z" fill="${c.grad("ice", [[0, "#ffffff"], [0.5, "#bae6fd"], [1, "#38bdf8"]])}" ${stroke(1)} opacity="0.95"/>`;
        s += `<circle cx="60" cy="32.5" r="2.4" fill="${t.gem}" stroke="${t.accent}" stroke-width="1"/>`;
      }
      if (n === 5) {
        // great helm with a glowing visor and swept horns
        s += `<path d="M41 44 L41 58 Q60 64 79 58 L79 44 Z" fill="${m}" ${stroke()}/>`;
        s += `<path d="M46 47 L74 47 L72 51 L48 51 Z" fill="${t.glow}"/><path d="M46 47 L74 47" stroke="#fecaca" stroke-width="0.8"/>`;
        s += `<path d="M42 28 Q24 22 20 4 Q30 18 43 20 Z" fill="${t.dark}" ${stroke(1.2)}/><path d="M78 28 Q96 22 100 4 Q90 18 77 20 Z" fill="${t.dark}" ${stroke(1.2)}/>`;
        s += `<path d="M48 35 L72 35 L72 44 L48 44 Z" fill="${m}" ${stroke(1)}/><path d="M60 12 L60 30" stroke="${t.accent}" stroke-width="1.4" opacity="0.8"/>`;
      }
      return s + shine("M47 30 Q50 20 60 18", 0.45);
    },
    chest(c, t, n) {
      const m = c.metal(t, "chest");
      let s = "";
      if (n === 1) {
        // leather jerkin with straps and buckles
        s += `<path d="M39 67 Q60 60 81 67 L80 108 Q60 114 40 108 Z" fill="${m}" ${stroke()}/>`;
        s += `<path d="M41 70 L79 104 M79 70 L41 104" stroke="${t.trim}" stroke-width="3.5" opacity="0.9"/>`;
        s += `<rect x="56" y="83" width="8" height="6" rx="1" fill="#a8a29e" ${stroke(0.8)}/>`;
        s += `<path d="M44 74 L44 102 M76 74 L76 102" stroke="${INK}" stroke-width="0.7" stroke-dasharray="2 2" opacity="0.5"/>`;
        return s + shine("M44 70 Q52 66 58 66");
      }
      // arm plates, then the breastplate
      const am = c.metal(t, "arms", "h");
      s += `<path d="M38 68 L29 96 L39 100 L46 78 Z M82 68 L91 96 L81 100 L74 78 Z" fill="${am}" ${stroke()}/>`;
      s += `<path d="M33 84 L42 88 M87 84 L78 88" stroke="${n >= 3 ? t.trim : t.dark}" stroke-width="1.6"/>`;
      s += `<path d="M39 67 Q60 59 81 67 L80 106 Q60 113 40 106 Z" fill="${m}" ${stroke()}/>`;
      s += `<path d="M60 64 L60 108" stroke="${t.dark}" stroke-width="1.2" opacity="0.7"/>`;
      s += `<path d="M42 92 Q60 98 78 92 M42 100 Q60 106 78 100" fill="none" stroke="${t.dark}" stroke-width="1.2" opacity="0.8"/>`;
      if (n >= 3) s += `<path d="M39 67 Q60 59 81 67" fill="none" stroke="${t.trim}" stroke-width="2.4"/><path d="M40 106 Q60 113 80 106" fill="none" stroke="${t.trim}" stroke-width="2.4"/>`;
      // shoulder plates, bigger with the tier
      const r = 7 + n * 1.6;
      const pm = c.metal(t, "pauld", "v");
      s += `<ellipse cx="38" cy="70" rx="${r}" ry="${r * 0.75}" fill="${pm}" ${stroke()}/><ellipse cx="82" cy="70" rx="${r}" ry="${r * 0.75}" fill="${pm}" ${stroke()}/>`;
      s += `<path d="M${38 - r * 0.7} 72 Q38 ${70 + r * 0.6} ${38 + r * 0.7} 72 M${82 - r * 0.7} 72 Q82 ${70 + r * 0.6} ${82 + r * 0.7} 72" fill="none" stroke="${t.dark}" stroke-width="1"/>`;
      if (n >= 3) s += `<circle cx="38" cy="68" r="1.6" fill="${t.trim}"/><circle cx="82" cy="68" r="1.6" fill="${t.trim}"/>`;
      if (n === 3) s += `<path d="M60 74 L66 82 L60 90 L54 82 Z" fill="${t.trim}" ${stroke(1)}/>`;
      if (n === 4) {
        s += `<path d="M60 70 L67 82 L60 94 L53 82 Z" fill="${c.grad("core", [[0, "#ffffff"], [1, "#38bdf8"]])}" ${stroke(1)}/>`;
        s += `<path d="M30 64 L34 56 L37 65 M78 65 L83 55 L86 64" fill="#e0f2fe" ${stroke(1)}/>`;
      }
      if (n === 5) {
        s += `<circle cx="60" cy="82" r="6" fill="${c.radial("eye", [[0, "#fde047"], [0.5, "#ef4444"], [1, "#450a0a"]])}" ${stroke(1)}/>`;
        s += `<path d="M44 76 L50 86 L46 96 M76 76 L70 86 L74 96" fill="none" stroke="${t.glow}" stroke-width="1.4" opacity="0.9"/>`;
        s += `<path d="M28 66 L24 54 L33 63 M36 61 L36 49 L41 61 M92 66 L96 54 L87 63 M84 61 L84 49 L79 61" fill="${t.dark}" ${stroke(1)}/>`;
      }
      return s + shine("M45 70 Q52 65 58 65", 0.5);
    },
    legs(c, t, n) {
      const m = c.metal(t, "legs");
      let s = "";
      // thigh and shin plates on both legs
      [44, 62].forEach((x) => {
        s += `<path d="M${x} 116 L${x + 14} 116 L${x + 13} 160 L${x + 1} 160 Z" fill="${m}" ${stroke()}/>`;
        s += `<ellipse cx="${x + 7}" cy="138" rx="${5 + (n >= 2 ? 1.5 : 0)}" ry="4.5" fill="${n === 1 ? t.trim : c.metal(t, "knee" + x, "v")}" ${stroke(1)}/>`;
        if (n >= 3) s += `<path d="M${x + 1} 150 L${x + 13} 150" stroke="${t.trim}" stroke-width="1.8"/>`;
        if (n === 4) s += `<path d="M${x + 7} 134 L${x + 7} 126" stroke="#e0f2fe" stroke-width="1.6"/>`;
        if (n === 5) s += `<path d="M${x + 4} 145 L${x + 7} 140 L${x + 10} 145" fill="none" stroke="${t.glow}" stroke-width="1.2"/>`;
        s += shine(`M${x + 3} 120 L${x + 3} 132`, 0.35);
      });
      // plates hanging from the belt
      if (n >= 2) s += `<path d="M42 108 L58 108 L56 122 L44 122 Z M62 108 L78 108 L76 122 L64 122 Z" fill="${m}" ${stroke(1.2)}/>`;
      if (n >= 3) s += `<path d="M42 108 L58 108 M62 108 L78 108" stroke="${t.trim}" stroke-width="2"/>`;
      return s;
    },
    shoes(c, t, n) {
      const m = c.metal(t, "boots", "v");
      let s = "";
      [[43, -1], [61, 1]].forEach(([x]) => {
        s += `<path d="M${x} 160 L${x + 16} 160 L${x + 17} 182 Q${x + 18} 190 ${x + 8} 190 L${x - 2} 190 Q${x - 4} 186 ${x} 182 Z" fill="${m}" ${stroke()}/>`;
        s += `<path d="M${x} 166 L${x + 16} 166" stroke="${n >= 3 ? t.trim : t.dark}" stroke-width="2"/>`;
        if (n >= 3) s += `<path d="M${x - 2} 190 Q${x - 3} 184 ${x + 2} 182 L${x + 8} 182" fill="none" stroke="${t.trim}" stroke-width="1.6"/>`;
        if (n === 4) s += `<path d="M${x + 4} 160 L${x + 6} 154 L${x + 8} 160" fill="#e0f2fe" ${stroke(0.8)}/>`;
        if (n === 5) s += `<path d="M${x + 16} 170 L${x + 21} 166 L${x + 17} 174 Z" fill="${t.dark}" ${stroke(0.8)}/><circle cx="${x + 8}" cy="174" r="1.6" fill="${t.glow}"/>`;
        s += shine(`M${x + 3} 168 L${x + 3} 180`, 0.3);
      });
      return s;
    },
    gloves(c, t, n) {
      const m = c.metal(t, "gloves", "v");
      let s = "";
      [[24, 36], [84, 96]].forEach(([x1, x2]) => {
        s += `<path d="M${x1} 100 L${x2} 100 L${x2 + 1} 120 L${x1 - 1} 120 Z" fill="${m}" ${stroke()}/>`;
        s += `<path d="M${x1 - 2} 100 L${x2 + 2} 100 L${x2 + 2} 105 L${x1 - 2} 105 Z" fill="${n >= 3 ? t.trim : t.dark}" ${stroke(1)}/>`;
        // the hand: knuckle plate, fingers and thumb
        const cx = (x1 + x2) / 2;
        const thumb = x1 < 60 ? 1 : -1;
        s += `<path d="M${cx - 7} 118 L${cx + 7} 118 L${cx + 7.5} 129 Q${cx + 7} 134 ${cx} 134 Q${cx - 7} 134 ${cx - 7.5} 129 Z" fill="${m}" ${stroke()}/>`;
        s += `<path d="M${cx + thumb * 7} 120 Q${cx + thumb * 12} 122 ${cx + thumb * 10} 128 L${cx + thumb * 7} 127" fill="${m}" ${stroke(1)}/>`;
        s += `<path d="M${cx - 3.5} 127 L${cx - 3.5} 133 M${cx} 127 L${cx} 134 M${cx + 3.5} 127 L${cx + 3.5} 133" stroke="${t.dark}" stroke-width="1"/>`;
        s += `<path d="M${cx - 7} 122 L${cx + 7} 122" stroke="${n >= 3 ? t.trim : t.dark}" stroke-width="1.6"/>`;
        if (n >= 4) s += `<circle cx="${(x1 + x2) / 2}" cy="110" r="1.8" fill="${t.gem}"/>`;
        if (n === 5) s += `<path d="M${x1} 112 L${x1 - 5} 109 L${x1} 116" fill="${t.dark}" ${stroke(0.8)}/>`;
      });
      return s;
    },
    weapon(c, t, n) {
      // held in the hand on the left, pointing up
      let s = "";
      const grip = c.grad("grip", [[0, "#7c4a24"], [1, "#3b2210"]], "h");
      if (n === 1) {
        s += `<path d="M27 132 L33 132 L35 70 Q37 52 30 46 Q22 52 25 70 Z" fill="${c.metal(t, "club")}" ${stroke()}/>`;
        s += `<circle cx="27" cy="62" r="1.8" fill="#a8a29e"/><circle cx="33" cy="70" r="1.8" fill="#a8a29e"/><circle cx="28" cy="78" r="1.6" fill="#a8a29e"/>`;
        s += `<path d="M26 120 L34 120 M26 126 L34 126" stroke="#3b2210" stroke-width="2"/>`;
        return s + shine("M28 52 Q26 62 27 76", 0.3);
      }
      const w = n >= 3 ? 7 : 5;
      const tip = n >= 3 ? 24 : 34;
      const blade = n === 4 ? c.grad("ice", [[0, "#ffffff"], [0.5, "#bae6fd"], [1, "#0ea5e9"]], "h") : n === 5 ? c.grad("abyss", [[0, "#7f1d1d"], [0.5, "#1c0508"], [1, "#450a0a"]], "h") : c.metal(TIERS[Math.min(n, 3) === 3 ? 2 : 2], "blade");
      s += `<path d="M${30 - w} 104 L${30 - w} ${tip + 10} L30 ${tip} L${30 + w} ${tip + 10} L${30 + w} 104 Z" fill="${blade}" ${stroke()}/>`;
      s += `<path d="M30 ${tip + 4} L30 102" stroke="${n === 5 ? "#ef4444" : n === 4 ? "#ffffff" : "#64748b"}" stroke-width="${n === 5 ? 1.6 : 1}" opacity="0.85"/>`;
      if (n === 5) s += `<path d="M${30 - w} 60 L${30 - w - 3} 64 L${30 - w} 68 M${30 + w} 76 L${30 + w + 3} 80 L${30 + w} 84" fill="#450a0a" ${stroke(0.8)}/>`;
      // crossguard, grip and pommel
      const guard = n >= 3 ? TIERS[n].trim : "#6b7280";
      s += `<path d="M${16 - n} 104 L${44 + n} 104 L${42 + n} 110 L${18 - n} 110 Z" fill="${guard}" ${stroke(1.2)}/>`;
      if (n >= 4) s += `<circle cx="30" cy="107" r="2.6" fill="${TIERS[n].gem}" stroke="${TIERS[n].accent}" stroke-width="1"/>`;
      s += `<rect x="27" y="110" width="6" height="22" rx="1.5" fill="${grip}" ${stroke(1.2)}/>`;
      s += `<path d="M27 116 L33 114 M27 122 L33 120 M27 128 L33 126" stroke="#2a170a" stroke-width="1"/>`;
      s += `<circle cx="30" cy="135" r="3.6" fill="${guard}" ${stroke(1)}/>`;
      return s + shine(`M${30 - w + 2} ${tip + 14} L${30 - w + 2} 98`, 0.45);
    },
    shield(c, t, n) {
      // on the arm on the right
      const m = c.metal(t, "shield", "d");
      let s = "";
      if (n === 1) {
        s += `<circle cx="94" cy="112" r="19" fill="${m}" ${stroke()}/>`;
        s += `<path d="M82 98 L82 126 M90 94 L90 130 M98 94 L98 130 M106 98 L106 126" stroke="${t.dark}" stroke-width="1.2" opacity="0.8"/>`;
        s += `<circle cx="94" cy="112" r="19" fill="none" stroke="#9ca3af" stroke-width="2.6"/><circle cx="94" cy="112" r="4.5" fill="#9ca3af" ${stroke(1)}/>`;
        return s;
      }
      if (n === 2) s += `<path d="M76 92 L112 92 L111 118 Q106 132 94 138 Q82 132 77 118 Z" fill="${m}" ${stroke()}/><circle cx="94" cy="111" r="5" fill="${t.light}" ${stroke(1)}/>`;
      if (n === 3) {
        s += `<path d="M76 90 L112 90 L110 116 Q104 134 94 142 Q84 134 78 116 Z" fill="${m}" ${stroke()}/>`;
        s += `<path d="M76 90 L112 90 L110 116 Q104 134 94 142 Q84 134 78 116 Z" fill="none" stroke="${t.trim}" stroke-width="2.2"/>`;
        s += `<path d="M94 96 L94 132 M82 108 L106 108" stroke="${t.trim}" stroke-width="3.4"/>`;
      }
      if (n === 4) {
        s += `<path d="M94 86 L114 98 L110 124 L94 142 L78 124 L74 98 Z" fill="${c.grad("ice", [[0, "#ffffff"], [0.4, "#bae6fd"], [1, "#0369a1"]], "d")}" ${stroke()}/>`;
        s += `<path d="M94 86 L94 142 M74 98 L114 124 M114 98 L74 124" stroke="#ffffff" stroke-width="0.9" opacity="0.7"/>`;
        s += `<circle cx="94" cy="112" r="4" fill="#ffffff" stroke="#38bdf8"/>`;
      }
      if (n === 5) {
        s += `<path d="M74 90 L114 90 L112 118 Q106 136 94 144 Q82 136 76 118 Z" fill="${m}" ${stroke()}/>`;
        s += `<path d="M74 90 L68 82 L80 90 M114 90 L120 82 L108 90 M94 144 L94 152" stroke="${INK}" stroke-width="1.2" fill="${t.dark}"/>`;
        s += `<ellipse cx="94" cy="112" rx="9" ry="6" fill="#120306" ${stroke(1)}/><ellipse cx="94" cy="112" rx="3" ry="5" fill="${c.radial("seye", [[0, "#fde047"], [1, "#ef4444"]])}"/>`;
        s += `<path d="M80 100 L86 106 M108 100 L102 106 M84 128 L90 122 M104 128 L98 122" stroke="${t.glow}" stroke-width="1.4"/>`;
      }
      return s + shine("M80 96 Q86 94 92 94", 0.45);
    },
    ring(c, t, n) {
      return `<circle cx="90" cy="126" r="2.6" fill="none" stroke="${n >= 3 ? "#facc15" : "#cbd5e1"}" stroke-width="1.6"/><circle cx="90" cy="123.6" r="1.6" fill="${t.gem}"/>`;
    },
  };

  // ---------- The adventurer (120 x 200): a slim anime warrior, cel shaded ----------
  // Dynamic stance, sword angled down in the left hand, a long coat, sharp glowing eyes. Armor by tier
  // is worn over the coat; the hair stays visible under every helmet, anime style.

  const CAPES = { "cape-red": ["#b91c1c", "#7f1d1d"], "cape-purple": ["#7e22ce", "#4c1d95"], "cape-gold": ["#eab308", "#a16207"] };

  // A limb along joint points with a width at each, as one outlined shape
  function limb(pts, widths) {
    const left = [];
    const right = [];
    pts.forEach((p, i) => {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(pts.length - 1, i + 1)];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      const nx = (-dy / len) * (widths[i] / 2);
      const ny = (dx / len) * (widths[i] / 2);
      left.push(`${(p[0] + nx).toFixed(1)} ${(p[1] + ny).toFixed(1)}`);
      right.unshift(`${(p[0] - nx).toFixed(1)} ${(p[1] - ny).toFixed(1)}`);
    });
    return `M${left.join(" L")} L${right.join(" L")} Z`;
  }

  // Joints of the pose
  const POSE = {
    armL: [[47, 60], [41, 88], [38, 114]],
    armR: [[77, 60], [85, 86], [82, 110]],
    legL: [[55, 100], [49, 140], [45, 176]],
    legR: [[68, 100], [74, 140], [79, 176]],
  };

  const ink = (w = 1.6) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

  function animeHair(style, hair) {
    const dark = darker(hair, 0.35);
    const light = lighter(hair, 0.3);
    const back = {
      1: `<path d="M50 20 Q44 50 46 84 L54 78 L56 40 Z M74 20 Q82 52 78 86 L70 78 L68 40 Z" fill="${hair}" ${ink()}/><path d="M48 40 Q46 62 48 80" fill="none" stroke="${dark}" stroke-width="2"/>`,
      3: `<path d="M70 14 Q90 16 92 36 Q94 58 84 76 Q86 54 80 40 Q76 28 70 22 Z" fill="${hair}" ${ink()}/>`,
    };
    const fronts = {
      // spiky, the classic
      0: `<path d="M49 30 L40 18 L50 20 L44 6 L56 14 L58 1 L64 12 L72 2 L72 14 L82 8 L77 20 L86 20 L76 28 L75 34 Q72 22 64 20 L60 30 L58 22 L54 32 L52 24 Z" fill="${hair}" ${ink()}/>`,
      1: `<path d="M48 32 Q46 10 62 8 Q78 8 77 30 L72 22 L68 34 L64 22 L60 34 L56 22 L52 34 Z" fill="${hair}" ${ink()}/>`,
      2: `<path d="M48 30 L44 16 L52 18 L50 6 L60 12 L66 4 L68 14 L78 10 L74 20 L80 24 L76 30 Q72 20 64 18 Q56 20 52 30 Z" fill="${hair}" ${ink()}/>`,
      3: `<path d="M48 32 Q46 10 62 9 Q78 9 76 30 L70 22 L66 32 L62 20 L58 32 L54 22 L50 32 Z" fill="${hair}" ${ink()}/>`,
    };
    const shade = `<path d="M54 14 Q62 10 70 13 Q64 14 60 20 Z" fill="${light}" opacity="0.8"/><path d="M70 22 L72 30 L75 34 L76 28 Z" fill="${dark}"/>`;
    return { back: back[style] || "", front: (fronts[style] || fronts[0]) + shade };
  }

  // Armor and weapons on the slim figure, by tier
  const HERO_GEAR = {
    helmet(c, t, n) {
      if (n === 1) return `<path d="M49 24 Q62 20 76 24 L76 28 Q62 24 49 28 Z" fill="${t.main}" ${ink(1.2)}/><path d="M76 25 L84 30 L80 33 L76 28" fill="${t.main}" ${ink(1)}/>`;
      if (n === 2) return `<path d="M49 22 Q62 16 76 22 L76 28 Q62 23 49 28 Z" fill="${c.metal(t, "hhelm")}" ${ink(1.2)}/><path d="M60 18 L64 18 L63 26 L61 26 Z" fill="${t.light}"/>`;
      if (n === 3)
        return `<path d="M49 22 Q62 16 76 22 L75 27 Q62 22 50 27 Z" fill="${t.trim}" ${ink(1.2)}/><path d="M51 22 Q42 12 44 0 Q48 12 55 18 Z M74 22 Q84 12 82 0 Q78 12 71 18 Z" fill="${c.grad("hhorn", [[0, "#fef3c7"], [1, "#a16207"]])}" ${ink(1.2)}/><circle cx="62.5" cy="21" r="2.2" fill="${t.dark}" stroke="${t.trim}"/>`;
      if (n === 4)
        return `<path d="M50 22 L48 8 L54 18 L58 2 L62 16 L66 0 L69 16 L74 6 L75 22 Q62 17 50 22 Z" fill="${c.grad("hice", [[0, "#ffffff"], [0.5, "#bae6fd"], [1, "#38bdf8"]])}" ${ink(1.1)}/><circle cx="62.5" cy="19" r="2" fill="#fff" stroke="#38bdf8"/>`;
      // demon visor over the eyes, swept horns
      return `<path d="M48 26 L77 26 L76 33 Q62 37 49 33 Z" fill="${t.dark}" ${ink(1.2)}/><path d="M52 29 L60 30 M65 30 L73 29" stroke="${t.glow}" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M50 22 Q38 16 34 0 Q44 12 54 16 Z M75 22 Q87 16 91 0 Q81 12 71 16 Z" fill="${c.grad("hdemon", [[0, "#7f1d1d"], [1, "#0c0a09"]])}" ${ink(1.2)}/>`;
    },
    chest(c, t, n) {
      const m = c.metal(t, "hchest");
      if (n === 1) return `<path d="M50 62 L72 92 M74 62 L52 92" stroke="${t.main}" stroke-width="5" stroke-linecap="round"/><path d="M50 62 L72 92 M74 62 L52 92" stroke="${INK}" stroke-width="0.8" opacity="0.5"/><circle cx="62" cy="77" r="3.4" fill="#a8a29e" ${ink(1)}/>`;
      let s = `<path d="M50 60 Q62 55 74 60 L72 86 Q62 92 52 86 Z" fill="${m}" ${ink()}/>`;
      s += `<path d="M62 58 L62 90" stroke="${t.dark}" stroke-width="1.2"/><path d="M53 80 Q62 84 71 80" fill="none" stroke="${t.dark}" stroke-width="1.2"/>`;
      if (n >= 3) s += `<path d="M50 60 Q62 55 74 60" fill="none" stroke="${t.trim}" stroke-width="2"/>`;
      // one big shoulder plate on the sword arm's other side, anime style
      if (n >= 3) {
        s += `<path d="M70 56 Q86 50 92 62 Q86 70 76 68 Z" fill="${c.metal(t, "hpaul", "v")}" ${ink()}/>`;
        s += `<path d="M74 60 Q84 56 89 63" fill="none" stroke="${t.trim}" stroke-width="1.6"/>`;
      }
      if (n === 4) s += `<path d="M62 64 L67 72 L62 80 L57 72 Z" fill="${c.grad("hcore", [[0, "#fff"], [1, "#38bdf8"]])}" ${ink(1)}/><path d="M84 52 L88 42 L90 54 Z" fill="#e0f2fe" ${ink(1)}/>`;
      if (n === 5) {
        s += `<path d="M55 64 L60 74 L56 84 M69 64 L64 74 L68 84" fill="none" stroke="${t.glow}" stroke-width="1.6"/>`;
        s += `<circle cx="62" cy="72" r="3.2" fill="${c.radial("heye", [[0, "#fde047"], [1, "#dc2626"]])}"/>`;
        s += `<path d="M80 54 L82 40 L86 54 M86 56 L92 46 L91 60" fill="${t.dark}" ${ink(1)}/>`;
      }
      return s;
    },
    legs(c, t, n) {
      const m = c.metal(t, "hlegs", "h");
      let s = "";
      [[49, 140], [74, 140]].forEach(([x, y]) => {
        s += `<ellipse cx="${x}" cy="${y}" rx="6.5" ry="5" fill="${n === 1 ? t.main : m}" ${ink(1.2)}/>`;
        if (n >= 3) s += `<path d="M${x - 4} ${y} L${x + 4} ${y}" stroke="${t.trim}" stroke-width="1.4"/>`;
        if (n === 5) s += `<circle cx="${x}" cy="${y}" r="1.6" fill="${t.glow}"/>`;
      });
      if (n >= 2) s += `<path d="M52 98 L60 98 L58 116 L51 114 Z M65 98 L73 98 L74 114 L67 116 Z" fill="${m}" ${ink(1.2)}/>`;
      return s;
    },
    shoes(c, t, n) {
      const m = c.metal(t, "hboots", "v");
      let s = "";
      [[45, 176, -1], [79, 176, 1]].forEach(([x, y, d]) => {
        s += `<path d="M${x - 6} ${y - 18} L${x + 6} ${y - 18} L${x + 6} ${y + 10} L${x + 6 + d * 8} ${y + 14} L${x - 6 + (d < 0 ? -8 : 0)} ${y + 14} L${x - 6} ${y + 10} Z" fill="${m}" ${ink()}/>`;
        s += `<path d="M${x - 6} ${y - 12} L${x + 6} ${y - 12}" stroke="${n >= 3 ? t.trim : t.dark}" stroke-width="1.8"/>`;
        if (n === 5) s += `<path d="M${x + d * 6} ${y - 6} L${x + d * 11} ${y - 10} L${x + d * 6} ${y - 2}" fill="${t.dark}" ${ink(0.8)}/>`;
      });
      return s;
    },
    gloves(c, t, n) {
      const m = c.metal(t, "hgloves", "v");
      return [
        [POSE.armL[1], POSE.armL[2]],
        [POSE.armR[1], POSE.armR[2]],
      ]
        .map(([a, b]) => {
          const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
          return `<path d="${limb([mid, b], [10, 9.5])}" fill="${m}" ${ink(1.2)}/><circle cx="${b[0]}" cy="${b[1] + 2}" r="5.4" fill="${m}" ${ink(1.2)}/>${n >= 3 ? `<path d="${limb([mid, [mid[0] + (b[0] - mid[0]) * 0.2, mid[1] + (b[1] - mid[1]) * 0.2]], [11, 11])}" fill="${t.trim}"/>` : ""}`;
        })
        .join("");
    },
    weapon(c, t, n) {
      // angled down from the left hand
      const glow = n >= 4 ? `<path d="M36 118 L10 196" stroke="${n === 4 ? "#7dd3fc" : "#ef4444"}" stroke-width="12" stroke-linecap="round" opacity="0.35" class="blade-glow"/>` : "";
      const blade =
        n === 1
          ? c.grad("hbok", [[0, "#d6a85c"], [1, "#7c4a24"]], "h")
          : n === 4
            ? c.grad("hiceb", [[0, "#ffffff"], [0.5, "#bae6fd"], [1, "#0ea5e9"]], "h")
            : n === 5
              ? c.grad("hdark", [[0, "#7f1d1d"], [0.5, "#1c0508"], [1, "#450a0a"]], "h")
              : c.grad("hsteel", [[0, "#ffffff"], [0.5, "#cbd5e1"], [1, "#64748b"]], "h");
      let s = glow;
      s += `<path d="M34 120 L39 122 L13 194 L9 196 Z" fill="${blade}" ${ink(1.3)}/>`;
      if (n >= 2) s += `<path d="M36.5 122 L11.5 192" stroke="${n === 5 ? "#ef4444" : n === 4 ? "#fff" : "#f8fafc"}" stroke-width="0.9" opacity="0.9"/>`;
      if (n === 5) s += `<path d="M26 150 L22 152 L25 156 M20 168 L16 170 L19 174" fill="none" stroke="#ef4444" stroke-width="1.2"/>`;
      // guard and grip
      const guard = n >= 3 ? t.trim : n === 1 ? "#5b3a1e" : "#334155";
      s += `<path d="M29 116 L45 122 L43 126 L27 120 Z" fill="${guard}" ${ink(1.1)}/>`;
      if (n >= 4) s += `<circle cx="36" cy="121" r="2" fill="${t.gem}" stroke="${t.accent}"/>`;
      s += `<path d="M37 106 L42 108 L38 119 L33 117 Z" fill="#1c1917" ${ink(1)}/><path d="M36 109 L40 110 M35 113 L39 114" stroke="#57534e" stroke-width="1"/>`;
      return s;
    },
    shield(c, t, n) {
      const m = c.metal(t, "hshield", "d");
      const [x, y] = [90, 94];
      if (n === 1) return `<circle cx="${x}" cy="${y}" r="13" fill="${m}" ${ink()}/><circle cx="${x}" cy="${y}" r="13" fill="none" stroke="#9ca3af" stroke-width="2"/><circle cx="${x}" cy="${y}" r="3.2" fill="#9ca3af" ${ink(1)}/>`;
      let s = `<path d="M${x - 12} ${y - 14} L${x + 12} ${y - 14} L${x + 11} ${y + 4} Q${x + 7} ${y + 15} ${x} ${y + 20} Q${x - 7} ${y + 15} ${x - 11} ${y + 4} Z" fill="${n === 4 ? c.grad("hicesh", [[0, "#fff"], [1, "#0369a1"]], "d") : m}" ${ink()}/>`;
      if (n >= 3) s += `<path d="M${x} ${y - 12} L${x} ${y + 16} M${x - 9} ${y - 2} L${x + 9} ${y - 2}" stroke="${t.trim}" stroke-width="2.4"/>`;
      if (n === 5) s += `<ellipse cx="${x}" cy="${y}" rx="5" ry="3.6" fill="#120306"/><ellipse cx="${x}" cy="${y}" rx="1.8" ry="3" fill="${t.glow}"/>`;
      return s;
    },
    ring(c, t, n) {
      const [x, y] = POSE.armR[2];
      return `<circle cx="${x}" cy="${y + 2}" r="2.6" fill="none" stroke="${n >= 3 ? "#facc15" : "#cbd5e1"}" stroke-width="1.5"/><circle cx="${x}" cy="${y - 0.5}" r="1.5" fill="${t.gem}"/>`;
    },
  };

  function heroSvg(look, worn, style = {}) {
    worn = worn || {};
    style = style || {};
    const c = canvas("0 0 120 200", "hero-sprite", "Your adventurer");
    const skin = look.skin || "#e0ac87";
    const skinShade = darker(skin, 0.16);
    const hair = look.hair || "#2b1b17";
    const coat = darker(look.shirt || "#475569", 0.35);
    const coatShade = darker(coat, 0.35);
    const inner = look.shirt || "#475569";
    const pants = darker(look.pants || "#334155", 0.2);
    const eye = look.eyes || "#e11d48";
    const hairs = animeHair(look.style || 0, hair);
    let s = `<ellipse cx="62" cy="194" rx="34" ry="5" fill="#000" opacity="0.3"/>`;

    // Cosmetic cape, else the long coat's tails, behind everything
    const cape = CAPES[style.cape];
    const tail = cape ? cape[0] : coat;
    s += `<path d="M48 60 Q62 54 76 60 Q90 110 98 176 Q86 170 80 186 Q74 168 66 160 Q58 170 52 188 Q48 168 40 180 Q34 120 48 60 Z" fill="${tail}" ${ink()}/>`;
    s += `<path d="M76 60 Q90 110 98 176 Q86 170 80 186 Q78 140 72 100 Z" fill="${cape ? cape[1] : coatShade}"/>`;
    // The head (hair, face, helmet, hats) is drawn a little bigger, anime proportions
    const head = (inner) => `<g transform="translate(62.5 46) scale(1.2) translate(-62.5 -46)">${inner}</g>`;
    s += head(hairs.back);

    // Legs and boots
    s += `<path d="${limb(POSE.legL, [12, 10, 9])}" fill="${pants}" ${ink()}/><path d="${limb(POSE.legR, [12, 10, 9])}" fill="${pants}" ${ink()}/>`;
    s += `<path d="${limb(POSE.legR, [5, 4, 3])}" fill="${darker(pants, 0.3)}" opacity="0.7"/>`;
    [[45, 176, -1], [79, 176, 1]].forEach(([x, y, d]) => {
      s += `<path d="M${x - 5.5} ${y - 6} L${x + 5.5} ${y - 6} L${x + 5.5} ${y + 10} L${x + 5.5 + d * 8} ${y + 14} L${x - 5.5 + (d < 0 ? -8 : 0)} ${y + 14} L${x - 5.5} ${y + 10} Z" fill="#1c1917" ${ink()}/>`;
    });

    // Torso: inner shirt, then the open coat over it
    s += `<path d="M50 58 Q62 54 74 58 L72 98 Q62 102 52 98 Z" fill="${inner}" ${ink()}/>`;
    s += `<path d="M66 58 L74 58 L72 98 L66 100 Z" fill="${darker(inner, 0.25)}"/>`;
    s += `<path d="M46 58 Q52 56 58 58 L56 100 L48 102 Q44 80 46 58 Z M66 58 Q72 56 78 58 Q80 80 76 102 L68 100 Z" fill="${coat}" ${ink()}/>`;
    s += `<path d="M66 58 Q72 56 78 58 Q80 80 76 102 L72 100 Q74 78 70 60 Z" fill="${coatShade}"/>`;
    s += `<path d="M50 94 L74 94 L74 100 L50 100 Z" fill="#111" ${ink(1)}/><rect x="59" y="94" width="6" height="6" fill="#d4a017" ${ink(0.8)}/>`;
    // Arms in the coat's sleeves, bare hands
    s += `<path d="${limb(POSE.armL, [11, 10, 8])}" fill="${coat}" ${ink()}/><path d="${limb(POSE.armR, [11, 10, 8])}" fill="${coat}" ${ink()}/>`;
    s += `<path d="${limb(POSE.armR, [5, 4, 3])}" fill="${coatShade}" opacity="0.8"/>`;
    s += `<circle cx="${POSE.armL[2][0]}" cy="${POSE.armL[2][1] + 3}" r="5" fill="${skin}" ${ink(1.2)}/><circle cx="${POSE.armR[2][0]}" cy="${POSE.armR[2][1] + 3}" r="5" fill="${skin}" ${ink(1.2)}/>`;

    // Neck and head: a pointed face, sharp eyes
    s += `<path d="M58 42 L66 42 L66 56 Q62 59 58 56 Z" fill="${skinShade}" ${ink(1.2)}/>`;
    let face = `<path d="M51 24 Q51 12 62.5 11 Q74 12 74 25 Q74 36 67 45 Q62.5 49 58 45 Q51 36 51 24 Z" fill="${skin}" ${ink()}/>`;
    face += `<path d="M68 26 Q74 30 72 36 Q70 42 66 45 Q70 36 68 26 Z" fill="${skinShade}"/>`;
    face += `<path d="M51 26 Q48 28 49 32 Q50 35 52 34 Z" fill="${skin}" ${ink(1)}/>`;
    if (!(worn.helmet && tierNum(worn.helmet) === 5)) {
      // sharp anime eyes with a glowing iris
      face += `<path d="M53 29 L60 28 L60.5 32 Q56 33.5 53.5 31.5 Z" fill="#fff" ${ink(1)}/><path d="M65 28 L72 29 L71.5 31.5 Q69 33.5 65 32 Z" fill="#fff" ${ink(1)}/>`;
      face += `<ellipse cx="57.6" cy="30.4" rx="1.9" ry="2.1" fill="${eye}"/><ellipse cx="67.6" cy="30.4" rx="1.9" ry="2.1" fill="${eye}"/>`;
      face += `<circle cx="58.2" cy="29.7" r="0.6" fill="#fff"/><circle cx="68.2" cy="29.7" r="0.6" fill="#fff"/>`;
      face += `<path d="M52 27 L60 25.6 M65 25.6 L73 27" stroke="${darker(hair, 0.3)}" stroke-width="1.8" stroke-linecap="round"/>`;
    }
    face += `<path d="M62.5 33 L61.5 37 L62.8 37.4" fill="none" stroke="${darker(skin, 0.35)}" stroke-width="0.9"/>`;
    face += `<path d="M59.5 41 Q62.5 42.2 65.5 40.8" fill="none" stroke="#5c1f1f" stroke-width="1.2" stroke-linecap="round"/>`;
    face += hairs.front;
    if (worn.helmet) face += HERO_GEAR.helmet(c, tierOf(worn.helmet), tierNum(worn.helmet));

    // Gear, in each item's tier material
    ["legs", "shoes", "chest", "gloves", "shield", "weapon", "ring"].forEach((slot) => {
      if (worn[slot]) s += HERO_GEAR[slot](c, tierOf(worn[slot]), tierNum(worn[slot]));
    });
    s += head(face);
    if (!worn.weapon) s += `<path d="M36 112 L40 114" stroke="${INK}" stroke-width="1"/>`;

    // Cape clasp and hats (cosmetics)
    if (cape) s += `<circle cx="51" cy="60" r="2.6" fill="#facc15" ${ink(1)}/><circle cx="73" cy="60" r="2.6" fill="#facc15" ${ink(1)}/>`;
    const hats = {
      "hat-crown": `<path d="M50 14 L49 0 L56 8 L62.5 -2 L69 8 L76 0 L75 14 Z" fill="${c.grad("crown", [[0, "#fef3c7"], [1, "#ca8a04"]])}" ${ink()}/><circle cx="62.5" cy="9" r="2" fill="#3b82f6"/>`,
      "hat-wizard": `<path d="M44 18 L82 18 L74 12 Q70 -6 58 -18 Q62 2 52 12 Z" fill="${c.grad("wiz", [[0, "#8b5cf6"], [1, "#4c1d95"]])}" ${ink()}/><path d="M43 18 Q62 23 83 18" fill="none" stroke="#facc15" stroke-width="2.2"/>`,
      "hat-horns": `<path d="M52 18 Q42 12 42 -2 Q48 10 56 13 Z M73 18 Q83 12 83 -2 Q77 10 69 13 Z" fill="${c.grad("devil", [[0, "#f87171"], [1, "#7f1d1d"]])}" ${ink()}/>`,
      "hat-halo": `<ellipse cx="62.5" cy="-2" rx="15" ry="4" fill="none" stroke="#fde68a" stroke-width="3"/>`,
    };
    if (hats[style.hat]) s += head(hats[style.hat]);

    const root = c.finish(s);
    root.setAttribute("viewBox", style.hat === "hat-wizard" ? "0 -30 124 230" : "0 -10 124 210");
    const aura = auraOf(worn);
    if (aura) root.classList.add(`aura-${aura}`);
    return root;
  }

  // ---------- Item icons (64 x 64) ----------
  // The same pieces as on the adventurer, framed on their own

  // The square of the 120 x 200 frame each piece sits in
  const ICON_BOX = {
    helmet: "24 0 72 72",
    chest: "20 46 80 80",
    legs: "31 102 58 58",
    shoes: "37 150 46 46",
    gloves: "10 94 42 42",
    weapon: "-22 30 104 104",
    shield: "58 78 72 72",
  };

  function gearIcon(item) {
    const n = tierNum(item);
    const t = tierOf(item);
    const slot = PIECES[item.slot] ? item.slot : "ring";
    if (slot === "ring") {
      const c = canvas("0 0 64 64", `gear-art tier-${n}`, `${t.name} ring`);
      return c.finish(
        `<g transform="translate(32 34)"><circle r="15" fill="none" stroke="${c.grad("band", [[0, n >= 3 ? "#fef08a" : "#f1f5f9"], [1, n >= 3 ? "#a16207" : "#64748b"]])}" stroke-width="7"/>` +
          `<circle r="18.5" fill="none" stroke="${INK}" stroke-width="1"/><circle r="11.5" fill="none" stroke="${INK}" stroke-width="1"/>` +
          `<path d="M-8 -20 L0 -29 L8 -20 L0 -12 Z" fill="${c.grad("gem", [[0, "#ffffff"], [0.4, t.gem], [1, darker(t.accent, 0.3)]])}" ${stroke(1.2)}/>` +
          `${shine("M-12 -6 Q-12 -12 -6 -14", 0.6)}</g>`
      );
    }
    const c = canvas(ICON_BOX[slot], `gear-art tier-${n}`, `${t.name} ${slot}`);
    const piece = PIECES[slot](c, t, n);
    return c.finish(slot === "weapon" ? `<g transform="rotate(42 30 82)">${piece}</g>` : piece);
  }

  // ---------- Monsters (drawn on 160 x 160 with a margin, facing left toward the adventurer) ----------

  const MONSTERS = {
    wolf(c) {
      const fur = c.grad("fur", [[0, "#9ca3af"], [0.6, "#4b5563"], [1, "#1f2937"]]);
      return `<path d="M128 70 Q150 60 152 40 Q140 58 124 62 Z" fill="#374151" ${stroke()}/>
        <path d="M44 88 Q48 62 76 58 L120 60 Q140 66 136 92 L132 128 L120 128 L118 104 L92 104 L86 130 L74 130 L72 104 Q58 104 52 98 Z" fill="${fur}" ${stroke()}/>
        <path d="M76 102 L70 136 L80 136 L86 104 M118 102 L126 136 L136 136 L128 98" fill="#374151" ${stroke()}/>
        <path d="M52 92 Q30 92 16 82 L14 72 Q22 66 30 66 L44 52 L50 40 L58 54 L66 46 L70 64 Q66 84 52 92 Z" fill="${fur}" ${stroke()}/>
        <path d="M14 72 L30 74 L16 82 Z" fill="#f8fafc" ${stroke(1)}/><path d="M18 74 L20 78 M23 74 L24 78 M27 75 L27 79" stroke="${INK}" stroke-width="0.8"/>
        <circle cx="13" cy="72" r="2.6" fill="${INK}"/>
        <path d="M34 66 L44 64 L42 70 Z" fill="#facc15" ${stroke(1)}/><circle cx="41" cy="67" r="1.2" fill="${INK}"/>
        <path d="M58 70 Q76 64 96 66 M86 76 Q100 72 114 74" fill="none" stroke="#d1d5db" stroke-width="1.6" opacity="0.6"/>
        <path d="M60 60 Q70 54 82 58" fill="none" stroke="#fff" stroke-width="1.6" opacity="0.35"/>`;
    },
    skeleton(c) {
      const bone = c.grad("bone", [[0, "#fafaf9"], [1, "#a8a29e"]], "h");
      return `<path d="M70 70 L98 70 L96 108 L72 108 Z" fill="${c.grad("rib", [[0, "#57534e"], [1, "#1c1917"]])}" ${stroke()}/>
        <path d="M74 76 Q84 72 94 76 M74 84 Q84 80 94 84 M74 92 Q84 88 94 92 M74 100 Q84 96 94 100" fill="none" stroke="${bone}" stroke-width="3.2"/>
        <path d="M84 70 L84 108" stroke="${bone}" stroke-width="3"/>
        <path d="M74 108 L72 146 L80 146 L84 112 L88 146 L96 146 L94 108" fill="none" stroke="${bone}" stroke-width="5" stroke-linecap="round"/>
        <path d="M70 76 L50 98 L40 92 M98 76 L114 100" fill="none" stroke="${bone}" stroke-width="5" stroke-linecap="round"/>
        <path d="M30 40 L44 96 L50 94 L36 38 Z" fill="${c.grad("rust", [[0, "#d6d3d1"], [0.5, "#78716c"], [1, "#92400e"]], "h")}" ${stroke()}/><path d="M36 92 L54 86 L56 92 L38 98 Z" fill="#78350f" ${stroke(1)}/>
        <path d="M104 84 L134 84 L132 112 Q126 126 118 130 Q110 126 106 112 Z" fill="${c.grad("sh", [[0, "#78716c"], [1, "#292524"]])}" ${stroke()}/><path d="M118 88 L118 126 M108 104 L130 104" stroke="#b45309" stroke-width="2.4"/>
        <path d="M70 46 Q70 24 86 24 Q102 24 102 46 Q102 58 94 62 L94 68 L78 68 L78 62 Q70 58 70 46 Z" fill="${bone}" ${stroke()}/>
        <ellipse cx="80" cy="46" rx="5" ry="5.6" fill="${INK}"/><ellipse cx="94" cy="46" rx="4.6" ry="5.6" fill="${INK}"/>
        <circle cx="80" cy="46" r="2" fill="#22d3ee"/><circle cx="94" cy="46" r="2" fill="#22d3ee"/>
        <path d="M86 52 L84 57 L88 57 Z" fill="${INK}"/><path d="M80 62 L80 66 M84 62 L84 67 M88 62 L88 67 M92 62 L92 66" stroke="${INK}" stroke-width="1.2"/>
        <path d="M68 34 Q86 14 104 34 L104 28 Q86 8 68 28 Z" fill="${c.grad("helm", [[0, "#a8a29e"], [1, "#44403c"]])}" ${stroke()}/>`;
    },
    goblin(c) {
      const skin = c.grad("gskin", [[0, "#a3e635"], [1, "#3f6212"]], "h");
      return `<path d="M64 86 Q66 72 80 72 L100 72 Q112 74 112 90 L110 118 L66 118 Z" fill="${c.grad("tunic", [[0, "#92400e"], [1, "#451a03"]])}" ${stroke()}/>
        <path d="M66 118 L70 146 L82 146 L84 120 M92 120 L96 146 L108 146 L108 118" fill="${skin}" ${stroke()}/>
        <path d="M66 82 L46 100 L40 96 M110 82 L122 102" fill="none" stroke="#65a30d" stroke-width="8" stroke-linecap="round"/>
        <path d="M44 98 L20 72 L24 68 L48 94 Z" fill="${c.grad("dag", [[0, "#f1f5f9"], [1, "#64748b"]], "h")}" ${stroke()}/><path d="M42 92 L50 100" stroke="#78350f" stroke-width="5"/>
        <path d="M68 50 Q68 30 88 30 Q108 30 108 50 Q108 66 88 70 Q68 66 68 50 Z" fill="${skin}" ${stroke()}/>
        <path d="M70 46 L40 30 L56 50 Z M106 46 L132 28 L114 52 Z" fill="${skin}" ${stroke()}/>
        <path d="M74 44 L84 48 L74 50 Z M102 44 L92 48 L102 50 Z" fill="#ef4444" ${stroke(1)}/>
        <path d="M84 54 Q80 60 86 60" fill="none" stroke="#365314" stroke-width="1.6"/>
        <path d="M76 62 Q88 70 100 62 L98 66 Q88 72 78 66 Z" fill="${INK}"/><path d="M80 63 L82 67 L84 64 M94 64 L96 67 L98 63" fill="#fef9c3"/>
        <path d="M74 34 Q88 26 102 34" fill="none" stroke="#fff" stroke-width="1.6" opacity="0.35"/>`;
    },
    spider(c) {
      const shell = c.grad("shell", [[0, "#6d28d9"], [0.5, "#2e1065"], [1, "#0f0a1e"]]);
      const legs = [[64, 84, 40, 60, 20, 98], [62, 92, 34, 86, 14, 120], [66, 100, 40, 112, 26, 140], [72, 106, 58, 128, 50, 150], [98, 84, 120, 58, 140, 96], [100, 92, 128, 84, 148, 118], [96, 100, 124, 110, 138, 140], [90, 106, 104, 128, 112, 150]];
      return `${legs.map(([x1, y1, x2, y2, x3, y3]) => `<path d="M${x1} ${y1} Q${x2} ${y2 - 6} ${x2} ${y2} L${x3} ${y3}" fill="none" stroke="#1e1b4b" stroke-width="5" stroke-linecap="round"/><path d="M${x1} ${y1} Q${x2} ${y2 - 6} ${x2} ${y2} L${x3} ${y3}" fill="none" stroke="#7c3aed" stroke-width="1.4" opacity="0.6"/>`).join("")}
        <ellipse cx="112" cy="76" rx="34" ry="28" fill="${shell}" ${stroke()}/>
        <path d="M100 62 L112 70 L124 62 L118 82 L106 82 Z" fill="#dc2626" opacity="0.85"/>
        <ellipse cx="74" cy="92" rx="20" ry="16" fill="${shell}" ${stroke()}/>
        <circle cx="62" cy="86" r="3" fill="#ef4444"/><circle cx="70" cy="84" r="2.4" fill="#ef4444"/><circle cx="64" cy="93" r="2" fill="#ef4444"/><circle cx="72" cy="91" r="2" fill="#ef4444"/>
        <path d="M58 100 Q54 108 58 112 M66 102 Q66 110 70 112" fill="none" stroke="#f1f5f9" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M96 58 Q112 50 128 58" fill="none" stroke="#c4b5fd" stroke-width="1.8" opacity="0.5"/>`;
    },
    witch(c) {
      const skin = c.grad("wskin", [[0, "#86efac"], [1, "#166534"]], "h");
      return `<path d="M40 30 L36 150" stroke="#5b3a1e" stroke-width="5" stroke-linecap="round"/><circle cx="40" cy="26" r="9" fill="${c.radial("orb", [[0, "#ecfccb"], [0.5, "#84cc16"], [1, "#365314"]])}" ${stroke()}/>
        <path d="M60 80 Q66 66 84 66 Q104 66 110 84 L124 150 L52 150 Z" fill="${c.grad("robe", [[0, "#3b0764"], [1, "#0f0a1e"]])}" ${stroke()}/>
        <path d="M64 92 L42 74 M108 90 L120 110" fill="none" stroke="#14532d" stroke-width="7" stroke-linecap="round"/>
        <path d="M66 50 Q66 34 84 34 Q102 34 102 52 Q100 68 84 70 Q68 68 66 50 Z" fill="${skin}" ${stroke()}/>
        <path d="M66 56 Q56 58 58 50 Q62 48 68 50 Z" fill="${skin}" ${stroke(1)}/>
        <path d="M74 48 L82 50 M90 50 L98 48" stroke="${INK}" stroke-width="1.6"/><circle cx="78" cy="52" r="1.8" fill="#fde047"/><circle cx="94" cy="52" r="1.8" fill="#fde047"/>
        <path d="M78 62 Q86 58 94 62" fill="none" stroke="${INK}" stroke-width="1.6"/>
        <path d="M58 38 L112 38 L100 32 Q96 10 104 -4 Q80 4 72 32 Z" fill="${c.grad("hat", [[0, "#4c1d95"], [1, "#1e1b4b"]])}" ${stroke()}/><path d="M60 37 Q84 42 110 37" stroke="#84cc16" stroke-width="2.6" fill="none"/>
        <path d="M66 38 Q60 60 64 76 M102 38 Q110 58 106 76" fill="none" stroke="#9ca3af" stroke-width="3" opacity="0.8"/>`;
    },
    scorpion(c) {
      const shell = c.grad("sand", [[0, "#fde68a"], [0.5, "#d97706"], [1, "#78350f"]]);
      return `<path d="M120 100 Q150 90 150 56 Q148 30 126 26 Q110 26 106 40" fill="none" stroke="#92400e" stroke-width="13" stroke-linecap="round"/>
        <path d="M120 100 Q150 90 150 56 Q148 30 126 26 Q110 26 106 40" fill="none" stroke="#f59e0b" stroke-width="8" stroke-linecap="round"/>
        <path d="M106 40 L94 46 L104 30 Z" fill="#1c1917" ${stroke()}/><circle cx="102" cy="40" r="2.4" fill="#a3e635"/>
        ${[96, 106, 116, 126].map((x, i) => `<path d="M${x} 112 L${x - 6 + i * 4} 136" stroke="#78350f" stroke-width="4" stroke-linecap="round"/>`).join("")}
        <ellipse cx="96" cy="104" rx="34" ry="16" fill="${shell}" ${stroke()}/>
        <path d="M74 98 Q96 92 120 98 M70 106 Q96 100 124 106" fill="none" stroke="#78350f" stroke-width="1.6"/>
        <path d="M66 100 Q50 92 38 98" fill="none" stroke="#92400e" stroke-width="8" stroke-linecap="round"/>
        <path d="M66 108 Q48 118 38 116" fill="none" stroke="#92400e" stroke-width="8" stroke-linecap="round"/>
        <path d="M40 90 Q20 82 18 96 Q26 92 30 100 Q20 104 28 110 Q38 104 40 98 Z" fill="${shell}" ${stroke()}/>
        <path d="M40 110 Q20 112 22 126 Q28 118 34 124 Q30 132 40 128 Q44 120 40 116 Z" fill="${shell}" ${stroke()}/>
        <ellipse cx="66" cy="102" rx="12" ry="10" fill="${shell}" ${stroke()}/><circle cx="60" cy="98" r="2" fill="${INK}"/><circle cx="64" cy="96" r="2" fill="${INK}"/>`;
    },
    giant(c) {
      const skin = c.grad("ice", [[0, "#bae6fd"], [0.5, "#38bdf8"], [1, "#075985"]], "h");
      return `<path d="M122 30 L132 140" stroke="${c.grad("club", [[0, "#ffffff"], [1, "#0ea5e9"]], "h")}" stroke-width="13" stroke-linecap="round"/><path d="M120 22 L114 6 L126 18 L132 4 L134 22 Z" fill="#e0f2fe" ${stroke()}/>
        <path d="M50 78 Q54 58 80 56 Q106 58 112 78 L110 120 L52 120 Z" fill="${skin}" ${stroke()}/>
        <path d="M54 82 L106 82 L104 104 L56 104 Z" fill="${c.grad("plate", [[0, "#f0f9ff"], [1, "#7dd3fc"]])}" ${stroke()}/>
        <path d="M54 120 L58 150 L76 150 L78 122 M84 122 L86 150 L104 150 L108 120" fill="${skin}" ${stroke()}/>
        <path d="M52 70 L30 104 L38 110 L58 84 M110 70 L124 92" fill="none" stroke="#0284c7" stroke-width="13" stroke-linecap="round"/>
        <path d="M60 36 Q60 14 80 14 Q100 14 100 36 Q100 54 80 58 Q60 54 60 36 Z" fill="${skin}" ${stroke()}/>
        <path d="M60 40 Q64 76 80 82 Q96 76 100 40 Q92 56 80 56 Q68 56 60 40 Z" fill="#f0f9ff" ${stroke()}/>
        <path d="M68 32 L76 34 M84 34 L92 32" stroke="${INK}" stroke-width="2"/><circle cx="72" cy="38" r="2.2" fill="#fef9c3"/><circle cx="88" cy="38" r="2.2" fill="#fef9c3"/>
        <path d="M64 18 L60 2 L70 14 L80 0 L90 14 L100 2 L96 18" fill="#e0f2fe" ${stroke()}/>`;
    },
    golem(c) {
      const rock = c.grad("rock", [[0, "#57534e"], [0.6, "#292524"], [1, "#0c0a09"]]);
      const lava = c.grad("lava", [[0, "#fde047"], [0.5, "#f97316"], [1, "#b91c1c"]]);
      return `<path d="M44 74 Q46 52 78 48 Q112 50 116 76 L118 116 Q80 124 42 116 Z" fill="${rock}" ${stroke()}/>
        <path d="M60 60 L70 76 L64 92 L76 108 M94 58 L88 76 L100 92 L92 110 M78 80 L84 92" fill="none" stroke="${lava}" stroke-width="3.4" stroke-linecap="round"/>
        <path d="M46 116 L44 150 L70 150 L72 120 M88 120 L90 150 L116 150 L114 116" fill="${rock}" ${stroke()}/>
        <path d="M54 130 L58 142 M102 128 L98 142" stroke="${lava}" stroke-width="2.6"/>
        <path d="M44 66 Q22 80 20 112 L36 116 Q38 94 54 84 Z M116 66 Q138 80 140 112 L124 116 Q122 94 106 84 Z" fill="${rock}" ${stroke()}/>
        <circle cx="26" cy="118" r="11" fill="${rock}" ${stroke()}/><circle cx="134" cy="118" r="11" fill="${rock}" ${stroke()}/>
        <path d="M60 30 Q60 12 80 12 Q100 12 100 30 Q100 46 80 48 Q60 46 60 30 Z" fill="${rock}" ${stroke()}/>
        <path d="M66 28 L76 32 L66 34 Z M94 28 L84 32 L94 34 Z" fill="${lava}"/><path d="M70 40 Q80 44 90 40" stroke="${lava}" stroke-width="2.4" fill="none"/>
        <circle cx="80" cy="84" r="9" fill="${c.radial("core", [[0, "#fef9c3"], [0.5, "#f97316"], [1, "#7f1d1d"]])}" ${stroke()}/>`;
    },
    demon(c) {
      const skin = c.grad("dskin", [[0, "#f87171"], [0.5, "#b91c1c"], [1, "#450a0a"]], "h");
      const wing = c.grad("wing", [[0, "#450a0a"], [1, "#0c0a09"]]);
      return `<path d="M64 70 Q30 40 8 46 Q20 56 14 68 Q30 64 30 78 Q44 72 56 86 Z M100 70 Q134 36 156 40 Q144 52 150 64 Q134 60 134 74 Q120 70 108 86 Z" fill="${wing}" ${stroke()}/>
        <path d="M58 82 Q60 64 82 62 Q104 64 106 82 L104 120 L60 120 Z" fill="${skin}" ${stroke()}/>
        <path d="M66 90 Q82 96 98 90 M68 102 Q82 108 96 102" fill="none" stroke="#450a0a" stroke-width="1.6"/>
        <path d="M60 120 L56 150 L74 150 L78 122 M86 122 L90 150 L108 150 L104 120" fill="${skin}" ${stroke()}/>
        <path d="M60 78 L36 106 L28 102 M104 78 L124 104" fill="none" stroke="#991b1b" stroke-width="10" stroke-linecap="round"/>
        <path d="M28 102 L18 96 M28 102 L20 108 M28 102 L24 112" stroke="#fef3c7" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M66 42 Q66 24 82 24 Q98 24 98 42 Q98 58 82 62 Q66 58 66 42 Z" fill="${skin}" ${stroke()}/>
        <path d="M68 32 Q54 22 54 4 Q62 18 74 24 Z M96 32 Q110 22 110 4 Q102 18 90 24 Z" fill="${c.grad("horn", [[0, "#fef3c7"], [1, "#57534e"]])}" ${stroke()}/>
        <path d="M72 40 L80 44 L72 46 Z M92 40 L84 44 L92 46 Z" fill="#fde047"/>
        <path d="M74 52 Q82 58 90 52" fill="none" stroke="${INK}" stroke-width="1.8"/><path d="M76 53 L77 57 M88 53 L87 57" stroke="#fff" stroke-width="1.4"/>`;
    },
    dragon(c) {
      const scale = c.grad("scale", [[0, "#4ade80"], [0.4, "#166534"], [1, "#052e16"]]);
      const wing = c.grad("dwing", [[0, "#14532d"], [1, "#022c22"]]);
      return `<path d="M96 70 Q100 20 150 8 Q138 26 146 36 Q128 34 132 50 Q116 46 118 62 Q108 60 104 74 Z" fill="${wing}" ${stroke()}/>
        <path d="M100 120 Q140 128 154 150 Q130 140 112 140" fill="${scale}" ${stroke()}/>
        <path d="M70 96 Q74 70 100 70 Q126 74 126 104 Q124 132 98 136 Q72 132 70 96 Z" fill="${scale}" ${stroke()}/>
        <path d="M80 100 Q98 108 116 100 M82 112 Q98 120 114 112 M86 124 Q98 130 110 124" fill="none" stroke="#bbf7d0" stroke-width="1.6" opacity="0.6"/>
        <path d="M84 132 L80 152 L96 152 L96 136 M108 134 L112 152 L126 150 L118 128" fill="${scale}" ${stroke()}/>
        <path d="M78 84 Q60 72 52 54 Q50 40 38 36 L18 38 Q8 42 10 52 L24 60 Q34 58 40 62 Q48 80 70 96 Z" fill="${scale}" ${stroke()}/>
        <path d="M10 52 L4 50 L12 46 M24 60 L18 66 L28 62" fill="#fef3c7" ${stroke(1)}/>
        <path d="M38 36 L44 20 L46 36 M46 38 L56 26 L54 42" fill="#fef3c7" ${stroke(1)}/>
        <path d="M24 44 L32 42 L28 48 Z" fill="#facc15"/><circle cx="29" cy="45" r="1.2" fill="${INK}"/>
        <path d="M2 54 Q-6 60 0 66 Q4 58 10 58" fill="${c.radial("fire", [[0, "#fef9c3"], [0.5, "#f97316"], [1, "#b91c1c"]])}" opacity="0.9"/>
        <path d="M60 66 Q48 46 50 36" fill="none" stroke="#bbf7d0" stroke-width="1.6" opacity="0.5"/>`;
    },
  };

  function monsterSvg(art, { boss = false, label = "" } = {}) {
    const draw = MONSTERS[art];
    if (!draw) return null;
    const c = canvas("-10 -12 180 176", `monster-art monster-${art}${boss ? " boss" : ""}`, label);
    return c.finish(`<ellipse cx="84" cy="152" rx="56" ry="7" fill="#000" opacity="0.3"/>${draw(c)}`);
  }

  // Most of the gear (5 of 8 slots) in tier 5 / tier 4 or better makes the adventurer glow
  function auraOf(worn) {
    const items = Object.values(worn || {});
    if (items.filter((i) => (i.tier || 1) >= 5).length >= 5) return "abyss";
    if (items.filter((i) => (i.tier || 1) >= 4).length >= 5) return "frost";
    return "";
  }

  return { heroSvg, gearIcon, monsterSvg, monsters: Object.keys(MONSTERS), auraOf, tiers: TIERS, mix, darker, lighter };
})();
