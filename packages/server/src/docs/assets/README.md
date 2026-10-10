# Vendored Swagger UI assets

Served by the API server at `/api/docs` (ADR-024). Do not edit these
files by hand; they are vendored third-party output.

- Source: npm package `swagger-ui-dist`
- Version: 5.33.1
- License: Apache License 2.0 (`swagger-ui-bundle.js.LICENSE.txt` is
  the webpack license chunk the bundle banner points at; the full
  license text ships with the package and is summarized in REUSE.toml)
- Files: `swagger-ui-bundle.js`, `swagger-ui.css` (upstream dist
  output), `init.js` (ours -- the page initializer), and the license
  chunk.

To update: download a new `swagger-ui-dist` tarball, replace the two
upstream files, bump the version here, and re-run the api suite (the
meta spec asserts the assets serve with the right content types).

The server build (`packages/server/package.json`) copies this
directory to `dist/docs` so the production image (which ships only
the bundle) can serve them; the route resolves the directory relative
to the running entry file.