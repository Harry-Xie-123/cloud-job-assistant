import { access, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const distDir = resolve(process.env.WEB_DIST_DIR || resolve(rootDir, "apps", "web", "dist"));
const indexPath = resolve(distDir, "index.html");

await access(indexPath);
const html = await readFile(indexPath, "utf8");

if (!html.includes('id="root"')) {
  throw new Error("Production index.html is missing the React root element.");
}

if (html.includes("/src/main.jsx")) {
  throw new Error("Production index.html still points to the development source entry.");
}

const assetPaths = [...html.matchAll(/(?:src|href)="\/?(assets\/[^"]+)"/g)]
  .map((match) => match[1]);

if (!assetPaths.some((path) => path.endsWith(".js"))) {
  throw new Error("Production index.html does not reference a JavaScript bundle.");
}

if (!assetPaths.some((path) => path.endsWith(".css"))) {
  throw new Error("Production index.html does not reference a CSS bundle.");
}

await Promise.all(assetPaths.map((assetPath) => access(resolve(distDir, assetPath))));
const files = await readdir(resolve(distDir, "assets"));

console.log(`Verified React production build: ${assetPaths.length} linked assets, ${files.length} files.`);
