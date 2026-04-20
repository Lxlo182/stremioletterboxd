const cheerio = require("cheerio");
const fetch = require("node-fetch");

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseFilms($) {
  const films = [];
  $('[data-component-class="LazyPoster"]').each((_, el) => {
    const name = $(el).attr("data-item-name") || "";
    const slug = $(el).attr("data-item-slug");

    if (!slug) return;

    const yearMatch = name.match(/\((\d{4})\)$/);
    const year = yearMatch ? yearMatch[1] : null;
    const title = name.replace(/\s*\(\d{4}\)$/, "").trim() || slug;

    // data-postered-identifier contains JSON like {"uid":"film:818798",...}
    let filmId = null;
    try {
      const identifier = JSON.parse(
        $(el).attr("data-postered-identifier") || "{}"
      );
      const uid = identifier.uid || "";
      filmId = uid.startsWith("film:") ? uid.split(":")[1] : null;
    } catch (e) {}

    const idPath = filmId ? filmId.split("").join("/") : null;
    const poster =
      filmId && idPath
        ? `https://a.ltrbxd.com/resized/film-poster/${idPath}/${filmId}-${slug}-0-230-0-345-crop.jpg`
        : null;

    films.push({ title, year, slug, poster });
  });
  return films;
}

function parseTotalPages($) {
  const lastHref = $(".paginate-pages a").last().attr("href");
  const match = lastHref?.match(/page\/(\d+)/);
  return match ? parseInt(match[1], 10) : 1;
}

async function fetchPage(username, pageNum) {
  const url =
    pageNum === 1
      ? `https://letterboxd.com/${username}/watchlist/`
      : `https://letterboxd.com/${username}/watchlist/page/${pageNum}/`;

  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching page ${pageNum}`);

  const html = await res.text();
  const $ = cheerio.load(html);

  return {
    films: parseFilms($),
    totalPages: parseTotalPages($),
  };
}

async function fetchAllWatchlist(username) {
  try {
    console.log(`Fetching watchlist for ${username}...`);
    const { films, totalPages } = await fetchPage(username, 1);
    console.log(`Page 1/${totalPages} — ${films.length} films`);

    for (let page = 2; page <= totalPages; page++) {
      await sleep(300);
      const result = await fetchPage(username, page);
      console.log(`Page ${page}/${totalPages} — ${result.films.length} films`);
      films.push(...result.films);
    }

    console.log(`Total: ${films.length} films fetched`);
    return films;
  } catch (err) {
    console.error(`Error fetching watchlist for ${username}:`, err.message);
    return [];
  }
}

module.exports = { fetchPage, fetchAllWatchlist };
