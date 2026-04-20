const { getRouter } = require("stremio-addon-sdk");
const landingTemplate = require("stremio-addon-sdk/src/landingTemplate");
const express = require("express");

const addonInterface = require("./addon");
const { TEST_USERNAME, baseManifest } = require("./addon");

const app = express();

// Intercept manifest requests to inject dynamic catalog name
app.use((req, res, next) => {
  if (!req.path.endsWith("/manifest.json")) return next();

  // URL pattern: /{base64_config}/manifest.json or /manifest.json
  const parts = req.path.split("/").filter(Boolean);
  let username = TEST_USERNAME || "Letterboxd";

  if (parts.length === 2) {
    try {
      const config = JSON.parse(Buffer.from(parts[0], "base64").toString());
      if (config.username) username = config.username;
    } catch (e) {}
  }

  const hasConfig = parts.length === 2;
  const manifest = {
    ...baseManifest,
    behaviorHints: hasConfig
      ? {} // remove configurable once a config is present, so Stremio accepts the install
      : { ...baseManifest.behaviorHints },
    catalogs: baseManifest.catalogs.map((cat) => ({
      ...cat,
      name: `${username} LB Watchlist`,
    })),
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

app.listen(8080, () => {
  console.log("Letterboxd addon running on http://127.0.0.1:8080/manifest.json");
});
