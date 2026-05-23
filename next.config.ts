import type { NextConfig } from "next";

// 'standalone' produces a slim self-contained server bundle that the
// Dockerfile copies. Only enable it when building the Docker image —
// Vercel handles packaging itself and standalone output can confuse
// its build pipeline. Set BUILD_TARGET=docker in the Dockerfile.
const config: NextConfig = {
  output: process.env.BUILD_TARGET === "docker" ? "standalone" : undefined,
  // Keep the Postgres driver out of the bundle; it's required at runtime
  // from node_modules instead (avoids bundling its optional native deps).
  serverExternalPackages: ["pg"],
};

export default config;
