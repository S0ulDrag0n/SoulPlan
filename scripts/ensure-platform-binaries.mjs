#!/usr/bin/env node
/**
 * Cross-platform postinstall safety net.
 *
 * Why this exists:
 *   `lightningcss` and `@tailwindcss/oxide` are native (N-API) modules whose
 *   platform-specific `.node` binaries are downloaded by an `optionalDependencies`
 *   postinstall hook. If that hook is skipped (e.g. `npm ci --ignore-scripts`,
 *   sandboxed environments, partial network) the binary is missing and any
 *   code that requires the module crashes at runtime.
 *
 *   This script re-installs the correct platform package for the current OS+arch.
 *   It is a no-op when the binary is already present, and tolerates the case
 *   where the package has no published binary for this platform (it logs a
 *   warning rather than failing the install).
 *
 * Supported platforms (mirrors the published optional-deps matrix):
 *   - darwin-arm64, darwin-x64
 *   - linux-arm64-gnu, linux-x64-gnu, linux-arm64-musl, linux-x64-musl
 *   - win32-x64-msvc, win32-arm64-msvc, win32-ia32-msvc
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

// Packages whose native binary is required at build/dev time.
const NATIVE_PACKAGES = ["lightningcss", "@tailwindcss/oxide"];

// Map (node platform, node arch) -> the npm-suffix used in optional-dep names.
// See: https://nodejs.org/api/process.html#processplatform
//      https://nodejs.org/api/process.html#processarch
function platformPackageSuffix(platform, arch) {
  if (platform === "darwin") {
    return arch === "arm64" ? "darwin-arm64" : "darwin-x64";
  }
  if (platform === "linux") {
    // Detect glibc vs musl by trying to resolve a glibc-specific symbol.
    // process.report.getReport().header.glibcVersionRuntime is set on glibc
    // systems and undefined on musl/Alpine. (Available since Node 16.)
    const report = process.report.getReport();
    const glibc = report.header.glibcVersionRuntime;
    const libc = glibc ? "gnu" : "musl";
    if (arch === "arm64") return `linux-arm64-${libc}`;
    if (arch === "x64") return `linux-x64-${libc}`;
  }
  if (platform === "win32") {
    if (arch === "x64") return "win32-x64-msvc";
    if (arch === "arm64") return "win32-arm64-msvc";
    if (arch === "ia32") return "win32-ia32-msvc";
  }
  return null;
}

// Convert an unscoped or scoped package name to its platform-suffixed variant.
// e.g. "lightningcss"          -> "lightningcss-darwin-arm64"
//      "@tailwindcss/oxide"    -> "@tailwindcss/oxide-darwin-arm64"
function platformPackageName(pkg, suffix) {
  if (pkg.startsWith("@")) {
    const [scope, name] = pkg.split("/");
    return `${scope}/${name}-${suffix}`;
  }
  return `${pkg}-${suffix}`;
}

function log(msg) {
  process.stdout.write(`[ensure-platform-binaries] ${msg}\n`);
}

function warn(msg) {
  process.stderr.write(`[ensure-platform-binaries] WARN: ${msg}\n`);
}

function isBinaryPresent(pkg, suffix) {
  // Convention: optional-dep package layout is
  //   node_modules/<name>-<suffix>/<name>-<suffix>.node
  // (matches what we observed in node_modules).
  const dirName = platformPackageName(pkg, suffix);
  // For scoped packages the dir is node_modules/@scope/name-suffix.
  // For unscoped packages the dir is node_modules/name-suffix.
  // The file inside is named after the unscoped package + suffix.
  const fileBase = pkg.startsWith("@") ? pkg.split("/")[1] : pkg;
  const binPath = join("node_modules", dirName, `${fileBase}-${suffix}.node`);
  return existsSync(binPath);
}

function main() {
  const { platform, arch } = process;
  const suffix = platformPackageSuffix(platform, arch);

  if (!suffix) {
    warn(`unsupported platform: ${platform}-${arch}; skipping native binary install`);
    warn(`builds will fail if any package requires a native binary on this OS`);
    process.exit(0);
  }

  log(`detected ${platform}-${arch} (suffix: ${suffix})`);

  let allOk = true;

  for (const pkg of NATIVE_PACKAGES) {
    const platformPkg = platformPackageName(pkg, suffix);

    if (isBinaryPresent(pkg, suffix)) {
      log(`OK ${pkg}: binary present (${platformPkg})`);
      continue;
    }

    log(`-> ${pkg}: binary missing, installing ${platformPkg}...`);
    try {
      // Use --no-save so we never mutate package.json/lockfile from postinstall.
      // --no-audit --no-fund for cleaner output.
      execFileSync(
        "npm",
        ["install", "--no-save", "--no-audit", "--no-fund", platformPkg],
        { stdio: "inherit" },
      );
      log(`OK ${pkg}: installed ${platformPkg}`);
    } catch (err) {
      // Non-fatal: package may not publish a binary for this platform
      // (e.g. linux-musl for some packages). Caller will see the real error
      // at require-time if it matters.
      warn(`failed to install ${platformPkg}: ${err.message}`);
      warn(`if a downstream tool needs ${pkg} on ${suffix}, the build may fail`);
      allOk = false;
    }
  }

  if (!allOk) {
    warn("one or more platform binaries could not be installed");
    // Exit 0: a missing optional binary should not block the install.
    // The user can re-run with the right toolchain or platform package.
  }
}

main();
