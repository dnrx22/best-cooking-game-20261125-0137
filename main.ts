// Dapur Kilat — Rush Hour Kitchen
// Entry point run by the grader as `node /bot/main.ts` with
// MAKEFUN_OUTPUT_DIR set (default /output). Node 22+, stdlib only, no network.
// Copies game/ and screenshots/ next to this file into the output dir and
// writes a deterministic dossier.json. Exit 0, byte-identical on repeat runs.
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const GAME_NAME = "Dapur Kilat — Rush Hour Kitchen";
const GAME_SLUG = "best-cooking-game-20261125-0137";
const MAX_SCREENSHOT_BYTES = 256 * 1024;
const MAX_SCREENSHOTS = 4;

function fail(message: string): never {
  console.error("main.ts: " + message);
  process.exit(1);
}

function copyDirRecursive(srcDir: string, destDir: string): string[] {
  const copied: string[] = [];
  fs.mkdirSync(destDir, { recursive: true });
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const entry of entries) {
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copied.push(...copyDirRecursive(src, dest));
    } else if (entry.isFile()) {
      fs.copyFileSync(src, dest);
      copied.push(path.relative(destDir, dest).split(path.sep).join("/"));
    }
  }
  return copied;
}

function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  // fileURLToPath (not .pathname): .pathname stays URL-encoded, so a repo
  // path containing a space or special character would resolve wrong.
  const rootDir = path.dirname(fileURLToPath(import.meta.url));

  const gameDir = path.join(rootDir, "game");
  const shotsDir = path.join(rootDir, "screenshots");
  if (!fs.existsSync(path.join(gameDir, "index.html"))) {
    fail("game/index.html not found next to main.ts");
  }
  if (!fs.existsSync(path.join(gameDir, "main.js"))) {
    fail("game/main.js not found next to main.ts");
  }
  // Fail loudly if the entrypoint does not load its script, instead of
  // shipping a game that renders an empty page.
  const entryHtml = fs.readFileSync(path.join(gameDir, "index.html"), "utf8");
  if (!entryHtml.includes("main.js")) {
    fail("game/index.html does not reference main.js");
  }
  if (!fs.existsSync(shotsDir)) fail("screenshots/ not found next to main.ts");

  fs.mkdirSync(outDir, { recursive: true });

  // Copy game/ then screenshots/ (sorted, deterministic order).
  const gameFiles = copyDirRecursive(gameDir, path.join(outDir, "game"));
  const shotFiles = copyDirRecursive(shotsDir, path.join(outDir, "screenshots"));

  // Validate screenshots: at most 4, each at most 256 KiB.
  const shotEntries = shotFiles
    .filter((f) => /\.(jpe?g|png)$/i.test(f))
    .sort();
  if (shotEntries.length === 0) fail("no screenshots found in screenshots/");
  if (shotEntries.length > MAX_SCREENSHOTS) {
    fail("too many screenshots: " + shotEntries.length + " (max " + MAX_SCREENSHOTS + ")");
  }
  const screenshots = shotEntries.map((f) => {
    const size = fs.statSync(path.join(outDir, "screenshots", f)).size;
    if (size > MAX_SCREENSHOT_BYTES) {
      fail("screenshot too large: " + f + " (" + size + " bytes, max " + MAX_SCREENSHOT_BYTES + ")");
    }
    return { file: "screenshots/" + f, bytes: size };
  });

  const dossier = {
    game: GAME_NAME,
    slug: GAME_SLUG,
    description:
      "A complete original timed cooking game that plays offline in a desktop browser. " +
      "Orders appear on the order board; pick ingredients from the counter, stack them on " +
      "the plate, and serve the dish before the order expires. Correct serves score " +
      "100 points plus a speed bonus, and consecutive correct serves build a " +
      "streak worth +25 per extra serve in a row; a wrong plate costs 10 and " +
      "an expired order costs 15 and resets the streak. " +
      "A 2-minute shift, keyboard (1-6 pick, Enter serve, Backspace clear) and mouse play, " +
      "with start, playing and end/score screens.",
    how_to_play:
      "Open game/index.html in a desktop browser. Click Start shift, then click ingredients " +
      "on the counter (or press keys 1-6) to stack them on the plate. Press Enter or click " +
      "Serve when the plate matches an order on the board. Serve as many correct orders as " +
      "you can before the 2-minute timer runs out.",
    entrypoint: "game/index.html",
    game_files: gameFiles.map((f) => "game/" + f),
    screenshots: screenshots
  };

  const dossierText = JSON.stringify(dossier, null, 2) + "\n";
  fs.writeFileSync(path.join(outDir, "dossier.json"), dossierText, "utf8");
  console.log("Dapur Kilat: wrote " + outDir + "/dossier.json (" + screenshots.length + " screenshots)");
}

main();
