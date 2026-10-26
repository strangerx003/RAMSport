// Serve the exported `out/` folder exactly as a static host would, so the
// GitHub Pages build can be checked locally before pushing.
//
//   node scripts/serve-out.mjs            -> http://localhost:4000/
//   node scripts/serve-out.mjs RAMSport   -> http://localhost:4000/RAMSport/
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";

const baseArg = process.argv[2] ?? "";
// "-" means "serve from the domain root" when a port argument is also needed.
const basePath = (baseArg === "-" ? "" : baseArg).replace(/^\/+|\/+$/g, "");
const port = Number(process.argv[3] ?? 4000);
const root = resolve("out");

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

function fileFor(urlPath) {
  const relative = decodeURIComponent(urlPath).replace(/^\/+/, "");
  const candidate = resolve(join(root, relative));
  if (candidate !== root && !candidate.startsWith(root + sep)) return null;
  if (!existsSync(candidate)) return null;
  if (statSync(candidate).isDirectory()) {
    const index = join(candidate, "index.html");
    return existsSync(index) ? index : null;
  }
  return candidate;
}

if (!existsSync(root)) {
  console.error("out/ does not exist. Run `npm run build` first.");
  process.exit(1);
}

createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  let pathname = url.pathname;

  if (basePath) {
    if (pathname === `/${basePath}`) {
      response.writeHead(301, { location: `/${basePath}/` }).end();
      return;
    }
    if (!pathname.startsWith(`/${basePath}/`)) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("Not found");
      return;
    }
    pathname = pathname.slice(basePath.length + 1) || "/";
  }

  const file = fileFor(pathname);
  if (!file) {
    const fallback = join(root, "404.html");
    response.writeHead(404, { "content-type": types[".html"], "cache-control": "no-store" });
    if (existsSync(fallback)) createReadStream(fallback).pipe(response);
    else response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "content-type": types[extname(file)] ?? "application/octet-stream",
    "cache-control": "no-store",
  });
  createReadStream(file).pipe(response);
}).listen(port, () => {
  const base = basePath ? `/${basePath}/` : "/";
  console.log(`[preview] http://localhost:${port}${base}`);
});
