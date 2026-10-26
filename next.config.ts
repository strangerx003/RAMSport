import type { NextConfig } from "next";
import { basePath } from "./src/lib/base-path";

const nextConfig: NextConfig = {
  agentRules: false,
  poweredByHeader: false,
  // Static export: `npm run build` writes a fully static site to `out/`.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  // Empty on Vercel; `/RAMSport` on GitHub Pages project sites.
  basePath,
};

export default nextConfig;
