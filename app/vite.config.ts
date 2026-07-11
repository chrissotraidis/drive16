import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execFile } from "node:child_process";
import {
  cpSync,
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const browserTestRom = fileURLToPath(
  new URL("../artifacts/phase9/tetris-recovery/rom.bin", import.meta.url),
);
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const activeProject = join(repoRoot, "artifacts/phase3/active-project");
const previousActiveProject = join(repoRoot, "artifacts/phase3/active-project.previous");
const activeRom = join(activeProject, "out/rom.bin");
const blankStarter = join(repoRoot, "examples/app-starter-blank");
const browserSkeletons = [
  ["missile command", "examples/game-skeletons/missile-command-basic"],
  ["snake", "examples/game-skeletons/snake-basic"],
  ["pong", "examples/game-skeletons/pong-basic"],
  ["tetris", "examples/game-skeletons/tetris-basic"],
  ["asteroids", "examples/game-skeletons/asteroids-basic"],
] as const;
const execFileAsync = promisify(execFile);

function sendJson(response: import("node:http").ServerResponse, value: unknown) {
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(value));
}

function latestModifiedAt(path: string): number {
  if (!existsSync(path)) return 0;
  const entry = statSync(path);
  if (!entry.isDirectory()) return entry.mtimeMs;
  return readdirSync(path).reduce(
    (latest, child) => Math.max(latest, latestModifiedAt(join(path, child))),
    0,
  );
}

function copyCleanProject(source: string) {
  if (!existsSync(source)) throw new Error(`Project template is missing: ${source}`);
  rmSync(activeProject, { recursive: true, force: true });
  cpSync(source, activeProject, { recursive: true, force: true });
  rmSync(join(activeProject, "out"), { recursive: true, force: true });
}

function resetBrowserProject() {
  let preserved = false;
  if (existsSync(activeProject)) {
    rmSync(previousActiveProject, { recursive: true, force: true });
    renameSync(activeProject, previousActiveProject);
    preserved = true;
  }
  try {
    copyCleanProject(blankStarter);
  } catch (error) {
    if (preserved && !existsSync(activeProject)) {
      renameSync(previousActiveProject, activeProject);
    }
    throw error;
  }
  return {
    ...activeProjectStatus(),
    created: true,
    detail: "Active project reset from the blank starter template",
  };
}

function matchingSkeleton(prompt: string) {
  const normalized = prompt.toLowerCase();
  return browserSkeletons.find(([genre]) => normalized.includes(genre));
}

function seedBrowserProject(prompt: string) {
  const match = matchingSkeleton(prompt);
  const mainPath = join(activeProject, "src/main.c");
  const currentSource = existsSync(mainPath) ? readFileSync(mainPath, "utf8") : "";
  const blankStarter =
    currentSource.split("\n").length <= 40 &&
    currentSource.includes("VDP_setScreenWidth320") &&
    currentSource.includes("while (TRUE)") &&
    !currentSource.includes("JOY_readJoypad");
  if (!match || !blankStarter) {
    return {
      generatedAt: new Date().toISOString(),
      status: "skipped",
      detail: !match
        ? "No starter seed matched this prompt"
        : "Active project already has game code; starter seed not applied",
      projectPath: activeProject,
      romPath: activeRom,
      applied: false,
      source: null,
    };
  }

  const [, source] = match;
  copyCleanProject(join(repoRoot, source));
  const result = {
    generatedAt: new Date().toISOString(),
    status: "seeded",
    detail: `Loaded ${match[0]} starter code into the clean active project`,
    projectPath: activeProject,
    romPath: activeRom,
    applied: true,
    source,
  };
  return result;
}

