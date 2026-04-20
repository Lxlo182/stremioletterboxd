# stremioletterboxd

IMPORTANT: Do not use emojis in responses for this project.

## Project Overview

A Stremio addon that integrates Letterboxd watchlist and ratings into Stremio, allowing users to access their Letterboxd content directly within the Stremio streaming app.

**Current Status**: Hello World skeleton. Letterboxd integration not yet implemented.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: stremio-addon-sdk v1.6.10
- **HTTP Server**: Built into stremio-addon-sdk (runs on port 8080)
- **Package Manager**: npm

## Project Structure

```
.
├── addon.js        # Core addon logic: manifest, handlers, dataset
├── server.js       # Entry point: starts HTTP server
├── package.json    # Dependencies: stremio-addon-sdk
└── package-lock.json
```

## Running the Project

```bash
npm install    # if node_modules missing
npm start      # runs 'node server.js' -> server on http://localhost:8080
```

The addon will expose:
- Manifest endpoint: `http://localhost:8080/manifest.json`
- Catalog endpoint: `http://localhost:8080/catalog/{type}/{id}.json`
- Meta endpoint: `http://localhost:8080/meta/{type}/{id}.json`
- Stream endpoint: `http://localhost:8080/stream/{type}/{id}.json`

## Stremio Addon SDK Reference

### Manifest Structure (addon.js)

The manifest defines the addon's capabilities:

```javascript
const manifest = {
  id: 'com.example.letterboxd',        // unique identifier
  version: '1.0.0',                     // semver
  name: 'Letterboxd',                   // display name
  description: 'Letterboxd integration',
  types: ['movie', 'series'],           // content types supported
  catalogs: [],                         // catalog definitions (usually empty)
  resources: ['catalog', 'meta', 'stream'],  // handlers this addon provides
  idPrefixes: ['tt']                    // IMDb ID prefixes (for filtering)
};
```

### Handler Functions

**defineCatalogHandler**
```javascript
addonBuilder.defineCatalogHandler(({ type, id, extra }) => {
  // extra = { search, genre, skip, ...other query params }
  return Promise.resolve({ metas: [{ id, type, name, poster }] });
});
```

**defineMetaHandler**
```javascript
addonBuilder.defineMetaHandler(({ type, id }) => {
  return Promise.resolve({ 
    meta: { 
      id, 
      type, 
      name, 
      poster,
      background,
      description,
      releaseInfo,
      imdbRating,
      videos: [{ id, title, released, season, episode }]
    } 
  });
});
```

**defineStreamHandler**
```javascript
addonBuilder.defineStreamHandler(({ type, id }) => {
  return Promise.resolve({ 
    streams: [
      { url: 'https://...', title: 'Direct' },           // direct URL
      { infoHash: '...', title: 'Torrent' },             // torrent
      { ytId: '...', title: 'YouTube' },                 // YouTube
      { externalUrl: 'https://...', title: 'External' }  // external player
    ] 
  });
});
```

**defineSubtitlesHandler**
```javascript
addonBuilder.defineSubtitlesHandler(({ type, id, extra }) => {
  // extra = { query, language, ... }
  return Promise.resolve({ 
    subtitles: [
      { url: 'https://...', lang: 'en', title: 'English' }
    ] 
  });
});
```

### Serving the Addon

```javascript
serveHTTP(addon, { port: 8080 });
```

The SDK handles CORS automatically. Remote addons must use HTTPS (localhost exempt).

## Letterboxd Integration Notes

Letterboxd has no official API. Common integration approaches:

1. **RSS Feeds** (no auth required):
   - Watchlist: `https://letterboxd.com/{username}/watchlist/rss/`
   - Ratings: `https://letterboxd.com/{username}/rss/`
   - Diary: `https://letterboxd.com/{username}/diary/rss/`

2. **Web Scraping** (fragile, not recommended):
   - Use cheerio or jsdom to parse HTML
   - Subject to layout changes

3. **Data Mapping**:
   - Letterboxd films include IMDb IDs in RSS/HTML
   - Map IMDb IDs (format: `tt{number}`) to Stremio meta objects
   - Use IMDb as the glue between Letterboxd and Stremio streams

## Key Constraints

- Remote addons require HTTPS (use BeamUp or similar for hosting)
- Localhost addons can use HTTP
- Manifest must be valid JSON and accessible at root `/manifest.json`
- All handlers are async (must return Promises)
- Addon is installed via manifest URL in Stremio settings

## Next Steps (when implementing Letterboxd integration)

1. Parse Letterboxd RSS feed(s) for user's watchlist/ratings
2. Extract IMDb IDs and film metadata
3. Implement `defineCatalogHandler` to return user's Letterboxd films
4. Implement `defineMetaHandler` to enrich with Letterboxd metadata
5. Optionally: implement `defineStreamHandler` to delegate to other stream addons
6. Deploy addon and test in Stremio
