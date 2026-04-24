const { addonBuilder } = require("stremio-addon-sdk");
const fetch = require("node-fetch");
const { fetchPage } = require("./scraper");
const { pool } = require("./db");

const FILMS_PER_PAGE = 28;
const WATCHLIST_TTL_MS = 60 * 60 * 1000; // 1 hour

// Track in-progress background syncs so we don't launch duplicates
const syncInProgress = new Set();

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

async function lookupMeta(title, year) {
  // Check DB cache first
  const cached = await pool.query(
    "SELECT imdb_id, poster FROM cinemeta_cache WHERE title = $1 AND year = $2",
    [title, year || ""]
  );
  if (cached.rows.length > 0) {
    return { id: cached.rows[0].imdb_id, poster: cached.rows[0].poster };
  }

  // Fetch from Cinemeta
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
      // Store in DB
      await pool.query(
        `INSERT INTO cinemeta_cache (title, year, imdb_id, poster)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (title, year) DO NOTHING`,
        [title, year || "", match.id, match.poster || null]
      );
      return result;
    }
  } catch (err) {
    console.error(`Cinemeta lookup failed for "${title}":`, err.message);
  }

  return null;
}

async function storeFilms(client, username, films, startPosition) {
  for (let i = 0; i < films.length; i++) {
    const film = films[i];
    await client.query(
      `INSERT INTO watchlist_films (username, slug, title, year, poster, position, synced_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (username, slug) DO UPDATE SET position = $6, synced_at = NOW()`,
      [username, film.slug, film.title, film.year || null, film.poster || null, startPosition + i]
    );
  }
}

function fetchRemainingPages(username, totalPages) {
  if (syncInProgress.has(username)) return;
  syncInProgress.add(username);

  (async () => {
    try {
      for (let page = 2; page <= totalPages; page++) {
        const { films } = await fetchPage(username, page);
        if (films.length === 0) break;

        const offset = (page - 1) * FILMS_PER_PAGE;
        await storeFilms(pool, username, films, offset);
        console.log(`Background: page ${page}/${totalPages} — ${films.length} films for ${username}`);
      }
      console.log(`Background sync complete for ${username}`);
    } catch (err) {
      console.error(`Background sync failed for ${username}:`, err.message);
    } finally {
      syncInProgress.delete(username);
    }
  })();
}

async function syncWatchlist(username) {
  // Check if we have fresh data
  const freshCheck = await pool.query(
    "SELECT synced_at FROM watchlist_films WHERE username = $1 ORDER BY position LIMIT 1",
    [username]
  );

  if (freshCheck.rows.length > 0) {
    const age = Date.now() - new Date(freshCheck.rows[0].synced_at).getTime();
    if (age < WATCHLIST_TTL_MS) return; // still fresh

    // TTL expired — wipe and re-fetch
    await pool.query("DELETE FROM watchlist_films WHERE username = $1", [username]);
  }

  // Fetch page 1 synchronously
  const { films, totalPages } = await fetchPage(username, 1);
  if (films.length === 0) return;

  await storeFilms(pool, username, films, 0);
  console.log(`Page 1/${totalPages} — ${films.length} films for ${username}`);

  // Fetch remaining pages in background
  if (totalPages > 1) {
    fetchRemainingPages(username, totalPages);
  }
}

builder.defineCatalogHandler(async (args) => {
  if (args.id !== "letterboxd-watchlist") return { metas: [] };

  const username = args.config?.username;
  if (!username) return { metas: [] };

  await syncWatchlist(username);

  const skip = parseInt(args.extra?.skip || 0);
  const result = await pool.query(
    "SELECT slug, title, year, poster FROM watchlist_films WHERE username = $1 ORDER BY position LIMIT $2 OFFSET $3",
    [username, FILMS_PER_PAGE, skip]
  );

  const metas = [];
  for (const film of result.rows) {
    const meta = await lookupMeta(film.title, film.year);
    metas.push({
      id: meta?.id || `letterboxd:${film.slug}`,
      type: "movie",
      name: film.title,
      poster: film.poster || meta?.poster,
      releaseInfo: film.year,
    });
  }

  return { metas };
});

module.exports = builder.getInterface();
module.exports.baseManifest = manifest;
