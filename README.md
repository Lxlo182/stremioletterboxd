# Stremio Letterboxd Watchlist

A Stremio addon that displays your Letterboxd watchlist as a catalog in Stremio. Browse your watchlist and stream films directly.

## Install

1. Open Stremio
2. Go to the addon search bar
3. Paste: `https://stremio-letterboxd-g2db.onrender.com/manifest.json`
4. Enter your Letterboxd username when prompted

That's it. Your Letterboxd watchlist will appear as a catalog in Stremio.

## How it works

1. You configure the addon with your Letterboxd username
2. The addon scrapes your public watchlist from Letterboxd
3. Each film is matched to an IMDb ID via Cinemeta so Stremio can find streams
4. Results are cached in Postgres -- the watchlist refreshes every hour, IMDb lookups are permanent

---

## Development

Everything below is for developers who want to modify or self-host the addon.

### Prerequisites

- Node.js >= 18
- PostgreSQL

### Local development

```bash
# Install dependencies
npm install

# Create a local Postgres database
createdb stremioletterboxd

# Configure your .env
echo "DATABASE_URL=postgres://$(whoami)@localhost:5432/stremioletterboxd" > .env

# Start the dev server
npm run dev
```

The server runs at `http://localhost:8080`.

### Endpoints

- `http://localhost:8080/manifest.json` -- addon manifest
- `http://localhost:8080/configure` -- configuration page

### Install in Stremio (local)

Paste `http://localhost:8080/manifest.json` into Stremio's addon search bar.

### Deploy to Render

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) > **New** > **Blueprint**
3. Connect the repo -- Render detects `render.yaml` and creates:
   - A free web service
   - A free Postgres database with `DATABASE_URL` wired automatically
4. Once deployed, install in Stremio using `https://stremio-letterboxd-g2db.onrender.com/manifest.json`

### Tech stack

- **Runtime**: Node.js
- **Server**: Express (via stremio-addon-sdk)
- **Scraping**: Cheerio
- **Database**: PostgreSQL (pg)
- **Deployment**: Render (Blueprint via render.yaml)
