import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["sql.js"],
  // Turbopack is the default bundler in Next.js 16.
  // sql.js's WASM binary is handled by the bundler automatically.
  // No custom webpack config needed.
};

export default nextConfig;