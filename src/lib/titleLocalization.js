const { Sanscript } = require("@indic-transliteration/sanscript");

const PHRASE_MAP = new Map([
  ["om jai jagdish hare", "ॐ जय जगदीश हरे"],
  ["hanuman chalisa", "हनुमान चालीसा"],
  ["shiv tandav stotram", "शिव तांडव स्तोत्रम्"],
  ["durga aarti", "दुर्गा आरती"],
  ["ganesh aarti", "गणेश आरती"],
  ["sundarkand path", "सुंदरकांड पाठ"],
  ["bajrang baan", "बजरंग बाण"],
  ["shiv chalisa", "शिव चालीसा"],
  ["durga chalisa", "दुर्गा चालीसा"],
  ["ganesh chalisa", "गणेश चालीसा"],
  ["lakshmi aarti", "लक्ष्मी आरती"],
  ["sai baba aarti", "साईं बाबा आरती"],
]);

const WORD_MAP = new Map([
  ["om", "ॐ"],
  ["jai", "जय"],
  ["jagdish", "जगदीश"],
  ["hare", "हरे"],
  ["hanuman", "हनुमान"],
  ["chalisa", "चालीसा"],
  ["chalisaa", "चालीसा"],
  ["aarti", "आरती"],
  ["arti", "आरती"],
  ["sundarkand", "सुंदरकांड"],
  ["path", "पाठ"],
  ["paath", "पाठ"],
  ["mantra", "मंत्र"],
  ["mantras", "मंत्र"],
  ["bhajan", "भजन"],
  ["shiv", "शिव"],
  ["shiva", "शिव"],
  ["tandav", "तांडव"],
  ["stotra", "स्तोत्र"],
  ["stotram", "स्तोत्रम्"],
  ["durga", "दुर्गा"],
  ["ganesh", "गणेश"],
  ["ganesha", "गणेश"],
  ["ganpati", "गणपति"],
  ["ganapati", "गणपति"],
  ["lakshmi", "लक्ष्मी"],
  ["vishnu", "विष्णु"],
  ["krishna", "कृष्ण"],
  ["radha", "राधा"],
  ["radhe", "राधे"],
  ["ram", "राम"],
  ["rama", "राम"],
  ["sita", "सीता"],
  ["mahadev", "महादेव"],
  ["shankar", "शंकर"],
  ["bhole", "भोले"],
  ["nath", "नाथ"],
  ["maa", "माँ"],
  ["mata", "माता"],
  ["devi", "देवी"],
  ["saraswati", "सरस्वती"],
  ["kali", "काली"],
  ["ambe", "अम्बे"],
  ["amba", "अम्बा"],
  ["govind", "गोविंद"],
  ["gopal", "गोपाल"],
  ["narayan", "नारायण"],
  ["rudrashtakam", "रुद्राष्टकम"],
  ["ashtakam", "अष्टकम"],
  ["ashtak", "अष्टक"],
  ["katha", "कथा"],
  ["stuti", "स्तुति"],
  ["vandana", "वंदना"],
  ["baba", "बाबा"],
  ["sai", "साईं"],
  ["shani", "शनि"],
  ["vinayak", "विनायक"],
  ["bhairav", "भैरव"],
  ["suktam", "सूक्तम्"],
  ["ji", "जी"],
]);

function capitalizeWords(value) {
  return value.replace(/\b([a-z])/gu, (match, letter) => letter.toUpperCase());
}

function normalizeLatinToken(token) {
  return token
    .toLowerCase()
    .replace(/[^a-z0-9]/gu, "")
    .trim();
}

function transliterateFallback(token) {
  const normalized = normalizeLatinToken(token);

  if (!normalized) {
    return token;
  }

  const romanized = normalized
    .replace(/aa/gu, "A")
    .replace(/ii/gu, "I")
    .replace(/uu/gu, "U")
    .replace(/sh/gu, "sh")
    .replace(/chh/gu, "Ch")
    .replace(/ch/gu, "ch");

  return Sanscript.t(romanized, "itrans", "devanagari", { syncope: true });
}

function generateHindiTitle(title) {
  const source = `${title || ""}`.trim();

  if (!source) {
    return "";
  }

  const normalizedTitle = source.toLowerCase().replace(/\s+/gu, " ").trim();

  if (PHRASE_MAP.has(normalizedTitle)) {
    return PHRASE_MAP.get(normalizedTitle);
  }

  const parts = source.split(/(\s+|[-–—,:|()/]+)/u);
  const transformed = parts.map((part) => {
    const normalized = normalizeLatinToken(part);

    if (!normalized) {
      return part;
    }

    if (WORD_MAP.has(normalized)) {
      return WORD_MAP.get(normalized);
    }

    return transliterateFallback(part);
  });

  return transformed.join("").replace(/\s+/gu, " ").trim();
}

function getDisplayTitle(song, language = "en") {
  const lang = `${language || "en"}`.trim().toLowerCase();

  if (lang === "hi" || lang === "hindi") {
    return song.titleHindi || generateHindiTitle(song.title);
  }

  return song.title;
}

module.exports = {
  capitalizeWords,
  generateHindiTitle,
  getDisplayTitle,
};
