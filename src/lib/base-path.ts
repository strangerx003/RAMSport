/**
 * Base path the app is served from.
 *
 * Leave `NEXT_PUBLIC_BASE_PATH` unset for root-hosted deployments:
 * Vercel, a custom domain, or a `<user>.github.io` repository.
 *
 * GitHub Pages *project* sites live under `https://<user>.github.io/<repo>/`,
 * so they need `NEXT_PUBLIC_BASE_PATH=/<repo>` at build time.
 */
const raw = (process.env.NEXT_PUBLIC_BASE_PATH ?? "")
  .trim()
  .replace(/^\/+|\/+$/g, "");

export const basePath = raw ? `/${raw}` : "";

/** Prefix an app-relative path (for metadata assets that Next does not rewrite). */
export function withBasePath(path: string) {
  return `${basePath}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Normalise a pathname for route comparison: drop the base path and the
 * trailing slash added by `trailingSlash: true`, so `/RAMSport/rbd/` and
 * `/rbd` both compare equal to the nav entry `/rbd`.
 */
export function stripBasePath(pathname: string) {
  let path = pathname;
  if (basePath) {
    if (path === basePath) path = "/";
    else if (path.startsWith(`${basePath}/`)) path = path.slice(basePath.length);
  }
  if (path.length > 1) path = path.replace(/\/+$/, "");
  return path || "/";
}
