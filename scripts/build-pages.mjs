// Build the static export the way GitHub Pages expects it.
//
//   node scripts/build-pages.mjs                 -> /RAMSport (uses GITHUB_REPOSITORY or the folder name)
//   node scripts/build-pages.mjs RAMSport        -> /RAMSport
//   node scripts/build-pages.mjs "" ""           -> served from the domain root
//
// On Vercel you do not need this: `npm run build` produces a root-hosted site.
import { spawnSync } from "node:child_process";
import { basename, resolve } from "node:path";

const repoName =
  process.argv[2] ?? process.env.GITHUB_REPOSITORY?.split("/").pop() ?? basename(process.cwd());
const basePath = process.argv[3] ?? `/${repoName}`;

console.log(`[build:pages] NEXT_PUBLIC_BASE_PATH=${basePath || "(root)"}`);

const result = spawnSync(process.execPath, [resolve("node_modules/next/dist/bin/next"), "build"], {
  stdio: "inherit",
  env: { ...process.env, NEXT_PUBLIC_BASE_PATH: basePath },
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
