#!/usr/bin/env node
import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const defaultOut = path.join(rootDir, "artifacts", "phase9", "live-game-audit", "readiness.json");

function parseArgs(argv) {
  const args = {
    appUrl: "http://127.0.0.1:1420/",
    out: defaultOut,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--app-url") {
      args.appUrl = argv[++index];
    } else if (arg === "--out") {
      args.out = path.resolve(argv[++index]);
    } else if (arg === "--json") {
      args.json = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage: scripts/check-live-game-audit-readiness.mjs [options]

Writes a readiness report for the live Drive16 generated-game audit. It does
not run model prompts; it checks whether the local app/tooling can support the
Snake/Pong/Tetris/Asteroids audit.

Options:
  --app-url <url>   Local app URL to probe. Default: http://127.0.0.1:1420/
  --out <file>      JSON report path. Default: artifacts/phase9/live-game-audit/readiness.json
  --json            Print full JSON instead of a compact summary.
`);
}

function compact(text) {
  return text.replace(/\s+/g, " ").trim();
}

async function runCheck(id, label, command, args, options = {}) {
  try {
    const result = await execFileAsync(command, args, {
      cwd: rootDir,
      timeout: options.timeout ?? 60000,
      maxBuffer: 1024 * 1024 * 4,
    });
    const output = compact(`${result.stdout ?? ""}\n${result.stderr ?? ""}`);
    return {
      id,
      label,
      status: "pass",
      requiredForLiveAudit: options.requiredForLiveAudit ?? true,
      detail: output || `${label} passed.`,
      command: [command, ...args].join(" "),
    };
  } catch (error) {
    const output = compact(`${error.stdout ?? ""}\n${error.stderr ?? ""}`) || String(error.message ?? error);
    return {
      id,
      label,
      status: options.warningOnFailure ? "warning" : "fail",
      requiredForLiveAudit: options.requiredForLiveAudit ?? true,
      detail: output,
      command: [command, ...args].join(" "),
    };
  }
}

function probeHttp(url, timeout = 5000) {
  return new Promise((resolve) => {
    const request = http.get(url, { timeout }, (response) => {
      response.resume();
      resolve({
        statusCode: response.statusCode ?? 0,
        ok: response.statusCode >= 200 && response.statusCode < 400,
      });
    });
    request.on("timeout", () => {
      request.destroy(new Error(`Timed out after ${timeout}ms`));
    });
    request.on("error", (error) => {
      resolve({ statusCode: 0, ok: false, error: String(error.message ?? error) });
    });
  });
}

async function appPreviewCheck(appUrl) {
  const result = await probeHttp(appUrl);
  if (result.ok) {
    return {
      id: "appPreview",
      label: "Local app preview",
      status: "pass",
      requiredForLiveAudit: true,
      detail: `${appUrl} returned HTTP ${result.statusCode}.`,
      command: `GET ${appUrl}`,
    };
  }
  return {
    id: "appPreview",
    label: "Local app preview",
    status: "fail",
    requiredForLiveAudit: true,
    detail: result.error ?? `${appUrl} returned HTTP ${result.statusCode}.`,
    command: `GET ${appUrl}`,
  };
}

function credentialStatus(opencodeCheck) {
  if (opencodeCheck.status === "pass" && /OpenRouter credential detected/i.test(opencodeCheck.detail)) {
    return {
      id: "openRouterCredential",
      label: "OpenRouter credential",
      status: "pass",
      requiredForLiveAudit: true,
      detail: "OpenCode reports an OpenRouter credential.",
      command: opencodeCheck.command,
    };
  }
  return {
    id: "openRouterCredential",
    label: "OpenRouter credential",
    status: "fail",
    requiredForLiveAudit: true,
    detail: "OpenRouter credential was not detected by the OpenCode config check.",
    command: opencodeCheck.command,
  };
}

function comfyUiMode(comfyCheck) {
  if (comfyCheck.status === "pass") return "ready";
  return "fallback-disclosed";
}

function summarize(report) {
  const requiredFailures = report.checks.filter(
    (check) => check.requiredForLiveAudit && check.status === "fail",
  );
  const warnings = report.checks.filter((check) => check.status === "warning");
  return [
    `Primitive/fallback audit readiness: ${report.readyForPrimitiveAudit ? "ready" : "not ready"}`,
    `Generated-sprite audit readiness: ${report.readyForGeneratedSpriteAudit ? "ready" : "not ready"}`,
    `Report: ${path.relative(rootDir, report.reportPath)}`,
    requiredFailures.length
      ? `Required blockers: ${requiredFailures.map((check) => `${check.label}: ${check.detail}`).join(" | ")}`
      : "Required blockers: none",
    warnings.length
      ? `Warnings: ${warnings.map((check) => `${check.label}: ${check.detail}`).join(" | ")}`
      : "Warnings: none",
  ].join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const appCheck = await appPreviewCheck(args.appUrl);
  const opencodeCheck = await runCheck(
    "opencodeConfig",
    "OpenCode config and MCP tools",
    "python3",
    ["scripts/validate-opencode-config.py"],
    { timeout: 90000 },
  );
  const dockerCheck = await runCheck(
    "docker",
    "Docker daemon for SGDK builds",
    "docker",
    ["info", "--format", "{{.ServerVersion}}"],
  );
  const comfyCheck = await runCheck(
    "comfyUi",
    "ComfyUI sprite readiness",
    "python3",
    ["scripts/check-phase4-comfyui-readiness.py"],
    { requiredForLiveAudit: false, warningOnFailure: true },
  );
  const contractCheck = await runCheck(
    "agentContract",
    "Agent/UI contract checks",
    "pnpm",
    ["--dir", "app", "verify:agent-contract"],
    { timeout: 120000 },
  );
  const memoryCheck = await runCheck(
    "projectMemoryGates",
    "Project memory gates",
    "pnpm",
    ["--dir", "app", "verify:project-memory"],
    { timeout: 120000 },
  );
  const auditVerifierCheck = await runCheck(
    "liveAuditVerifier",
    "Live audit verifier self-test",
    "pnpm",
    ["--dir", "app", "verify:live-game-audit"],
    { timeout: 120000 },
  );

  const checks = [
    appCheck,
    opencodeCheck,
    credentialStatus(opencodeCheck),
    dockerCheck,
    comfyCheck,
    contractCheck,
    memoryCheck,
    auditVerifierCheck,
  ];
  const requiredFailures = checks.filter((check) => check.requiredForLiveAudit && check.status === "fail");
  const readyForPrimitiveAudit = requiredFailures.length === 0;
  const readyForGeneratedSpriteAudit = readyForPrimitiveAudit && comfyCheck.status === "pass";
  const report = {
    generatedAt: new Date().toISOString(),
    reportPath: args.out,
    appUrl: args.appUrl,
    // Backward-compatible alias for existing tooling. This means the audit can
    // run with primitive/fallback graphics and honest ComfyUI disclosure.
    readyForLiveAudit: readyForPrimitiveAudit,
    readyForPrimitiveAudit,
    readyForGeneratedSpriteAudit,
    comfyUiMode: comfyUiMode(comfyCheck),
    checks,
    nextAction:
      requiredFailures.length > 0
        ? `Fix required blocker: ${requiredFailures[0].label}.`
        : !readyForGeneratedSpriteAudit
          ? "Run the primitive/fallback live audit now, or launch ComfyUI before generated-sprite audit runs."
        : "Run the native Snake/Pong/Tetris/Asteroids prompt audit and fill report.json.",
  };

  await mkdir(path.dirname(args.out), { recursive: true });
  await writeFile(args.out, `${JSON.stringify(report, null, 2)}\n`);

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(summarize(report));
  }

  if (!report.readyForLiveAudit) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
