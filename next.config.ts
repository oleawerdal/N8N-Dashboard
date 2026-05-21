import type { NextConfig } from "next";

const config: NextConfig = {
  // 'standalone' produces a slim self-contained server bundle that the
  // Dockerfile copies. Vercel ignores this and uses its own packager,
  // so the same config works for both targets.
  output: "standalone",
};

export default config;
