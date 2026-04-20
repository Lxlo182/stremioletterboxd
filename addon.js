const { addonBuilder } = require("stremio-addon-sdk");
const fetch = require("node-fetch");
const { fetchPage } = require("./scraper");


const FILMS_PER_PAGE = 28;

const manifest = {
  id: "com.stremioletterboxd",
  version: "1.0.0",
  name: "Letterboxd Watchlist",
  description: "Shows your Letterboxd watchlist in Stremio",
  resources: ["catalog"],
  types: ["movie"],
  catalogs: [
    {
      type: "movie",
      id: "letterboxd-watchlist",
      name: "Letterboxd Watchlist",
      extra: [{ name: "skip", isRequired: false }],
    },
  ],
  idPrefixes: ["tt"],
  behaviorHints: {
    configurable: true,
    configurationRequired: true,
  },
  config: [
    {
      key: "username",
      type: "text",
      title: "Letterboxd Username",
      required: true,
    },
  ],
};

const builder = new addonBuilder(manifest);

// Simple in-memory cache: { "Title:Year": { id, poster } }
const imdbCache = {};

async function lookupMeta(title, year) {
  const cacheKey = `${title}:${year}`;
  if (imdbCache[cacheKey]) return imdbCache[cacheKey];

  try {
    const query = encodeURIComponent(title);
    const url = `https://v3-cinemeta.strem.io/catalog/movie/top/search=${query}.json`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    const metas = data.metas || [];

    const match =
      metas.find(
        (m) =>
          m.name?.toLowerCase() === title.toLowerCase() &&
          (!year || String(m.year) === String(year))
      ) ||
      metas.find((m) => m.name?.toLowerCase() === title.toLowerCase()) ||
      metas[0];

    if (match?.id) {
      const result = { id: match.id, poster: match.poster || null };
      imdbCache[cacheKey] = result;
      return result;
    }
  } catch (err) {
    console.error(`Cinemeta lookup failed for "${title}":`, err.message);
  }

  return null;
}

builder.defineCatalogHandler(async (args) => {
  if (args.id !== "letterboxd-watchlist") return { metas: [] };

  const username = args.config?.username;
  if (!username) return { metas: [] };

  const skip = parseInt(args.extra?.skip || 0);
  const page = Math.floor(skip / FILMS_PER_PAGE) + 1;

  const { films } = await fetchPage(username, page);

  const metas = [];
  for (const film of films) {
    const meta = await lookupMeta(film.title, film.year);
    metas.push({
      id: meta?.id || `letterboxd:${film.slug}`,
      type: "movie",
      name: film.title,
      poster: meta?.poster || film.poster,
      releaseInfo: film.year,
    });
  }

  return { metas };
});

module.exports = builder.getInterface();
module.exports.baseManifest = manifest;
