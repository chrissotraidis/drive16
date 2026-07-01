#!/usr/bin/env node
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const nostalgistPackageDir = path.join(rootDir, "app", "node_modules", "nostalgist");
const coreCdnUrl =
  "https://cdn.jsdelivr.net/gh/arianrhodsandlot/retroarch-emscripten-build@v1.22.2/retroarch/genesis_plus_gx_libretro.zip";

function parseArgs(argv) {
  return {
    online: argv.includes("--online"),
    json: argv.includes("--json"),
    help: argv.includes("--help") || argv.includes("-h"),
  };
}

function printHelp() {
  console.log(`Usage: scripts/check-interactive-play-core.mjs [--online] [--json]

Checks Drive16's current interactive Play core policy.

Default checks are local and safe:
  - Nostalgist package is installed.
  - The wrapper package is MIT licensed.
  - The current adapter points at Genesis Plus GX through the dev CDN.
  - No emulator core binaries are tracked in git.

Use --online to also check whether the dev CDN core URL is reachable.
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const checks = [];
  const packageJson = await readNostalgistPackage(checks);
  await checkNostalgistRuntime(checks);
  await checkTrackedCoreBinaries(checks);

  if (args.online) {
    await checkCoreCdn(checks);
  }

  const hasFailure = checks.some((check) => check.state === "missing");
  const hasWarning = checks.some((check) => check.state === "warning");
  const summary = {
    status: hasFailure ? "missing" : hasWarning ? "dev-only" : "dev-only",
    label: hasFailure ? "Play setup needed" : "Play ready",
    detail: hasFailure
      ? "Interactive Play needs setup; Verify remains available through Genteel."
      : "Interactive Play is available for local development through Nostalgist's dev CDN core path; this is not a bundled release core.",
    package: packageJson
      ? {
          name: packageJson.name,
          version: packageJson.version,
          license: packageJson.license,
        }
      : undefined,
    coreCdnUrl,
    checks,
  };

  if (args.json) {
    console.log(`${JSON.stringify(summary, null, 2)}\n`);
  } else {
    console.log(`${summary.label}: ${summary.detail}`);
    for (const check of checks) {
      console.log(`- ${check.state.toUpperCase()} ${check.name}: ${check.detail}`);
    }
    console.log("Verify still available: Genteel proof/capture does not depend on this interactive core.");
  }

  if (hasFailure) process.exitCode = 1;
}

async function readNostalgistPackage(checks) {
  try {
    const packagePath = path.join(nostalgistPackageDir, "package.json");
    const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
    checks.push({
      name: "Nostalgist package",
      state: "ready",
      detail: `${packageJson.name}@${packageJson.version} is installed.`,
    });
    checks.push({
      name: "Nostalgist wrapper license",
      state: packageJson.license === "MIT" ? "ready" : "warning",
      detail: `Wrapper license is ${packageJson.license ?? "unknown"}.`,
    });
    return packageJson;
  } catch (error) {
    checks.push({
      name: "Nostalgist package",
      state: "missing",
      detail: `Install app dependencies with pnpm --dir app install. ${formatError(error)}`,
    });
    return undefined;
  }
}

async function checkNostalgistRuntime(checks) {
  try {
    const runtimePath = path.join(nostalgistPackageDir, "dist", "nostalgist.js");
    const runtime = await readFile(runtimePath, "utf8");
    const hasGenesisCore = runtime.includes("genesis_plus_gx");
    const hasCdnPath =
      runtime.includes("cdn.jsdelivr.net/gh") &&
      runtime.includes("retroarch-emscripten-build") &&
      runtime.includes("_libretro.zip");

    checks.push({
      name: "Genesis adapter",
      state: hasGenesisCore ? "ready" : "missing",
      detail: hasGenesisCore
        ? "Nostalgist maps Mega Drive playback to genesis_plus_gx."
        : "Could not find genesis_plus_gx in Nostalgist runtime.",
    });
    checks.push({
      name: "Core delivery policy",
      state: hasCdnPath ? "warning" : "missing",
      detail: hasCdnPath
        ? "Current Play uses Nostalgist's dev CDN core path; no core is bundled."
        : "Could not identify the dev CDN core path used by the current adapter.",
    });
  } catch (error) {
    checks.push({
      name: "Nostalgist runtime",
      state: "missing",
      detail: formatError(error),
    });
  }
}

async function checkTrackedCoreBinaries(checks) {
  const { stdout } = await execFileAsync("git", ["ls-files"], { cwd: rootDir });
  const trackedCoreBinaries = stdout
    .split("\n")
    .filter((file) => /\.(wasm|zip|so|dylib|dll)$/i.test(file))
    .filter((file) => /libretro|genesis|retroarch|core/i.test(file));

  checks.push({
    name: "Tracked core binaries",
    state: trackedCoreBinaries.length === 0 ? "ready" : "missing",
    detail:
      trackedCoreBinaries.length === 0
        ? "No emulator core binaries are tracked in git."
        : `Tracked core binaries found: ${trackedCoreBinaries.join(", ")}`,
  });
}

async function checkCoreCdn(checks) {
  try {
    const response = await fetch(coreCdnUrl, { method: "HEAD" });
    checks.push({
      name: "Dev CDN core",
      state: response.ok ? "ready" : "missing",
      detail: response.ok
        ? `Reachable: ${coreCdnUrl}`
        : `CDN returned ${response.status} ${response.statusText}.`,
    });
  } catch (error) {
    checks.push({
      name: "Dev CDN core",
      state: "missing",
      detail: formatError(error),
    });
  }
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
