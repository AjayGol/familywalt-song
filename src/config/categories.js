const CATEGORY_CONFIG = {
  arti: {
    value: "arti",
    apiId: "aarti",
    label: "Aarti",
    shortLabel: "Arti",
    description: "Morning and evening devotional singing",
    rootFolder: "arti",
    albumFolder: "album",
    imageFolder: "imagearti",
    songFolder: "songarti",
    aliases: ["aarti"],
  },
  chalis: {
    value: "chalis",
    apiId: "chalisa",
    label: "Chalisa",
    shortLabel: "Chalis",
    description: "Sacred verses for courage and devotion",
    rootFolder: "chalis",
    albumFolder: "album",
    imageFolder: "imagechalis",
    songFolder: "songchalis",
    aliases: ["chalisa", "chalis"],
  },
  sundarkand: {
    value: "sundarkand",
    apiId: "sundarkand",
    label: "Sundarkand",
    shortLabel: "Sundarkand",
    description: "Hanuman path for strength and faith",
    rootFolder: "sundarkand",
    albumFolder: "album",
    imageFolder: "imagesundarkand",
    songFolder: "songsundarkand",
    aliases: [],
  },
  path: {
    value: "path",
    apiId: "path",
    label: "Path",
    shortLabel: "Path",
    description: "Longer recitations and scripture reading",
    rootFolder: "path",
    albumFolder: "album",
    imageFolder: "imagepath",
    songFolder: "songpath",
    aliases: [],
  },
  mantra: {
    value: "mantra",
    apiId: "mantra",
    label: "Mantra",
    shortLabel: "Mantra",
    description: "Quiet repetition for calm focus",
    rootFolder: "mantra",
    albumFolder: "album",
    imageFolder: "imagemantra",
    songFolder: "songmantra",
    aliases: [],
  },
};

function getCategories() {
  return Object.values(CATEGORY_CONFIG);
}

function getCategoryConfig(rawCategory) {
  const category = `${rawCategory || ""}`.trim().toLowerCase();

  for (const config of getCategories()) {
    if (config.value === category || config.apiId === category || config.aliases.includes(category)) {
      return config;
    }
  }

  return null;
}

function getCategoryByApiId(rawCategoryId) {
  return getCategoryConfig(rawCategoryId);
}

module.exports = {
  CATEGORY_CONFIG,
  getCategories,
  getCategoryConfig,
  getCategoryByApiId,
};
