// Pixel art for the adventure: the adventurer and their gear, drawn as SVG squares.
// Gear looks like its tier's material (Wooden, Iron, Bogsteel, Frost, Abyssal), and higher tiers get
// more detail: trims, horns, gems, bigger blades and a glow. Used by the Profile and Shop pages.
//   SinnersArt.heroSvg(look, worn, style)   the character; worn = { slot: item }, style = cosmetics { hat, cape }
//   SinnersArt.gearIcon(item)        a 16 x 16 icon of one item ({ slot, tier })
//   SinnersArt.auraOf(worn)          "frost" / "abyss" when most of the gear is tier 4 / 5

const SinnersArt = (() => {
  const NS = "http://www.w3.org/2000/svg";
  const TIERS = [
    null,
    { name: "Wooden", main: "#a16207", dark: "#5c3a12", light: "#d6a85c", accent: "#78350f", gem: null },
    { name: "Iron", main: "#9ca3af", dark: "#4b5563", light: "#f3f4f6", accent: "#6b7280", gem: "#cbd5e1" },
    { name: "Bogsteel", main: "#0f766e", dark: "#083d39", light: "#5eead4", accent: "#eab308", gem: "#facc15" },
    { name: "Frost", main: "#38bdf8", dark: "#075985", light: "#e0f2fe", accent: "#a5f3fc", gem: "#f0f9ff", glow: "#7dd3fc" },
    { name: "Abyssal", main: "#991b1b", dark: "#2a0808", light: "#f87171", accent: "#f59e0b", gem: "#fde047", glow: "#ef4444" },
  ];
  const GRIP = "#4a2c17";
  const tierOf = (item) => TIERS[Math.min(5, Math.max(1, (item && item.tier) || 1))];

  function svgOf(viewBox, rects, className, label) {
    const root = document.createElementNS(NS, "svg");
    root.setAttribute("viewBox", viewBox);
    root.setAttribute("shape-rendering", "crispEdges");
    root.setAttribute("class", className);
    root.setAttribute("role", "img");
    if (label) root.setAttribute("aria-label", label);
    rects.forEach(([x, y, w, h, fill]) => {
      if (!fill) return;
      const r = document.createElementNS(NS, "rect");
      r.setAttribute("x", x);
      r.setAttribute("y", y);
      r.setAttribute("width", w);
      r.setAttribute("height", h);
      r.setAttribute("fill", fill);
      root.append(r);
    });
    return root;
  }

  // ---------- Item icons (16 x 16) ----------

  const ICONS = {
    weapon(t, n, put) {
      if (n === 1) {
        // a wooden club
        put(6, 1, 4, 9, t.main);
        put(6, 1, 1, 9, t.light);
        put(9, 3, 1, 2, t.dark);
        put(7, 6, 1, 1, t.dark);
        put(7, 10, 2, 5, GRIP);
        return;
      }
      const wide = n >= 3;
      put(wide ? 6 : 7, 1, wide ? 4 : 2, 10, t.main);
      put(7, 1, 1, 10, t.light); // edge shine
      put(7, 0, 2, 1, t.light); // tip
      put(n >= 3 ? 3 : 4, 11, n >= 3 ? 10 : 8, 1, t.accent); // guard
      put(7, 12, 2, 3, GRIP);
      put(7, 15, 2, 1, t.accent); // pommel
      if (n >= 4) put(7, 11, 2, 1, t.gem);
      if (n >= 5) [[5, 2], [10, 4], [5, 6], [10, 8]].forEach(([x, y]) => put(x, y, 1, 2, t.glow)); // flames
    },
    shield(t, n, put) {
      put(3, 2, 10, 2, t.dark);
      put(3, 4, 10, 6, t.dark);
      put(4, 10, 8, 2, t.dark);
      put(6, 12, 4, 2, t.dark);
      put(4, 3, 8, 7, t.main);
      put(5, 10, 6, 2, t.main);
      put(7, 12, 2, 1, t.main);
      put(4, 3, 8, 1, t.light);
      if (n >= 2) put(7, 6, 2, 2, t.light); // boss
      if (n >= 3) {
        put(7, 4, 2, 7, t.accent); // cross
        put(5, 6, 6, 2, t.accent);
      }
      if (n >= 4) put(7, 6, 2, 2, t.gem);
    },
    helmet(t, n, put) {
      put(5, 3, 6, 1, t.dark);
      put(4, 4, 8, 6, t.dark);
      put(5, 4, 6, 5, t.main);
      put(6, 4, 2, 2, t.light);
      put(3, 9, 10, 2, t.main);
      put(3, 10, 10, 1, t.dark);
      put(6, 8, 4, 3, "#111"); // face opening
      if (n >= 2) put(7, 8, 2, 3, t.dark); // nose guard
      if (n >= 3) {
        put(2, 2, 1, 4, t.accent); // horns
        put(13, 2, 1, 4, t.accent);
        put(3, 5, 1, 2, t.accent);
        put(12, 5, 1, 2, t.accent);
      }
      if (n >= 4) put(7, 5, 2, 1, t.gem);
      if (n >= 5) [5, 7, 9].forEach((x) => put(x + (x > 7 ? 1 : 0), 1, 1, 2, t.accent)); // crown
    },
    chest(t, n, put) {
      put(4, 3, 8, 10, t.dark);
      put(5, 4, 6, 8, t.main);
      put(5, 4, 2, 3, t.light);
      put(7, 5, 2, 7, t.dark);
      const pad = n >= 2 ? 3 : 2;
      put(4 - pad, 3, pad, 3, t.main); // shoulder pads
      put(12, 3, pad, 3, t.main);
      put(4 - pad, 5, pad, 1, t.dark);
      put(12, 5, pad, 1, t.dark);
      put(5, 11, 6, 1, t.accent); // belt
      if (n >= 3) {
        put(4 - pad, 3, pad, 1, t.accent);
        put(12, 3, pad, 1, t.accent);
      }
      if (n >= 4) put(7, 7, 2, 2, t.gem);
    },
    legs(t, n, put) {
      put(4, 2, 8, 3, t.dark);
      put(5, 2, 6, 2, t.main);
      put(4, 5, 3, 9, t.main);
      put(9, 5, 3, 9, t.main);
      put(4, 5, 1, 9, t.light);
      put(9, 5, 1, 9, t.light);
      put(4, 13, 3, 1, t.dark);
      put(9, 13, 3, 1, t.dark);
      put(5, 2, 6, 1, t.accent);
      if (n >= 3) {
        put(4, 8, 3, 2, t.accent); // knee guards
        put(9, 8, 3, 2, t.accent);
      }
      if (n >= 4) {
        put(5, 8, 1, 1, t.gem);
        put(10, 8, 1, 1, t.gem);
      }
    },
    shoes(t, n, put) {
      put(4, 3, 5, 8, t.main);
      put(4, 3, 1, 8, t.light);
      put(4, 10, 9, 3, t.main);
      put(4, 13, 9, 1, t.dark);
      put(4, 3, 5, 1, t.dark);
      if (n >= 3) put(4, 9, 5, 1, t.accent);
      if (n >= 4) put(11, 11, 1, 1, t.gem);
      if (n >= 5) put(3, 5, 1, 4, t.glow); // little wing of fire
    },
    gloves(t, n, put) {
      put(4, 4, 6, 8, t.main);
      put(4, 4, 6, 1, t.dark);
      put(5, 2, 1, 2, t.main); // fingers
      put(7, 2, 1, 2, t.main);
      put(9, 3, 1, 1, t.main);
      put(10, 6, 2, 3, t.main); // thumb
      put(4, 5, 1, 6, t.light);
      put(4, 12, 6, 2, t.accent); // cuff
      if (n >= 3) [5, 7, 9].forEach((x) => put(x, 4, 1, 1, t.accent)); // knuckle spikes
      if (n >= 4) put(6, 8, 2, 2, t.gem);
    },
    ring(t, n, put) {
      put(5, 7, 6, 1, t.main);
      put(4, 8, 1, 4, t.main);
      put(11, 8, 1, 4, t.main);
      put(5, 12, 6, 1, t.main);
      put(5, 8, 1, 1, t.light);
      put(5, 11, 6, 1, t.dark);
      if (n >= 2) {
        put(6, 4, 4, 3, t.accent); // setting
        put(7, 4, 2, 2, n >= 3 ? t.gem : t.light);
      }
      if (n >= 4) put(7, 3, 2, 1, t.light);
      if (n >= 5) {
        put(5, 3, 1, 1, t.glow);
        put(10, 3, 1, 1, t.glow);
      }
    },
  };

  function gearIcon(item) {
    const n = Math.min(5, Math.max(1, item.tier || 1));
    const t = TIERS[n];
    const rects = [];
    (ICONS[item.slot] || ICONS.ring)(t, n, (x, y, w, h, c) => rects.push([x, y, w, h, c]));
    return svgOf("0 0 16 16", rects, `gear-art tier-${n}`, `${t.name} ${item.slot}`);
  }

  // ---------- The adventurer (16 x 22) ----------

  const CAPES = { "cape-red": ["#b91c1c", "#7f1d1d"], "cape-purple": ["#7e22ce", "#4c1d95"], "cape-gold": ["#eab308", "#a16207"] };

  function heroSvg(look, worn, style = {}) {
    const px = [];
    const put = (x, y, w, h, color) => px.push([x, y, w, h, color]);
    const mat = (slot) => tierOf(worn[slot]);
    const tier = (slot) => Math.min(5, Math.max(1, (worn[slot] && worn[slot].tier) || 1));

    // Cape (cosmetic), behind everything
    const cape = CAPES[style.cape];
    if (cape) {
      put(2, 9, 12, 11, cape[1]);
      put(3, 9, 10, 10, cape[0]);
    }

    // Body
    put(5, 2, 6, 6, look.skin);
    put(6, 4, 1, 1, look.eyes);
    put(9, 4, 1, 1, look.eyes);
    put(7, 6, 2, 1, "rgba(0,0,0,0.25)");
    put(7, 8, 2, 1, look.skin);
    put(4, 9, 8, 5, look.shirt);
    put(2, 9, 2, 2, look.shirt);
    put(12, 9, 2, 2, look.shirt);
    put(2, 11, 2, 3, look.skin);
    put(12, 11, 2, 3, look.skin);
    put(2, 14, 2, 1, look.skin);
    put(12, 14, 2, 1, look.skin);
    put(4, 14, 8, 1, "#3f2d20");
    put(5, 15, 3, 4, look.pants);
    put(8, 15, 3, 4, look.pants);
    put(4, 19, 4, 1, "#2b1d14");
    put(8, 19, 4, 1, "#2b1d14");

    // Hair (hidden under a helmet)
    if (!worn.helmet) {
      const h = look.hair;
      if (look.style === 2) [5, 7, 9].forEach((x) => put(x, 0, 1, 1, h));
      if (look.style === 3) {
        put(7, 0, 2, 2, h);
        put(6, 2, 4, 1, h);
      } else {
        put(5, 1, 6, 1, h);
        put(4, 2, 8, 1, h);
        put(4, 3, 1, 1, h);
        put(11, 3, 1, 1, h);
        if (look.style === 1) {
          put(4, 3, 1, 6, h);
          put(11, 3, 1, 6, h);
        }
      }
    }

    // Gear, in each item's tier material; higher tiers add detail
    if (worn.legs) {
      const m = mat("legs");
      put(5, 15, 3, 4, m.main);
      put(8, 15, 3, 4, m.main);
      put(7, 15, 1, 4, m.dark);
      if (tier("legs") >= 3) {
        put(5, 16, 2, 1, m.accent);
        put(9, 16, 2, 1, m.accent);
      }
    }
    if (worn.chest) {
      const m = mat("chest");
      const n = tier("chest");
      put(4, 9, 8, 5, m.main);
      put(2, 9, 2, 2, m.main);
      put(12, 9, 2, 2, m.main);
      put(7, 10, 2, 3, m.dark);
      put(4, 13, 8, 1, m.accent);
      if (n >= 2) {
        put(1, 8, 3, 2, m.main); // shoulder pads
        put(12, 8, 3, 2, m.main);
        put(1, 9, 3, 1, m.dark);
        put(12, 9, 3, 1, m.dark);
      }
      if (n >= 3) {
        put(1, 8, 3, 1, m.accent);
        put(12, 8, 3, 1, m.accent);
      }
      if (n >= 4) put(7, 10, 2, 1, m.gem);
    }
    if (worn.shoes) {
      const m = mat("shoes");
      put(4, 18, 4, 2, m.main);
      put(8, 18, 4, 2, m.main);
      if (tier("shoes") >= 3) {
        put(4, 18, 4, 1, m.accent);
        put(8, 18, 4, 1, m.accent);
      }
    }
    if (worn.gloves) {
      const m = mat("gloves");
      put(2, 13, 2, 2, m.main);
      put(12, 13, 2, 2, m.main);
      if (tier("gloves") >= 3) {
        put(2, 13, 2, 1, m.accent);
        put(12, 13, 2, 1, m.accent);
      }
    }
    if (worn.helmet) {
      const m = mat("helmet");
      const n = tier("helmet");
      put(5, 0, 6, 1, m.main);
      put(4, 1, 8, 2, m.main);
      put(4, 3, 1, 3, m.main);
      put(11, 3, 1, 3, m.main);
      put(5, 1, 2, 1, m.light);
      if (n >= 2) put(7, 2, 2, 2, m.dark); // nose guard
      if (n >= 3) {
        put(3, -1, 1, 3, m.accent); // horns
        put(12, -1, 1, 3, m.accent);
      }
      if (n >= 4) put(7, 1, 2, 1, m.gem);
      if (n >= 5) [5, 7, 10].forEach((x) => put(x, -1, 1, 1, m.accent));
    }
    if (worn.ring) {
      const m = mat("ring");
      put(3, 14, 1, 1, tier("ring") >= 3 ? m.gem : m.main);
      put(2, 15, 1, 1, "rgba(255,255,255,0.8)");
    }
    if (worn.weapon) {
      const m = mat("weapon");
      const n = tier("weapon");
      if (n === 1) {
        put(14, 7, 2, 6, m.main); // club
        put(14, 7, 1, 6, m.light);
        put(14, 13, 1, 3, GRIP);
      } else {
        const top = n >= 3 ? 2 : 4;
        put(14, top, 1, 13 - top, m.main); // blade
        put(15, top + 1, 1, 12 - top, n >= 3 ? m.light : "rgba(255,255,255,0.35)");
        if (n >= 3) put(13, top + 1, 1, 11 - top, m.main);
        put(13, 13, 3, 1, m.accent); // guard
        put(14, 14, 1, 2, GRIP);
        if (n >= 4) put(14, 13, 1, 1, m.gem);
        if (n >= 5) [[16, 3], [12, 5], [16, 8]].forEach(([x, y]) => put(x, y, 1, 2, m.glow));
      }
    }
    if (worn.shield) {
      const m = mat("shield");
      const n = tier("shield");
      put(-1, 10, 4, 5, m.dark);
      put(0, 10, 3, 4, m.main);
      put(0, 14, 2, 1, m.main);
      if (n >= 2) put(1, 11, 1, 2, m.light);
      if (n >= 3) put(1, 11, 1, 2, m.accent);
      if (n >= 4) put(1, 12, 1, 1, m.gem);
    }

    // Hat (cosmetic), drawn over hair and helmet
    if (style.hat === "hat-crown") {
      put(5, 0, 6, 2, "#facc15");
      [5, 7, 8, 10].forEach((x) => put(x, -1, 1, 1, "#facc15"));
      put(7, 0, 2, 1, "#dc2626");
      put(5, 1, 6, 1, "#ca8a04");
    } else if (style.hat === "hat-wizard") {
      put(7, -2, 2, 1, "#6d28d9");
      put(6, -1, 4, 1, "#6d28d9");
      put(5, 0, 6, 1, "#7c3aed");
      put(3, 1, 10, 1, "#5b21b6");
      put(8, -1, 1, 1, "#fde047");
    } else if (style.hat === "hat-horns") {
      put(3, -1, 1, 2, "#dc2626");
      put(4, 0, 1, 2, "#dc2626");
      put(12, -1, 1, 2, "#dc2626");
      put(11, 0, 1, 2, "#dc2626");
    } else if (style.hat === "hat-halo") {
      put(6, -2, 4, 1, "#fde047");
      put(5, -1, 1, 1, "#fde047");
      put(10, -1, 1, 1, "#fde047");
      put(6, -1, 4, 1, "rgba(253, 224, 71, 0.25)");
    }

    const root = svgOf("-2 -2 20 24", px, "hero-sprite", "Your adventurer");
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

  return { heroSvg, gearIcon, auraOf, tiers: TIERS };
})();
