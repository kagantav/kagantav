import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * The prerendered document was served with `Cache-Control:
   * s-maxage=31536000`, so browsers held stale HTML — and because that
   * HTML points at immutable, content-hashed JS chunks, a normal reload
   * kept replaying the ENTIRE old build (old previews and all). That was
   * the real cause of the recurring "still the same after rebuild" pain.
   *
   * Force ONLY the entry document to always revalidate. Hashed build
   * assets under /_next/static keep their long immutable cache (their URLs
   * change per build). Media under /assets keeps Next's default
   * max-age=0 + ETag revalidation (correct: changed files refetch, others
   * 304). So a reload always boots the current build without re-downloading
   * everything.
   */
  async headers() {
    return [
      {
        source: "/",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
