require("dotenv/config");
const { getRouter } = require("stremio-addon-sdk");
const landingTemplate = require("stremio-addon-sdk/src/landingTemplate");
const express = require("express");

const addonInterface = require("./addon");
const { baseManifest } = require("./addon");
const { initDb } = require("./db");

const app = express();

// Intercept manifest requests to remove configurable hint once config is present
app.use((req, res, next) => {
  if (!req.path.endsWith("/manifest.json")) return next();

  const parts = req.path.split("/").filter(Boolean);
  const hasConfig = parts.length === 2;

  const manifest = {
    ...baseManifest,
    behaviorHints: hasConfig
      ? {} // remove configurable once a config is present, so Stremio accepts the install
      : { ...baseManifest.behaviorHints },
  };

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(manifest);
});

const landingHTML = landingTemplate(baseManifest);
app.get("/", (_, res) => res.redirect("/configure"));
app.get("/configure", (_, res) => {
  res.setHeader("content-type", "text/html");
  res.end(landingHTML);
});

app.use(getRouter(addonInterface));

const PORT = process.env.PORT || 8080;

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Letterboxd addon running on http://127.0.0.1:${PORT}/manifest.json`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err.message);
    process.exit(1);
  });