async function buildBrowserProject() {
  const buildScript = join(repoRoot, "scripts/build-sgdk.sh");
  await execFileAsync(buildScript, [activeProject], {
    cwd: repoRoot,
    timeout: 15 * 60_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  const status = activeProjectStatus();
  if (!status.romExists) {
    throw new Error(`Baseline build finished without a current ROM: ${status.detail}`);
  }
  return {
    ...status,
    detail: "Seeded baseline ROM built and ready for immediate preview",
  };
}

async function verifyBrowserProject() {
  if (!existsSync(activeRom)) {
    throw new Error("Build the active project before running browser verification");
  }

  const sourcePath = join(activeProject, "src/main.c");
  const source = existsSync(sourcePath) ? readFileSync(sourcePath, "utf8") : "";
  const gamePath = join(activeProject, "GAME.md");
  const gameNotes = existsSync(gamePath) ? readFileSync(gamePath, "utf8") : "";
  const game = detectedGame(`${source}\n${gameNotes}`).replace(" ", "-");
  if (game === "unknown") {
    throw new Error("Drive16 could not identify the active project's interaction profile");
  }

  await execFileAsync("python3", [
    join(repoRoot, "scripts/validate-emulator-mcp.py"),
    "--rom",
    activeRom,
    "--verify-screen",
  ], {
    cwd: repoRoot,
    timeout: 2 * 60_000,
    maxBuffer: 8 * 1024 * 1024,
  });

  const audio = await execFileAsync("python3", [
    join(repoRoot, "scripts/validate-emulator-audio-mcp.py"),
    "--rom",
    activeRom,
  ], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 2 * 60_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  const audioMaxAbs = Number(audio.stdout.match(/max_abs=(\d+)/)?.[1] ?? 0);

  const evidenceDirectory = join(repoRoot, "artifacts/phase1/emulator");
  const interactionPath = join(evidenceDirectory, "browser-interaction.json");
  mkdirSync(evidenceDirectory, { recursive: true });
  try {
    await execFileAsync("python3", [
      join(repoRoot, "scripts/verify-skeleton-interaction.py"),
      game,
      activeRom,
      "--out",
      interactionPath,
    ], {
      cwd: repoRoot,
      timeout: 2 * 60_000,
      maxBuffer: 8 * 1024 * 1024,
    });
  } catch (error) {
    if (!existsSync(interactionPath)) throw error;
  }
  const interaction = JSON.parse(readFileSync(interactionPath, "utf8")) as {
    inputChangedFrame?: boolean;
    idleSurvives15Seconds?: boolean;
    restartMatchedFreshState?: boolean;
    visibleRestartPathTested?: string;
  };

  const result = {
    generatedAt: new Date().toISOString(),
    status: "diagnostic",
    detail:
      "Low-level browser diagnostics completed. These checks cannot award Playable or Reviewed.",
    romPath: activeRom,
    screenVisible: true,
    inputChanged: interaction.inputChangedFrame === true,
    idleSurvives15Seconds: interaction.idleSurvives15Seconds === true,
    restartMatched: interaction.restartMatchedFreshState === true,
    restartPath: interaction.visibleRestartPathTested ?? "unknown",
    audioMaxAbs,
  };
  return result;
}

let browserVerification:
  | {
      romModifiedAt: number;
      result: Awaited<ReturnType<typeof verifyBrowserProject>>;
    }
  | undefined;
let browserVerificationPromise:
  | Promise<Awaited<ReturnType<typeof verifyBrowserProject>>>
  | undefined;

async function cachedBrowserProjectVerification() {
  const romModifiedAt = statSync(activeRom).mtimeMs;
  if (browserVerification?.romModifiedAt === romModifiedAt) {
    return browserVerification.result;
  }
  if (browserVerificationPromise) return browserVerificationPromise;

  browserVerificationPromise = verifyBrowserProject()
    .then((result) => {
      browserVerification = { romModifiedAt, result };
      return result;
    })
    .finally(() => {
      browserVerificationPromise = undefined;
    });
  return browserVerificationPromise;
}

async function readJsonBody(request: import("node:http").IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

function detectedGame(text: string) {
  const normalized = text.toLowerCase();
  for (const game of ["missile command", "snake", "pong", "tetris", "asteroids"]) {
    if (normalized.includes(game)) return game;
  }
  return "unknown";
}

function activeProjectStatus() {
  const romExists = existsSync(activeRom);
  const sourceModifiedAt = Math.max(
    latestModifiedAt(join(activeProject, "src")),
    latestModifiedAt(join(activeProject, "res")),
  );
  const romModifiedAt = romExists ? statSync(activeRom).mtimeMs : 0;
  const stale = romExists && sourceModifiedAt > romModifiedAt;
  return {
    generatedAt: new Date().toISOString(),
    status: stale ? "stale" : romExists ? "ready" : "missing",
    detail: stale
      ? "Project source is newer than the ROM"
      : romExists
        ? "Active project ROM is ready"
        : "Active project has no ROM yet",
    projectPath: activeProject,
    agentProjectPath: activeProject,
    romPath: activeRom,
    romExists: romExists && !stale,
    created: false,
  };
}

function activeProjectAudit() {
  const required = ["GAME.md", "ASSETS.md", "PLAYTEST.md"];
  const files = required.map((name) => {
    const path = join(activeProject, name);
    return {
      name,
      status: existsSync(path) ? "ready" : "missing",
      detail: existsSync(path) ? `${name} found` : `${name} is missing`,
    };
  });
  const playtestPath = join(activeProject, "PLAYTEST.md");
  const gamePath = join(activeProject, "GAME.md");
  const mainPath = join(activeProject, "src/main.c");
  const playtest = existsSync(playtestPath) ? readFileSync(playtestPath, "utf8") : "";
  const game = existsSync(gamePath) ? readFileSync(gamePath, "utf8") : "";
  const source = existsSync(mainPath) ? readFileSync(mainPath, "utf8") : "";
  const gateMatch = playtest.match(/Playability gate:\s*(PASS|FAIL)/i);
  const gate = gateMatch?.[1]?.toLowerCase() ?? "unknown";
  const missing = files.filter((file) => file.status !== "ready");
  const warnings: string[] = [];
  const sourceGame = detectedGame(source);
  const memoryGame = detectedGame(`${game}\n${playtest}`);
  if (sourceGame !== "unknown" && memoryGame !== "unknown" && sourceGame !== memoryGame) {
    warnings.push(`Project notes describe ${memoryGame}, but src/main.c contains ${sourceGame}`);
  }
  if (
    gate === "pass" &&
    existsSync(playtestPath) &&
    latestModifiedAt(join(activeProject, "src")) > statSync(playtestPath).mtimeMs
  ) {
    warnings.push("PLAYTEST.md pass predates the latest game source change");
  }
  return {
    generatedAt: new Date().toISOString(),
    status: missing.length ? "missing" : gate === "pass" && !warnings.length ? "ready" : "warning",
    detail: missing.length
      ? missing.map((file) => file.detail).join("; ")
      : warnings.length
        ? warnings.join("; ")
      : gate === "pass"
        ? "Project notes report a passing playability gate"
        : "Project notes do not report a passing playability gate",
    projectPath: activeProject,
    gate,
    files,
  };
}

function activeProjectAssetRoles() {
  const assetPath = join(activeProject, "ASSETS.md");
  if (!existsSync(assetPath)) return [];
  return readFileSync(assetPath, "utf8")
    .split("\n")
    .filter((line) => line.trim().startsWith("|") && line.trim().endsWith("|"))
    .map((line) => line.trim().slice(1, -1).split("|").map((cell) => cell.trim()))
    .filter(
      (cells) =>
        cells.length >= 5 &&
        cells[0].toLowerCase() !== "role" &&
        !cells[0].split("").every((character) => character === "-"),
    )
    .map((cells) => ({
      role: cells[0],
      source: cells[1],
      symbol: cells[2],
      status: cells[3],
      notes: cells.slice(4).join(" | "),
    }));
}

function activeProjectSummary() {
  const status = activeProjectStatus();
  const gamePath = join(activeProject, "GAME.md");
  const gameNotes = existsSync(gamePath) ? readFileSync(gamePath, "utf8") : "";
  const playtestPath = join(activeProject, "PLAYTEST.md");
  const playtest = existsSync(playtestPath) ? readFileSync(playtestPath, "utf8") : "";
  const explicitStage = playtest.match(
    /Project stage:\s*(PROTOTYPE|BUILT|PLAYABLE|REVIEWED|FAILED)/i,
  )?.[1]?.toLowerCase();
  const gate = playtest.match(/Playability gate:\s*(PASS|FAIL)/i)?.[1]?.toLowerCase();
  const recoveryLines = gameNotes
    .split("\n")
    .filter((line) => /restart|reset/i.test(line));
  const trustStage = explicitStage
    ? explicitStage
    : !status.romExists
      ? "prototype"
      : gate === "pass"
        ? "playable"
        : "built";
  return {
    generatedAt: status.generatedAt,
    name: "Active Project",
    projectPath: activeProject,
    romPath: activeRom,
    exportDirectory: join(repoRoot, "artifacts/phase3/exports"),
    romStatus: status.romExists ? "ready" : status.status === "stale" ? "warning" : "missing",
    romDetail: status.detail,
    trustStage,
    reviewDetail:
      trustStage === "reviewed"
        ? "Human-visible quality review passed"
        : trustStage === "failed"
          ? "Visible quality review failed; see PLAYTEST.md"
          : trustStage === "playable"
            ? "Semantic playability gate passed; final human-visible review is pending"
            : trustStage === "built"
              ? "ROM built; semantic playability and visible quality review are pending"
              : "No current playable or reviewed ROM exists",
    restartAction: recoveryLines.some((line) => /\bC\b/i.test(line))
      ? "button.c"
      : recoveryLines.some((line) => /\bStart\b/i.test(line))
        ? "button.start"
        : null,
    assetRoles: activeProjectAssetRoles(),
    files: [
      { label: "Main C", path: join(activeProject, "src/main.c"), state: "ready" },
      { label: "Resources", path: join(activeProject, "res/resources.res"), state: "ready" },
      {
        label: "ROM",
        path: activeRom,
        state: status.romExists ? "ready" : status.status === "stale" ? "warning" : "missing",
      },
    ],
  };
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: "drive16-browser-test-rom",
      configureServer(server) {
        server.middlewares.use("/__drive16_test_rom.bin", (_request, response) => {
          if (!existsSync(browserTestRom)) {
            response.statusCode = 404;
            response.end("Recovered browser test ROM is missing.");
            return;
          }
          response.setHeader("Content-Type", "application/octet-stream");
          response.setHeader("Content-Length", statSync(browserTestRom).size);
          createReadStream(browserTestRom).pipe(response);
        });
        server.middlewares.use("/__drive16_project", async (request, response) => {
          if (request.url === "/rom") {
            if (!existsSync(activeRom)) {
              response.statusCode = 404;
              response.end("Active project ROM is missing.");
              return;
            }
            response.setHeader("Content-Type", "application/octet-stream");
            response.setHeader("Content-Length", statSync(activeRom).size);
            createReadStream(activeRom).pipe(response);
            return;
          }
          if (request.url === "/audit") {
            sendJson(response, activeProjectAudit());
            return;
          }
          if (request.url === "/summary") {
            sendJson(response, activeProjectSummary());
            return;
          }
          if (request.url === "/reset" && request.method === "POST") {
            try {
              sendJson(response, resetBrowserProject());
            } catch (error) {
              response.statusCode = 500;
              response.end(error instanceof Error ? error.message : "Project reset failed");
            }
            return;
          }
          if (request.url === "/seed" && request.method === "POST") {
            try {
              const body = await readJsonBody(request);
              sendJson(response, seedBrowserProject(String(body.prompt ?? "")));
            } catch (error) {
              response.statusCode = 500;
              response.end(error instanceof Error ? error.message : "Project seed failed");
            }
            return;
          }
          if (request.url === "/build" && request.method === "POST") {
            try {
              sendJson(response, await buildBrowserProject());
            } catch (error) {
              response.statusCode = 500;
              response.end(error instanceof Error ? error.message : "Project build failed");
            }
            return;
          }
          if (request.url === "/verify" && request.method === "POST") {
            try {
              sendJson(response, await cachedBrowserProjectVerification());
            } catch (error) {
              response.statusCode = 500;
              response.end(error instanceof Error ? error.message : "Project verification failed");
            }
            return;
          }
          sendJson(response, activeProjectStatus());
        });
      },
    },
  ],
  clearScreen: false,
  server: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
    proxy: {
      "/__drive16_opencode": {
        target: "http://127.0.0.1:4096",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/__drive16_opencode/, ""),
      },
      "/__drive16_comfyui": {
        target: "http://127.0.0.1:8188",
        changeOrigin: true,
        proxyTimeout: 5_000,
        rewrite: (path) => path.replace(/^\/__drive16_comfyui/, ""),
      },
    },
  },
});
