// Sinners pixel icons: hand-drawn pixel art that replaces the game's emojis everywhere on the site
// (bosses, monsters, places, potions, coins, medals, quests, cosmetics...). The game data still says
// "🐉" or "🪙"; this file swaps those characters for drawings as the page is built, so every page and
// message gets the art without changing how the data is sent. Chat, inputs and menus are left alone.
//   SinnersIcons.svg("🐉")           an <svg> of that emoji's art, or null if it has none
//   SinnersIcons.has("🐉")
//   SinnersIcons.decorate(element)   swap emojis in that element now (also runs by itself on the page)
// Each drawing is a list of rows; every letter is a color from its palette and "." is see-through.

const SinnersIcons = (() => {
  const NS = "http://www.w3.org/2000/svg";

  // Shared colors
  const C = {
    k: "#120a10", // outline
    w: "#ffffff",
  };

  const ART = {
    // ---------- Money, rewards, stats ----------
    coin: {
      p: { d: "#6b3d05", o: "#c58a06", y: "#facc15", l: "#fff3b0" },
      r: [
        "....dddddd....",
        "..ddyyyyyydd..",
        ".dyyllyyyyyod.",
        ".dylyyyyyyyod.",
        "dyly.yyyyy.yod",
        "dyyyyoooyyyyod",
        "dyyyoyyyyyyyod",
        "dyyyyoooyyyyod",
        "dyyyyyyyoyyyod",
        "dyyyyoooyyyyod",
        ".dyyyyyyyyyod.",
        ".doyyyyyyyood.",
        "..ddoooooodd..",
        "....dddddd....",
      ],
      fx: "shine",
      glow: "#facc15",
    },
    chest: {
      p: { k: C.k, b: "#5b2d0e", w: "#8b4513", l: "#b7652a", g: "#f5c542", y: "#fff1a8", r: "#c0262d" },
      r: [
        "................",
        "..kkkkkkkkkkkk..",
        ".kwlllllllllllk.",
        ".kwwwwwwwwwwwwk.",
        "kggggggggggggggk",
        "kbwwwwwkkwwwwwbk",
        "kgggggkyykgggggk",
        "kbwwwwkkkkwwwwbk",
        "kbwwwwwwwwwwwwbk",
        "kbllllwwwwllllbk",
        "kggggggggggggggk",
        "kbwwwwwwwwwwwwbk",
        "kbbbbbbbbbbbbbbk",
        ".kkkkkkkkkkkkkk.",
      ],
      fx: "shine",
      glow: "#f5c542",
    },
    sword: {
      p: { k: C.k, s: "#cbd5e1", l: "#f8fafc", d: "#64748b", g: "#d4a017", b: "#5b2d0e", r: "#e0123c" },
      r: [
        "............kk..",
        "...........kllk.",
        "..........klsdk.",
        ".........klsdk..",
        "........klsdk...",
        ".......klsdk....",
        "..kk..klsdk.....",
        "..kgkklsdk......",
        "...kgksdk.......",
        "....kgkk........",
        "...kbkgk........",
        "..kbk.kgk.......",
        ".kbk...kk.......",
        "krk.............",
        "kk..............",
      ],
      glow: "#cbd5e1",
    },
    swords: {
      p: { k: C.k, s: "#cbd5e1", l: "#f8fafc", d: "#64748b", g: "#d4a017", b: "#5b2d0e" },
      r: [
        "kk............kk",
        "kllk........kllk",
        ".kslk......klsk.",
        "..kdslk..klsdk..",
        "...kdslkklsdk...",
        "....kdsllsdk....",
        ".....kdssdk.....",
        "......kddk......",
        ".....kdssdk.....",
        "..kk.kdkkdk.kk..",
        "..kgkkk..kkkgk..",
        "...kgk....kgk...",
        "..kbkgk..kgkbk..",
        ".kbk.kk..kk.kbk.",
        "kbk..........kbk",
        "kk............kk",
      ],
      glow: "#e2e8f0",
    },
    shield: {
      p: { k: C.k, m: "#475569", l: "#94a3b8", r: "#b91c1c", h: "#ef4444", g: "#facc15" },
      r: [
        "..kkkkkkkkkkkk..",
        ".kllllllllllllk.",
        ".klmmmmrrmmmmlk.",
        ".klmmmmrhmmmmlk.",
        ".klmmmmrrmmmmlk.",
        ".klrrrrrrrrrrlk.",
        ".klhhhhrgrhhhlk.",
        ".klmmmmrrmmmmlk.",
        "..klmmmrrmmmlk..",
        "..klmmmrrmmmlk..",
        "...klmmrrmmlk...",
        "....klmrrmlk....",
        ".....klrrlk.....",
        "......kllk......",
        ".......kk.......",
      ],
      glow: "#94a3b8",
    },
    heart: {
      p: { k: C.k, r: "#dc2626", d: "#7f1d1d", l: "#fca5a5", w: "#fff" },
      r: [
        "..kkk....kkk..",
        ".krrrk..krrrk.",
        "krwlrrkkrrrrdk",
        "krlrrrrrrrrrdk",
        "krrrrrrrrrrrdk",
        "krrrrrrrrrrddk",
        ".krrrrrrrrrdk.",
        "..krrrrrrrdk..",
        "...krrrrrdk...",
        "....krrrdk....",
        ".....krdk.....",
        "......kk......",
      ],
      fx: "beat",
      glow: "#ef4444",
    },
    star: {
      p: { k: C.k, y: "#fde047", o: "#f59e0b", w: "#fffbea" },
      r: [
        ".......kk.......",
        "......kwyk......",
        "......kyyk......",
        ".....kwyyok.....",
        "kkkkkkyyyyokkkkk",
        "kwyyyyyyyyyyyook",
        ".kwyyyyyyyyyook.",
        "..kyyyyyyyyook..",
        "...kyyyyyyyok...",
        "...kyyyookyok...",
        "..kyyook..kyok..",
        "..kyok.....kok..",
        ".kok........kk..",
        ".kk.............",
      ],
      fx: "twinkle",
      glow: "#fde047",
    },
    flame: {
      p: { k: C.k, r: "#dc2626", o: "#f97316", y: "#facc15", w: "#fff7cc" },
      r: [
        "......k.........",
        ".....kok........",
        ".....kok...k....",
        "....korok.kok...",
        "...korrok.korok.",
        "..korrrroookrok.",
        "..korrooorrrrok.",
        ".korrooyyoorrok.",
        ".kroooyyyyoorrk.",
        ".kroooyywyyoorrk".slice(0, 16),
        ".kroyyywwyyyorrk".slice(0, 16),
        "..kroyywwwyyork.",
        "..kroyyyyyyyork.",
        "...krooyyyoork..",
        "....kkrrrrrkk...",
        "......kkkkk.....",
      ],
      fx: "flicker",
      glow: "#f97316",
    },
    trophy: {
      p: { k: C.k, y: "#facc15", o: "#ca8a04", l: "#fff3b0", b: "#5b2d0e" },
      r: [
        "..kkkkkkkkkkkk..",
        "kkkylyyyyyyyokkk",
        "kykylyyyyyyyokyk",
        "kykylyyyyyyyokyk",
        ".kkylyyyyyyyokk.",
        "...kylyyyyyyok..",
        "....kyyyyyyok...",
        ".....kyyyyok....",
        "......kyyok.....",
        ".......kyk......",
        ".......kyk......",
        ".....kkyyykk....",
        "....kbbbbbbbk...",
        "....kbbbbbbbk...",
        "....kkkkkkkkk...",
      ],
      fx: "shine",
      glow: "#facc15",
    },
    medalGold: {
      p: { k: C.k, r: "#e0123c", b: "#1d4ed8", y: "#facc15", o: "#b45309", l: "#fff3b0" },
      r: [
        "..kkk....kkk..",
        "..krrk..kbbk..",
        "...krrkkbbk...",
        "....krrbbk....",
        ".....kkkk.....",
        "....kyyyyk....",
        "...kylyyyok...",
        "..kylyyyyyok..",
        "..kyyyooyyok..",
        "..kyyyoyyyok..",
        "..kyyyoyyyok..",
        "...kyyooyok...",
        "....kooook....",
        ".....kkkk.....",
      ],
      fx: "shine",
      glow: "#facc15",
    },
    crown: {
      p: { k: C.k, y: "#facc15", o: "#b45309", l: "#fff3b0", r: "#e0123c", b: "#3b82f6", g: "#22c55e" },
      r: [
        "...k....k....k..",
        "..kyk..kyk..kyk.",
        "..kyk..kyk..kyk.",
        ".kyyyk.kyk.kyyyk".slice(0, 16),
        ".kyyyykkyykkyyyk",
        ".kylyyyyyyyyyyok",
        ".kyyyyyyyyyyyyok",
        ".kyrryyybbyyggok",
        ".kyrryyybbyyggok",
        ".kyyyyyyyyyyyyok",
        ".koooooooooooook",
        "..kkkkkkkkkkkkk.",
      ],
      fx: "shine",
      glow: "#facc15",
    },
    gemOrange: {
      p: { k: C.k, o: "#f97316", d: "#9a3412", l: "#fed7aa", w: "#fff" },
      r: [
        "...kkkkkkkk...",
        "..kllooooddk..",
        ".klwlooooddok.",
        "kllloooooodddk",
        "kooooooooooddk",
        ".kooooooodddk.",
        "..koooooddk...".slice(0, 14),
        "...kooodddk...",
        "....kooddk....",
        ".....kodk.....",
        "......kk......",
      ],
      fx: "shine",
      glow: "#fb923c",
    },
    gemRed: {
      p: { k: C.k, o: "#dc2626", d: "#7f1d1d", l: "#fca5a5", w: "#fff" },
      r: [
        "...kkkkkkkk...",
        "..kllooooddk..",
        ".klwlooooddok.",
        "kllloooooodddk",
        "kooooooooooddk",
        ".kooooooodddk.",
        "..koooooodk...",
        "...kooodddk...",
        "....kooddk....",
        ".....kodk.....",
        "......kk......",
      ],
      fx: "shine",
      glow: "#ef4444",
    },

    // ---------- Potions and scrolls ----------
    potionRed: {
      p: { k: C.k, c: "#8b5a2b", g: "#cbd5e1", r: "#dc2626", l: "#fca5a5", d: "#7f1d1d", w: "#fff" },
      r: [
        "......kkkk......",
        "......kcck......",
        "......kkkk......",
        ".......kgk......",
        ".......kgk......",
        ".....kkggkk.....",
        "....kgggggggk...".slice(0, 16),
        "...kgwgggggggk..",
        "..kgwrrrrrrrrgk.",
        "..kgrlrrrrrrdgk.",
        "..kgrrrrrrrrdgk.",
        "..kgrrrrrrrddgk.",
        "...kgrrrrrddgk..",
        "....kggggggggk..",
        ".....kkkkkkkk...",
      ],
      fx: "bubble",
      glow: "#ef4444",
    },
    potionGrey: {
      p: { k: C.k, c: "#8b5a2b", g: "#cbd5e1", r: "#64748b", l: "#cbd5e1", d: "#334155", w: "#fff" },
      r: [
        "......kkkk......",
        "......kcck......",
        "......kkkk......",
        ".......kgk......",
        ".......kgk......",
        ".....kkggkk.....",
        "....kggggggk....",
        "...kgwgggggggk..",
        "..kgwrrrrrrrrgk.",
        "..kgrlrrrrrrdgk.",
        "..kgrrrrrrrrdgk.",
        "..kgrrrrrrrddgk.",
        "...kgrrrrrddgk..",
        "....kggggggggk..",
        ".....kkkkkkkk...",
      ],
      fx: "bubble",
      glow: "#94a3b8",
    },
    potionPink: {
      p: { k: C.k, c: "#8b5a2b", g: "#cbd5e1", r: "#ec4899", l: "#fbcfe8", d: "#831843", w: "#fff" },
      r: [
        "......kkkk......",
        "......kcck......",
        "......kkkk......",
        ".......kgk......",
        ".......kgk......",
        ".....kkggkk.....",
        "....kggggggk....",
        "...kgwgggggggk..",
        "..kgwrrrrrrrrgk.",
        "..kgrlrrrrrrdgk.",
        "..kgrrrrrrrrdgk.",
        "..kgrrrrrrrddgk.",
        "...kgrrrrrddgk..",
        "....kggggggggk..",
        ".....kkkkkkkk...",
      ],
      fx: "bubble",
      glow: "#f472b6",
    },
    scroll: {
      p: { k: C.k, p: "#f3e3b5", d: "#c9a96a", b: "#7c4a1e", r: "#b91c1c", t: "#8b6b3a" },
      r: [
        "..kkkkkkkkkkkk..",
        ".kbddppppppppdk.",
        "kbkdppppppppppdk",
        ".kkppttttttpppk.",
        "...kpppppppppk..",
        "...kptttttttpk..",
        "...kpppppppppk..",
        "...kpttttttppk..",
        "...kpppppppppk..",
        "...kptttttpppk..",
        "...kpppppprrpk..",
        ".kkppppppprrppk.",
        "kbkdppppppppppdk",
        ".kbddppppppppdk.",
        "..kkkkkkkkkkkk..",
      ],
      glow: "#f3e3b5",
    },
    scrollGreen: {
      p: { k: C.k, p: "#f3e3b5", d: "#c9a96a", b: "#7c4a1e", g: "#16a34a", l: "#86efac" },
      r: [
        "..kkkkkkkkkkkk..",
        ".kbddppppppppdk.",
        "kbkdppppppppppdk",
        ".kkpppkkpkkpppk.",
        "...kpkllkllkpk..",
        "...kpkglkglkpk..",
        "...kppkgggkppk..",
        "...kpkggkggkpk..",
        "...kpkglkglkpk..",
        "...kppkkgkkppk..",
        "...kpppkgkpppk..",
        ".kkpppppkppppk..".slice(0, 16),
        "kbkdppppppppppdk",
        ".kbddppppppppdk.",
        "..kkkkkkkkkkkk..",
      ],
      fx: "shine",
      glow: "#4ade80",
    },

    // ---------- Places on the world map ----------
    forest: {
      p: { k: C.k, g: "#15803d", l: "#4ade80", d: "#14532d", b: "#5b3a1e" },
      r: [
        "...k........k...",
        "..klk......kgk..",
        ".klggk....kgggk.",
        ".kgggk...klgggk.",
        "klgggdk..kggggdk",
        "kkgggkk.klgggggk".slice(0, 16),
        ".klggdk.kgggggdk",
        "klgggggkkggggdkk",
        "kkkgdkkklgggggdk",
        "..kbk...kgggggdk",
        "..kbk...kkkbkkk.",
        "..kbk.....kbk...",
        "..kkk.....kbk...",
        "..........kkk...",
      ],
      glow: "#4ade80",
    },
    cave: {
      p: { k: C.k, s: "#57534e", l: "#a8a29e", d: "#292524", e: "#facc15" },
      r: [
        "......kkkk......",
        "....kklllskk....",
        "...klllsssssk...",
        "..kllssssssssk..",
        ".klssskkkkssssk.",
        ".klsskddddksssk.",
        "klssk.dddd.kssk".padEnd(16, "."),
        "klsskdeddedkssdk",
        "klsskddddddkssdk",
        "klsskddddddksddk",
        "kssskddddddkdddk",
        "kkkkkkkkkkkkkkkk",
      ],
      fx: "glow",
      glow: "#facc15",
    },
    swamp: {
      p: { k: C.k, g: "#4d7c0f", l: "#a3e635", d: "#1a2e05", w: "#e5e7eb", r: "#dc2626", b: "#365314" },
      r: [
        "..kkk....kkk....",
        ".kwwwk..kwwwk...",
        ".kwkwk..kwkwk...",
        "kkgkgkkkkgkgkk..".slice(0, 16),
        "kgggggggggggggk.",
        "kglggggggggggdk.",
        "kgggrrrrrrrgggdk",
        ".kggggggggggddk.",
        "..kkggggggggdk..",
        ".kbbkkkkkkkkbbk.",
        "kbbbbbbbbbbbbbbk",
        ".kkkkkkkkkkkkkk.",
      ],
      glow: "#a3e635",
    },
    mountain: {
      p: { k: C.k, s: "#64748b", l: "#94a3b8", d: "#334155", w: "#f8fafc", i: "#bae6fd" },
      r: [
        "......kk........",
        ".....kwwk.......",
        "....kwwiwk......",
        "....kwiiwk..kk..",
        "...kwislswk.kwk.",
        "...ksslsssk.kiwk".slice(0, 16),
        "..ksslssssskksik",
        "..kslsssssssksdk",
        ".kslssssssssssdk",
        ".kssssssssssdddk",
        "kslsssssssssdddk",
        "kssssssssssddddk",
        "kkkkkkkkkkkkkkkk",
      ],
      fx: "glow",
      glow: "#bae6fd",
    },
    abyss: {
      p: { k: C.k, d: "#2a0505", r: "#dc2626", o: "#f97316", y: "#facc15", e: "#fde047" },
      r: [
        "....kkkkkkkk....",
        "..kkddrrrrddkk..",
        ".kddrrooooorrdk.",
        ".kdrooyyyyoordk.",
        "kdroyykkkkyyordk",
        "kdroykddddkyordk",
        "kdroykeddekyordk",
        "kdroykddddkyordk",
        "kdroyykkkkyyordk",
        ".kdrooyyyyoordk.",
        ".kddrrooooorrdk.",
        "..kkddrrrrddkk..",
        "....kkkkkkkk....",
      ],
      fx: "flicker",
      glow: "#ef4444",
    },
    lock: {
      p: { k: C.k, s: "#94a3b8", l: "#e2e8f0", d: "#475569", y: "#facc15", o: "#b45309" },
      r: [
        "....kkkkkk....",
        "...ksllllsk...",
        "..ksk....ksk..",
        "..ksk....ksk..",
        "..ksk....ksk..",
        ".kkkkkkkkkkkk.",
        "kyyyyyyyyyyyok",
        "kylyyykkyyyyok",
        "kyyyyykkyyyyok",
        "kyyyyyykyyyyok",
        "kyyyyyyyyyyyok",
        "koooooooooooook".slice(0, 14),
        ".kkkkkkkkkkkk.",
      ],
      glow: "#facc15",
    },
    flag: {
      p: { k: C.k, r: "#e0123c", l: "#fb7185", p: "#94a3b8" },
      r: [
        ".kk.........",
        ".kpkkkkkkk..",
        ".kprrrrrlrk.",
        ".kprrlrrrrrk",
        ".kprrrrrrrk.",
        ".kprrrrrlk..",
        ".kpkkkkkk...",
        ".kpk........",
        ".kpk........",
        ".kpk........",
        "kkkkk.......",
      ],
      fx: "wave",
      glow: "#fb7185",
    },
    map: {
      p: { k: C.k, p: "#f3e3b5", d: "#c9a96a", g: "#16a34a", b: "#3b82f6", r: "#dc2626" },
      r: [
        "kkkkkkkkkkkkkkkk",
        "kppppdpppppdpppk",
        "kpgggdpppbbdpppk",
        "kpggpdppbbbdpprk",
        "kppppdppbbpdprkk".slice(0, 16),
        "kpprpdpppppdpppk",
        "kprrrdpggppdpgpk",
        "kpprpdpgggpdgggk",
        "kppppdppgppdpppk",
        "kbbppdpppppdpppk",
        "kpbbbdpprppdppbk",
        "kppppdpppppdpbbk",
        "kkkkkkkkkkkkkkkk",
      ],
      glow: "#f3e3b5",
    },

    // ---------- Monsters ----------
    wolf: {
      p: { k: C.k, g: "#6b7280", l: "#d1d5db", d: "#374151", y: "#facc15", w: "#fff", r: "#b91c1c" },
      r: [
        ".kk........kk...",
        ".kgk......kgk...",
        ".kggk....kggk...",
        ".kgggkkkkgggk...",
        "kggggggggggggk..",
        "kgkykggggkykgk..",
        "kgkkkggggkkkgk..",
        "kgggggllggggggk.",
        ".kgggllllllgggdk",
        "..kgllkkkklldddk",
        "..kgllwrrwlldk..",
        "...kgllllllddk..",
        "....kkddddddk...",
        "......kkkkkk....",
      ],
      fx: "glow",
      glow: "#facc15",
    },
    goblin: {
      p: { k: C.k, g: "#65a30d", l: "#a3e635", d: "#365314", r: "#dc2626", w: "#fff", y: "#facc15" },
      r: [
        "k..............k",
        "kgk..........kgk",
        "kggkk.kkkk.kkggk",
        ".kggkklggggkkggk".slice(0, 16),
        "..kgglgggggggdk.",
        "..kglkrkggkrkgk.",
        "..kgkrrkggkrrkk.",
        "..kgggggkggggdk.",
        "..kggggkkkgggdk.",
        "...kgkwkwkwkgk..",
        "...kgkkkkkkkdk..",
        "....kgggggddk...",
        ".....kkkkkkk....",
      ],
      fx: "glow",
      glow: "#ef4444",
    },
    witch: {
      p: { k: C.k, h: "#4c1d95", l: "#7c3aed", g: "#84cc16", s: "#a3e635", y: "#facc15", w: "#e5e7eb" },
      r: [
        ".......kk.......",
        "......klhk......",
        ".....klhhk......",
        "....klhhhhk.....",
        "...klhhyhhhk....",
        "..kkkkkkkkkkkk..",
        "kkhhhhhhhhhhhhkk",
        "..kssssssssssk..",
        "..ksskyksskyksk.".slice(0, 16),
        "..kssssssssssk..",
        "...ksssskssssk..",
        "...kwwkskkswwk..",
        "..kwwwkssssk wwk".replace(" ", "w"),
        "..kwwwwkkkkwwwwk".slice(0, 16),
        "...kkkkk..kkkkk.",
      ],
      fx: "glow",
      glow: "#a855f7",
    },
    giant: {
      p: { k: C.k, i: "#7dd3fc", l: "#e0f2fe", d: "#0369a1", b: "#1e3a8a", w: "#fff" },
      r: [
        "..kkkkkkkkkkkk..",
        ".klllliiiiiiidk.",
        "klliiiiiiiiiiddk",
        "kliikkiiiikkiidk",
        "kliikwkiiikwkidk",
        "kliikkiiiikkiidk",
        "kliiiiiiiiiiiidk",
        "kliiiiikkiiiiidk",
        "kliiikkkkkkiiidk",
        "kliikwkwkwkkiddk",
        "kiiiikkkkkkiiddk",
        ".kiiiiiiiiiiddk.",
        "..kdddddddddddk.",
        "...kkkkkkkkkkk..",
      ],
      fx: "glow",
      glow: "#7dd3fc",
    },
    demon: {
      p: { k: C.k, r: "#b91c1c", l: "#ef4444", d: "#450a0a", h: "#e5e7eb", y: "#facc15", w: "#fff" },
      r: [
        "kk............kk",
        "khk..........khk",
        "khhk........khhk",
        ".khhkkkkkkkkhhk.",
        "..klrrrrrrrrrk..",
        ".klrrrrrrrrrrdk.",
        ".klkyykrrkyykdk.",
        ".klrkkrrrrkkrdk.",
        ".krrrrrkkrrrrdk.",
        ".krrkkkkkkkkrdk.",
        ".krrkwkwwkwkrdk.",
        "..krrkkkkkkrdk..",
        "...kdrrrrrddk...",
        "....kkkkkkkk....",
      ],
      fx: "flicker",
      glow: "#ef4444",
    },

    // ---------- World bosses (bigger, with effects) ----------
    dragon: {
      p: { k: C.k, t: "#0f766e", l: "#2dd4bf", d: "#134e4a", y: "#facc15", w: "#fff", r: "#dc2626", h: "#e5e7eb" },
      r: [
        "..kk..........kk..",
        ".khk..........khk.",
        ".khhk........khhk.",
        "..khhkkkkkkkkhhk..",
        "..kttttttttttttk..",
        ".kltttttttttttttk.",
        ".kltkyyktttkyyktk.",
        ".kltkyrktttkryktk.",
        ".kltttttttttttttk.",
        "kllttttkkkkttttdk.",
        "kltttkkwkkwkkttdk.",
        "kltttkrrrrrrkttdk.",
        "kltttkkwkkwkkttdk.",
        ".kttttkkkkkkttddk.",
        ".kdttttttttttdddk.",
        "..kkddddddddddkk..",
        "....kkkkkkkkkk....",
      ],
      fx: "boss",
      glow: "#2dd4bf",
    },
    titan: {
      p: { k: C.k, r: "#dc2626", o: "#f97316", y: "#facc15", d: "#450a0a", s: "#57534e", w: "#fff7cc" },
      r: [
        "...k....kk....k...",
        "..kok..kook..kok..",
        "..koyk.koyk.kyok..",
        "...koykkyykkyok...",
        "..kkkkkkkkkkkkkk..",
        ".ksssssssssssssssk",
        ".kssyyyssssyyysssk".slice(0, 18),
        ".kssywysssyywyssk.",
        ".ksssssssssssssssk",
        ".kssssskkkkssssssk",
        ".kssskooooooksssk.",
        ".ksssskyyyyksssssk",
        "..kssssskksssssk..",
        "...kssssssssssk...",
        "....kddddddddk....",
        ".....kkkkkkkk.....",
      ],
      fx: "boss",
      glow: "#f97316",
    },
    eye: {
      p: { k: C.k, w: "#f1f5f9", v: "#cbd5e1", r: "#b91c1c", o: "#f97316", y: "#facc15", p: "#7c3aed", d: "#1e1b4b" },
      r: [
        "......kkkkkk......",
        "....kkvwwwwvkk....",
        "..kkvwwwrwwwwvkk..",
        ".kvwwwrkkkkrwwwvk.",
        "kvwwwkoyyyyokwwwvk",
        "kwwwkoydddddokwwwk",
        "kwwrkyddkkddykrwwk",
        "kwwwkoddkkddokwwwk",
        "kvwwkoyddddyokwwvk",
        ".kvwwkooyyookwwvk.",
        "..kkvwwkkkkwwvkk..",
        "....kkvvvvvvkk....",
        "......kkkkkk......",
      ],
      fx: "boss",
      glow: "#a855f7",
    },
    skull: {
      p: { k: C.k, w: "#f5f5f4", v: "#d6d3d1", d: "#57534e", r: "#ef4444", e: "#1c1917" },
      r: [
        "....kkkkkkkkk.....",
        "...kwwwwwwwwwk....",
        "..kwwwwwwwwwwvk...",
        ".kwwwwwwwwwwwwvk..",
        ".kwweeewwweeewvk..",
        ".kwerrewwwerrewvk.",
        ".kweeeewwweeeevk..",
        ".kwwwwwekewwwwvk..",
        "..kwwwweeewwwvk...",
        "...kvwwwwwwwvk....",
        "...kvkwkwkwkvk....",
        "...kkekekekekk....",
        "....kvwvwvwvk.....",
        ".....kkkkkkk......",
      ],
      fx: "boss",
      glow: "#ef4444",
    },
    wyrm: {
      // the dragon's shape in storm colors, with golden lightning horns
      p: { k: C.k, t: "#1d4ed8", l: "#60a5fa", d: "#172554", y: "#fde047", w: "#fff", r: "#a5f3fc", h: "#fde047" },
      r: null,
      fx: "boss",
      glow: "#60a5fa",
    },
    spider: {
      p: { k: C.k, b: "#1f1f23", l: "#52525b", r: "#dc2626", y: "#facc15" },
      r: [
        "k................k",
        ".k......kk......k.",
        "..k....kllk....k..",
        "kk.k..kllllk..k.kk",
        "..kkk.kllllk.kkk..",
        ".....kkbbbbkk.....",
        "kkkkkbrrbbrrbkkkkk",
        ".....kbbbbbbk.....",
        "...kkkbbbbbbkkk...",
        "..k..kbbrrbbk..k..",
        ".k..kbbrbbrbbk..k.",
        "k..k.kbbrrbbk.k..k",
        "..k...kbbbbk...k..",
        ".k.....kkkk.....k.",
      ],
      fx: "boss",
      glow: "#dc2626",
    },

    // ---------- Quests and activities ----------
    tv: {
      p: { k: C.k, c: "#3f3f46", s: "#0ea5e9", l: "#7dd3fc", r: "#e0123c", g: "#a1a1aa" },
      r: [
        "....k....k......",
        ".....k..k.......",
        "......kk........",
        "kkkkkkkkkkkkkkkk",
        "kccccccccccccgck",
        "kcllssssssscccck",
        "kclssssrsssckgck",
        "kcsssssrrsscccck",
        "kcsssssrsssckgck",
        "kcssssssssscccck",
        "kccccccccccccccck".slice(0, 16),
        "kkkkkkkkkkkkkkkk",
        "..kk........kk..",
      ],
      glow: "#38bdf8",
    },
    controller: {
      p: { k: C.k, c: "#3f3f46", l: "#71717a", r: "#e0123c", g: "#22c55e", b: "#3b82f6", y: "#facc15" },
      r: [
        "..kkkkk..kkkkk..",
        ".kllccckkcccllk.",
        "kllcckcccccyccck",
        "klckkkcccccrkbck",
        "kcckckccccccgcck",
        "kccckccccccccck.".padEnd(16, "k").slice(0, 16),
        "kcccccckkcccccck",
        "kccccck..kcccccck".slice(0, 16),
        ".kcccck..kccccck",
        "..kkkk....kkkkk.",
      ],
      glow: "#e0123c",
    },
    colosseum: {
      p: { k: C.k, s: "#d6c7a1", l: "#f3e8c8", d: "#8a7a55", r: "#e0123c" },
      r: [
        ".......kk.......",
        "......krrk......",
        ".......kk.......",
        "..kkkkkkkkkkkk..",
        ".klllllllllllldk",
        ".ksksksksksksksk".slice(0, 16),
        ".kdkdkdkdkdkdkdk",
        "kllllllllllllllk",
        "kskkskkskkskkskk",
        "kskkskkskkskkskk",
        "ksddsddsddsddsdk",
        "kkkkkkkkkkkkkkkk",
      ],
      glow: "#f3e8c8",
    },
    dice: {
      p: { k: C.k, w: "#f8fafc", v: "#cbd5e1", r: "#e0123c" },
      r: [
        "..kkkkkkkkkk..",
        ".kwwwwwwwwwvk.",
        "kwrrwwwwwwwwvk",
        "kwrrwwwwwwwwvk",
        "kwwwwwwwwwwwvk",
        "kwwwwwrrwwwwvk",
        "kwwwwwrrwwwwvk",
        "kwwwwwwwwwwwvk",
        "kwwwwwwwwrrwvk",
        "kwwwwwwwwrrwvk",
        ".kvvvvvvvvvvk.",
        "..kkkkkkkkkk..",
      ],
      glow: "#f8fafc",
    },
    chat: {
      p: { k: C.k, w: "#f8fafc", v: "#cbd5e1", r: "#e0123c" },
      r: [
        "..kkkkkkkkkkkk..",
        ".kwwwwwwwwwwwwk.",
        "kwwwwwwwwwwwwwvk",
        "kwwrrwwrrwwrrwvk",
        "kwwrrwwrrwwrrwvk",
        "kwwwwwwwwwwwwwvk",
        ".kvvvvvvvvvvvvk.",
        "..kkkvvkkkkkkk..",
        "....kvk.........",
        "....kk..........",
      ],
      glow: "#f8fafc",
    },
    clipboard: {
      p: { k: C.k, b: "#7c4a1e", p: "#f8fafc", g: "#94a3b8", c: "#22c55e", t: "#64748b" },
      r: [
        ".....kkkkk......",
        "..kkkkgggkkkk...",
        ".kbbkkkkkkkbbk..",
        ".kbppppppppppbk.".slice(0, 16),
        ".kbpckpttttpbk..",
        ".kbpcckppppppbk.".slice(0, 16),
        ".kbppppppppppbk.".slice(0, 16),
        ".kbpckpttttpbk..",
        ".kbpcckppppppbk.".slice(0, 16),
        ".kbppppppppppbk.".slice(0, 16),
        ".kbbbbbbbbbbbbk.",
        ".kkkkkkkkkkkkkk.",
      ],
      glow: "#22c55e",
    },

    // ---------- Watch party reactions ----------
    laugh: {
      p: { k: C.k, y: "#facc15", l: "#fff3b0", o: "#ca8a04", b: "#60a5fa", w: "#fff", r: "#dc2626" },
      r: [
        "....kkkkkk....",
        "..kkyyyyyykk..",
        ".kylyyyyyyyyk.",
        "kylyyyyyyyyyok",
        "kykkkyyyykkkok",
        "kbyyyyyyyyyybk",
        "kbykkkkkkkkybk",
        "kyykwwwwwwkyok",
        "kyykrrrrrrkyok",
        "kyyykkkkkkyyok",
        ".kyyyyyyyyyok.",
        "..kkooooookk..",
        "....kkkkkk....",
      ],
      fx: "bounce",
      glow: "#facc15",
    },
    wow: {
      p: { k: C.k, y: "#facc15", l: "#fff3b0", o: "#ca8a04", d: "#7f1d1d" },
      r: [
        "....kkkkkk....",
        "..kkyyyyyykk..",
        ".kylyyyyyyyyk.",
        "kylyyyyyyyyyok",
        "kyykkyyyykkyok",
        "kyykkyyyykkyok",
        "kyyyyyyyyyyyok",
        "kyyyykkkyyyyok",
        "kyyyykdkyyyyok",
        "kyyyykkkyyyyok",
        ".kyyyyyyyyyok.",
        "..kkooooookk..",
        "....kkkkkk....",
      ],
      fx: "bounce",
      glow: "#facc15",
    },
    angry: {
      p: { k: C.k, y: "#ef4444", l: "#fca5a5", o: "#991b1b", w: "#fff" },
      r: [
        "....kkkkkk....",
        "..kkyyyyyykk..",
        ".kylyyyyyyyyk.",
        "kylyyyyyyyyyok",
        "kykkyyyyyykkok",
        "kyykkyyyykkyok",
        "kyykwkyykwkyok",
        "kyyyyyyyyyyyok",
        "kyyykkkkkkyyok",
        "kyykyyyyyykyok",
        ".kyyyyyyyyyok.",
        "..kkooooookk..",
        "....kkkkkk....",
      ],
      fx: "flicker",
      glow: "#ef4444",
    },
    party: {
      p: { k: C.k, y: "#facc15", r: "#e0123c", b: "#3b82f6", g: "#22c55e", w: "#fff" },
      r: [
        "..r...y.....b...",
        "....b....r..y...",
        ".y.....kk.......",
        "......kryk...r..",
        "..g..kyyrk......",
        ".....krryyk.y...",
        "....kyyrrrk..g..",
        "...krrryyyk.....",
        "...kyyyrrrrk.b..",
        "..krrryyyyrk....",
        "..kyyyrrrryyk...",
        ".kkkkkkkkkkkk...",
      ],
      fx: "bounce",
      glow: "#facc15",
    },

    // ---------- Achievements and cosmetics ----------
    sprout: {
      p: { k: C.k, g: "#16a34a", l: "#4ade80", b: "#7c4a1e", d: "#4a2c17" },
      r: [
        "..kkk....kkk..",
        ".kllgk..kglgk.",
        "kllggk..kgglk.".slice(0, 14),
        "kllgggkkgggk..",
        ".kllggkkggk...",
        "..kkkkgkkk....",
        "......kgk.....",
        "......kgk.....",
        "...kkkkkkkk...",
        "..kbbbbbbbbk..",
        "..kdbbbbbbdk..",
        "...kdbbbbdk...",
        "....kkkkkk....",
      ],
      glow: "#4ade80",
    },
    wave: {
      p: { k: C.k, s: "#fcd34d", d: "#d97706", l: "#fef3c7" },
      r: [
        "....kk.kk.......",
        "...kslkslk.kk...",
        "...ksskssk.kslk.",
        "...ksskssk.kssk.",
        "...ksskssskkssk.",
        "...ksssssssssk..",
        ".kkksssssssssk..",
        "kslksssssssssk..",
        ".ksssssssssssk..",
        "..kssssssssdk...",
        "...ksssssddk....",
        "....kkkkkkk.....",
      ],
      fx: "wave",
      glow: "#fcd34d",
    },
    comet: {
      p: { k: C.k, y: "#fde047", o: "#f97316", r: "#dc2626", w: "#fffbea", b: "#60a5fa" },
      r: [
        "..........kkkk..",
        ".........kwwyyk.",
        "........kwwyyyok",
        "......kkyyyyyook",
        ".....koyyyyyoork",
        "....korooyyoorrk",
        "...korrooooork..",
        "..korrrrooork...",
        ".korrkrrrrk.....",
        "korrk.krrk......",
        "krk...kk........",
        "kk..............",
      ],
      fx: "flicker",
      glow: "#f97316",
    },
    horns: {
      p: { k: C.k, r: "#dc2626", l: "#f87171", d: "#7f1d1d" },
      r: [
        "kk..........kk",
        "klk........kdk",
        "krlk......kdrk",
        ".krlk....kdrk.",
        ".krrlkkkkdrrk.",
        "..krrrrrrrrk..",
        "...kkkkkkkk...",
      ],
      fx: "flicker",
      glow: "#ef4444",
    },
    wizardHat: {
      p: { k: C.k, h: "#4c1d95", l: "#7c3aed", y: "#facc15" },
      r: [
        "........kk......",
        ".......klhk.....",
        "......klhhk.....",
        ".....klhyhhk....",
        "....klhhhhhk....",
        "...klhhhyhhhk...",
        "..klhhhhhhhhk...",
        "..klyhhhhhhhhk..",
        ".kkkkkkkkkkkkkk.",
        "khhhhhhhhhhhhhhk",
        ".kkkkkkkkkkkkkk.",
      ],
      fx: "twinkle",
      glow: "#a855f7",
    },
    halo: {
      p: { k: C.k, y: "#fde047", w: "#fffbea", o: "#f59e0b" },
      r: [
        "...kkkkkkkk...",
        ".kkwwyyyyyykk.",
        "kwyykkkkkkyyok",
        ".kkoooooooook.".slice(0, 14),
        "...kkkkkkkk...",
      ],
      fx: "twinkle",
      glow: "#fde047",
    },
    capeRed: {
      p: { k: C.k, c: "#b91c1c", l: "#ef4444", d: "#7f1d1d", g: "#facc15" },
      r: [
        "..kkkkkkkkkk..",
        ".kgkllcccdkgk.",
        ".kkllcccccdkk.",
        "..kllcccccdk..",
        "..klccccccdk..",
        ".klcccccccddk.",
        ".klcccccccddk.",
        "klccccccccdddk",
        "klcccccccccddk",
        "kccckcccckcddk",
        "kkkk.kkkk.kkkk",
      ],
      fx: "wave",
      glow: "#ef4444",
    },
    capePurple: {
      p: { k: C.k, c: "#6d28d9", l: "#a78bfa", d: "#3b0764", g: "#facc15" },
      r: [
        "..kkkkkkkkkk..",
        ".kgkllcccdkgk.",
        ".kkllcccccdkk.",
        "..kllcccccdk..",
        "..klccccccdk..",
        ".klcccccccddk.",
        ".klcccccccddk.",
        "klccccccccdddk",
        "klcccccccccddk",
        "kccckcccckcddk",
        "kkkk.kkkk.kkkk",
      ],
      fx: "wave",
      glow: "#a78bfa",
    },
    capeGold: {
      p: { k: C.k, c: "#eab308", l: "#fde68a", d: "#a16207", g: "#e0123c" },
      r: [
        "..kkkkkkkkkk..",
        ".kgkllcccdkgk.",
        ".kkllcccccdkk.",
        "..kllcccccdk..",
        "..klccccccdk..",
        ".klcccccccddk.",
        ".klcccccccddk.",
        "klccccccccdddk",
        "klcccccccccddk",
        "kccckcccckcddk",
        "kkkk.kkkk.kkkk",
      ],
      fx: "shine",
      glow: "#facc15",
    },
    slime: {
      p: { k: C.k, g: "#22c55e", l: "#86efac", d: "#15803d", w: "#fff" },
      r: [
        "......kkkk......",
        "....kkllggkk....",
        "...klwlggggdk...",
        "..klwggggggddk..",
        ".klggkkggkkggdk.",
        ".kgggkwggkwgggdk".slice(0, 16),
        "klggggggggggggdk",
        "kggggkggggkgggdk",
        "kgggggkkkkggggdk",
        "kdggggggggggdddk",
        ".kkddddddddddkk.",
        "...kkkkkkkkkk...",
      ],
      fx: "bounce",
      glow: "#4ade80",
    },
    fox: {
      p: { k: C.k, o: "#ea580c", l: "#fb923c", w: "#fff7ed", d: "#7c2d12" },
      r: [
        "kk..........kk",
        "kok........kok",
        "kodk......kdok",
        "koookkkkkkoook",
        "kloooooooooook",
        "kokkoooookkook",
        "kookwooookwook",
        ".kowwwoowwwok.",
        "..kwwwkkwwwk..",
        "...kwwwwwwk...",
        "....kkkkkk....",
      ],
      fx: "bounce",
      glow: "#fb923c",
    },
    ghost: {
      p: { k: C.k, w: "#f8fafc", v: "#cbd5e1", e: "#1e1b4b", b: "#93c5fd" },
      r: [
        "....kkkkkk....",
        "..kkwwwwwwkk..",
        ".kwwwwwwwwwvk.",
        ".kwweewweewvk.",
        "kwwweewweewwvk",
        "kwwwwwwwwwwwvk",
        "kwwwwbbbbwwwvk",
        "kwwwwwbbwwwwvk",
        "kwwwwwwwwwwwvk",
        "kvwwvwwwvwwvvk",
        "kkvvkkvvkkvvkk".slice(0, 14),
        ".k..k..k..k...",
      ],
      fx: "float",
      glow: "#93c5fd",
    },
    babyDragon: {
      p: { k: C.k, g: "#16a34a", l: "#4ade80", d: "#14532d", y: "#facc15", w: "#fff", r: "#f97316" },
      r: [
        "..k......k......",
        ".kyk....kyk.....",
        ".kgkkkkkkgk.....",
        "kllgggggggk.....",
        "kgkwkggkwkgk....",
        "kgkkkggkkkgk....",
        "kgggggggggggkkk.",
        ".kgggkkkggggrrk.",
        "..kkgggggggkkk..",
        "...kllgggggdk...",
        "..kgkllgggdkgk..",
        "..kk.kkkkkk.kk..",
      ],
      fx: "bounce",
      glow: "#4ade80",
    },
    sparkle: {
      p: { k: C.k, y: "#fde047", w: "#fffbea" },
      r: [
        "......k.......",
        ".....kyk......",
        ".....kwk...k..",
        "....kyyyk.kyk.",
        "kkkkywwwykkkk.",
        "kyywwwwwwwyyk.",
        "kkkkywwwykkkk.",
        "....kyyyk.....",
        "..k..kwk......",
        ".kyk.kyk......",
        "..k...k.......",
      ],
      fx: "twinkle",
      glow: "#fde047",
    },
    toxic: {
      p: { k: C.k, g: "#3f6212", l: "#a3e635", y: "#d9f99d", d: "#1a2e05" },
      r: [
        "..kkkkkkkkkk..",
        ".kllllllllllk.",
        ".kkkkkkkkkkkk.",
        ".kgglggggggdk.",
        ".kggkkkkkkgdk.",
        ".kgkyykkyykdk.",
        ".kgkyyyyyykdk.",
        ".kggkyyyykgdk.",
        ".kgggkyykggdk.",
        ".kkkkkkkkkkkk.",
        ".kgglggggggdk.",
        ".kggggggggddk.",
        "..kkkkkkkkkk..",
      ],
      fx: "glow",
      glow: "#a3e635",
    },
    snowflake: {
      p: { k: C.k, i: "#7dd3fc", w: "#f0f9ff" },
      r: [
        ".....kk.....",
        "..k.kwik.k..",
        ".kik.kk.kik.",
        "..kikwwkik..",
        "kk.kiwwik.kk",
        "kwwwwwwwwwik",
        "kiwwwwwwwwwk",
        "kk.kiwwik.kk",
        "..kikwwkik..",
        ".kik.kk.kik.",
        "..k.kiwk.k..",
        ".....kk.....",
      ],
      fx: "twinkle",
      glow: "#7dd3fc",
    },
    rainbow: {
      p: { k: C.k, r: "#ef4444", o: "#f97316", y: "#facc15", g: "#22c55e", b: "#3b82f6", v: "#8b5cf6", w: "#f8fafc" },
      r: [
        "....kkkkkkkk....",
        "..kkrrrrrrrrkk..",
        ".krroooooooorrk.",
        "kroyyyyyyyyyyork",
        "koyggggggggggyok",
        "kygbbkkkkkkbbgyk",
        "kgbvk......kvbgk",
        "kbvk........kvbk",
        "kkk..........kkk",
        "kwwk........kwwk",
        "kkkk........kkkk",
      ],
      fx: "shine",
      glow: "#facc15",
    },
    paw: {
      p: { k: C.k, b: "#a16207", l: "#fde68a" },
      r: [
        "..kk....kk..",
        ".kbbk..kbbk.",
        ".kbbk..kbbk.",
        "kk.kk..kk.kk",
        "kbk......kbk",
        ".k..kkkk..k.",
        "...kbbbbk...",
        "..kbblbbbk..",
        "..kbbbbbbk..",
        "...kkkkkk...",
      ],
      glow: "#fde68a",
    },
    alien: {
      p: { k: C.k, g: "#a855f7", l: "#d8b4fe", d: "#581c87", w: "#fff" },
      r: [
        "..k........k..",
        "...k......k...",
        "..kkkkkkkkkk..",
        ".kllggggggggk.",
        "kllgkkggggkkgk",
        "klggkwggggkwgk",
        "kgggggggggggdk",
        ".kgkgkgkgkgdk.",
        ".kk.kk..kk.kk.",
      ],
      fx: "bounce",
      glow: "#c084fc",
    },
  };

  ART.wyrm.r = ART.dragon.r;

  // Which emoji gets which drawing (variation selectors are ignored)
  const MAP = {
    "🪙": "coin", "💰": "coin",
    "🎁": "chest",
    "🗡️": "sword", "🔪": "sword",
    "⚔️": "swords",
    "🛡️": "shield",
    "❤️": "heart", "♥️": "heart",
    "⭐": "star", "🌟": "star", "✨": "sparkle",
    "🔥": "flame",
    "🏆": "trophy",
    "🥇": "medalGold", "🏅": "medalGold",
    "👑": "crown",
    "🟠": "gemOrange", "🔴": "gemRed",
    "🧪": "potionRed", "🪨": "potionGrey",
    "📜": "scroll", "🍀": "scrollGreen",
    "🌲": "forest", "🕳️": "cave", "🐸": "swamp", "🏔️": "mountain", "😈": "abyss",
    "🔒": "lock", "🚩": "flag", "🗺️": "map",
    "🐺": "wolf", "👺": "goblin", "🧙": "witch", "🧊": "giant", "👹": "demon",
    "🐉": "dragon", "👁️": "eye", "💀": "skull", "⚡": "wyrm", "🕷️": "spider",
    "📺": "tv", "🎮": "controller", "🏟️": "colosseum", "🎲": "dice", "💬": "chat", "📋": "clipboard",
    "🌱": "sprout", "👋": "wave", "☄️": "comet",
    "😇": "halo",
    "🟥": "capeRed", "🟪": "capePurple", "🟨": "capeGold",
    "🟢": "slime", "🦊": "fox", "👻": "ghost", "🐲": "babyDragon", "🐾": "paw", "👾": "alien",
    "☢️": "toxic", "😂": "laugh", "😮": "wow", "😡": "angry", "🎉": "party", "👏": "wave", "❄️": "snowflake", "🌈": "rainbow",
  };

  // Some emojis mean different things in different places: the world boss "Crimson Titan" is 🔥,
  // the abyss and devil horns are 😈, the wizard hat and witch are 🧙. These are picked by where they show.
  const CONTEXT = [
    { within: ".boss-emoji, .boss-strip-emoji, .boss-icon", map: { "🔥": "titan" } },
    { within: ".extra-card, .extra-icon, .buff-chip", map: { "❤": "potionPink" } },
    { within: ".wardrobe-panel, .cosmetic-card, .cosmetic-preview, [data-kind='hat']", map: { "😈": "horns", "🧙": "wizardHat" } },
  ];

  const norm = (s) => String(s).replace(/️/g, "");
  const KEYS = new Map(Object.entries(MAP).map(([e, name]) => [norm(e), name]));
  // Longest first, so multi-character emojis match before their parts
  const PATTERN = new RegExp([...KEYS.keys()].sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\uFE0F?").join("|"), "gu");

  const built = new Map();
  function draw(name) {
    if (built.has(name)) return built.get(name);
    const art = ART[name];
    if (!art) return null;
    const rows = art.r;
    const w = Math.max(...rows.map((r) => r.length));
    const h = rows.length;
    const root = document.createElementNS(NS, "svg");
    root.setAttribute("viewBox", `0 0 ${w} ${h}`);
    root.setAttribute("shape-rendering", "crispEdges");
    // One <path> per color keeps the drawing light
    const byColor = {};
    rows.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        const color = art.p[ch] || C[ch];
        if (!color || ch === ".") return;
        (byColor[color] = byColor[color] || []).push(`M${x} ${y}h1v1h-1z`);
      });
    });
    Object.entries(byColor).forEach(([color, d]) => {
      const p = document.createElementNS(NS, "path");
      p.setAttribute("d", d.join(""));
      p.setAttribute("fill", color);
      root.append(p);
    });
    built.set(name, root);
    return root;
  }

  function iconFor(name, label) {
    const art = ART[name];
    const base = draw(name);
    if (!base) return null;
    const svg = base.cloneNode(true);
    svg.setAttribute("class", `px px-${name}${art.fx ? ` fx-${art.fx}` : ""}`);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", label || name);
    svg.style.setProperty("--px-glow", art.glow || "transparent");
    const ratio = base.viewBox.baseVal.width / base.viewBox.baseVal.height;
    if (ratio > 1.15) svg.classList.add("px-wide");
    return svg;
  }

  function nameFor(emoji, place) {
    const key = norm(emoji);
    for (const c of CONTEXT) {
      if (c.map[key] && place && place.closest && place.closest(c.within)) return c.map[key];
    }
    return KEYS.get(key) || null;
  }

  // ---------- Swapping emojis in the page ----------
  const SKIP = "input, textarea, select, option, script, style, svg, [contenteditable], .tchat-list, .chat-messages, .chat-msg, .no-px";

  function decorateText(node) {
    const text = node.nodeValue;
    PATTERN.lastIndex = 0;
    if (!PATTERN.test(text)) return;
    const parent = node.parentElement;
    if (!parent || parent.closest(SKIP)) return;
    const frag = document.createDocumentFragment();
    let last = 0;
    text.replace(PATTERN, (match, offset) => {
      const name = nameFor(match, parent);
      if (!name) return match;
      if (offset > last) frag.append(text.slice(last, offset));
      frag.append(iconFor(name, match));
      last = offset + match.length;
      return match;
    });
    if (last === 0) return;
    if (last < text.length) frag.append(text.slice(last));
    node.replaceWith(frag);
  }

  function decorate(root) {
    if (!root) return;
    if (root.nodeType === 3) return decorateText(root);
    if (root.nodeType !== 1 || root.closest(SKIP)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const found = [];
    while (walker.nextNode()) found.push(walker.currentNode);
    found.forEach(decorateText);
  }

  // New content (pages built by script, toasts, dialogs) is decorated as it appears
  let queue = new Set();
  let scheduled = false;
  function flush() {
    scheduled = false;
    const items = [...queue];
    queue = new Set();
    items.forEach((n) => n.isConnected && decorate(n));
  }
  const observer = new MutationObserver((records) => {
    records.forEach((r) => {
      if (r.type === "characterData") queue.add(r.target);
      else r.addedNodes.forEach((n) => queue.add(n));
    });
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(flush);
    }
  });

  function start() {
    decorate(document.body);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", start) : start();

  return {
    has: (emoji) => !!nameFor(emoji),
    svg: (emoji, place) => {
      const name = nameFor(emoji, place);
      return name ? iconFor(name, emoji) : null;
    },
    byName: (name) => iconFor(name, name),
    names: () => Object.keys(ART),
    decorate,
  };
})();
