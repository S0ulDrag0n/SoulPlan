import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Opt these packages out of Server Components bundling so they are loaded
  // via native Node `require()` at runtime. This is required for `lightningcss`
  // because its native `.node` binary is downloaded as a separate
  // `lightningcss-<platform>` optional-dependency package and resolved at
  // runtime via `require('lightningcss-<platform>')`. When Turbopack tries to
  // bundle `lightningcss` into a server chunk, the relative `.node` fallback
  // path inside the package breaks and you get
  //   "Cannot find module '../lightningcss.darwin-arm64.node'".
  // @tailwindcss/postcss is also opted out because the CSS PostCSS pipeline
  // runs inside the same server bundler and uses `lightningcss` internally.
  // sql.js is WASM (no native binary) but it's listed here too as a safety
  // net — it should never be bundled because the WASM is loaded at runtime.
  serverExternalPackages: ["sql.js", "lightningcss", "@tailwindcss/postcss"],
  // Turbopack is the default bundler in Next.js 16.
  // sql.js's WASM binary is handled by the bundler automatically.
  // No custom webpack config needed.
};

export default nextConfig;
