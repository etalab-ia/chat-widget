import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The container image runs the standalone server, which needs the traced
  // dependencies next to it rather than a full node_modules tree.
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
