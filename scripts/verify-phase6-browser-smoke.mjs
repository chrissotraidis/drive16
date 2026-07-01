#!/usr/bin/env node
import { access, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const requireFromApp = createRequire(path.join(rootDir, "app", "package.json"));

function parseArgs(argv) {
  const args = {
    url: process.env.DRIVE16_VERIFY_URL ?? "http://127.0.0.1:1420/",
    outDir: path.join(rootDir, "artifacts", "phase6", "verify-loop", "browser-smoke"),
    romPath:
      process.env.DRIVE16_VERIFY_ROM ??
      path.join(rootDir, "examples", "app-starter-blank", "out", "rom.bin"),
    timeoutMs: 45000,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--url") {
      args.url = argv[++index];
    } else if (arg === "--out") {
      args.outDir = path.resolve(argv[++index]);
    } else if (arg === "--rom") {
      args.romPath = path.resolve(argv[++index]);
    } else if (arg === "--timeout-ms") {
      args.timeoutMs = Number(argv[++index]);
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs < 1000) {
    throw new Error("--timeout-ms must be at least 1000");
  }

  return args;
}

function printHelp() {
  console.log(`Usage: scripts/verify-phase6-browser-smoke.mjs [options]

Options:
  --url <url>          Drive16 browser preview URL. Default: http://127.0.0.1:1420/
  --out <dir>          Directory for screenshots and browser-smoke.json.
  --rom <path>         Local test ROM to import through the browser file input.
  --timeout-ms <ms>    Interaction timeout. Default: 45000.
`);
}

async function loadPlaywright() {
  try {
    return requireFromApp("playwright");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Playwright could not be loaded";
    throw new Error(
      `Playwright is not available from app/node_modules. Run 'pnpm --dir app install'. ${message}`,
    );
  }
}

async function launchBrowser(chromium) {
  const attempts = [];

  if (process.env.PLAYWRIGHT_EXECUTABLE_PATH) {
    attempts.push({
      label: "PLAYWRIGHT_EXECUTABLE_PATH",
      options: {
        executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
        headless: true,
      },
    });
  }

  attempts.push({
    label: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
    options: {
      channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
      headless: true,
    },
  });
  attempts.push({
    label: "bundled chromium",
    options: {
      headless: true,
    },
  });

  const failures = [];
  for (const attempt of attempts) {
    try {
      return {
        browser: await chromium.launch(attempt.options),
        launchLabel: attempt.label,
      };
    } catch (error) {
      failures.push(`${attempt.label}: ${error instanceof Error ? error.message : error}`);
    }
  }

  throw new Error(
    [
      "Could not launch a browser for Phase 6 smoke verification.",
      "Install a Playwright browser with 'pnpm --dir app exec playwright install chromium'",
      "or set PLAYWRIGHT_EXECUTABLE_PATH to a local Chrome/Chromium executable.",
      ...failures,
    ].join("\n"),
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await mkdir(args.outDir, { recursive: true });
  try {
    await access(args.romPath);
  } catch {
    throw new Error(
      `Browser smoke test ROM is missing: ${args.romPath}. Build or provide one with --rom <path>.`,
    );
  }

  const { chromium } = await loadPlaywright();
  const { browser, launchLabel } = await launchBrowser(chromium);
  const errors = [];
  const warnings = [];
  const screenshots = [];
  const states = {};

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(args.timeoutMs);
    page.on("console", (message) => {
      const entry = `${message.type()}: ${message.text()}`;
      if (message.type() === "error") {
        errors.push(entry);
      } else if (message.type() === "warning" || message.type() === "warn") {
        warnings.push(entry);
      }
    });
    page.on("pageerror", (error) => {
      errors.push(`pageerror: ${error.message}`);
    });

    await page.goto(args.url, { waitUntil: "domcontentloaded" });
    await page.getByText("Drive16").first().waitFor();

    states.identity = {
      url: page.url(),
      title: await page.title(),
    };
    if (states.identity.title !== "Drive16") {
      throw new Error(`Expected title Drive16, saw ${states.identity.title}`);
    }

    states.initial = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      return {
        textSample: bodyText.slice(0, 500),
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        frameworkOverlay: /Internal server error|Failed to compile|vite error/i.test(bodyText),
      };
    });
    if (states.initial.frameworkOverlay) {
      throw new Error("Framework error overlay text is visible.");
    }
    if (!states.initial.textSample.includes("Drive16")) {
      throw new Error("Rendered page did not contain meaningful Drive16 content.");
    }

    await screenshot(page, args.outDir, screenshots, "01-initial.png");

    await page.getByTestId("project-menu-toggle").click();
    await page.getByTestId("project-menu").waitFor();
    await screenshot(page, args.outDir, screenshots, "02-project-menu.png");

    await page.getByTestId("menu-new-project").click();
    await page.getByTestId("project-menu").waitFor({ state: "detached" });
    await page.waitForFunction(() => {
      const feedback =
        document.querySelector('[data-testid="rom-action-feedback"]')?.textContent ?? "";
      return /New starter project|blank starter|starter project/i.test(feedback);
    });
    states.newProjectFeedback = await visibleText(page, "rom-action-feedback");

    await page.getByTestId("save-project").click();
    await page.waitForFunction(() => {
      const feedback =
        document.querySelector('[data-testid="rom-action-feedback"]')?.textContent ?? "";
      return /save|saved|snapshot|project/i.test(feedback);
    });
    states.saveFeedback = await visibleText(page, "rom-action-feedback");

    await page.getByTestId("project-menu-toggle").click();
    await page.getByTestId("project-menu").waitFor();
    await page.getByTestId("menu-open-project").click();
    await page.waitForFunction(() => {
      const feedback =
        document.querySelector('[data-testid="menu-action-status"]')?.textContent ?? "";
      return /Project opened|snapshot/i.test(feedback);
    });
    states.openFeedback = await visibleText(page, "menu-action-status");
    states.openProjectSummary = await visibleText(page, "project-summary");

    await page.getByTestId("rom-import-input").setInputFiles(args.romPath);
    await page.waitForFunction(() => {
      const feedback = document.querySelector('[data-testid="rom-action-feedback"]')?.textContent ?? "";
      return /Imported ROM proof captured|proof captured|Browser preview is using simulated frames/i.test(feedback);
    });
    states.importFeedback = await visibleText(page, "rom-action-feedback");

    await page
      .locator('[data-testid="project-menu"] button[aria-label="Close project menu"]')
      .click();
    await page.getByTestId("project-menu").waitFor({ state: "detached" });
    await page.getByTestId("rom-focus-control").click();
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(() => {
      return document.querySelector('[data-testid="rom-last-input"]')?.textContent?.includes("Right");
    });
    states.lastInput = await visibleText(page, "rom-last-input");

    await page.getByTestId("play-active-rom").click();
    await page.waitForFunction(() => {
      const feedback = document.querySelector('[data-testid="rom-action-feedback"]')?.textContent ?? "";
      return /Interactive player started|Play setup failed|Player core needed/i.test(feedback);
    });
    states.playFeedback = await visibleText(page, "rom-action-feedback");
    if (!/Interactive player started/i.test(states.playFeedback ?? "")) {
      throw new Error(`Interactive Play did not start: ${states.playFeedback}`);
    }

    await page.getByTestId("pause-player").click();
    await page.waitForFunction(() => {
      const feedback = document.querySelector('[data-testid="rom-action-feedback"]')?.textContent ?? "";
      return /paused/i.test(feedback);
    });
    states.pauseFeedback = await visibleText(page, "rom-action-feedback");

    await page.getByTestId("pause-player").click();
    await page.waitForFunction(() => {
      const feedback = document.querySelector('[data-testid="rom-action-feedback"]')?.textContent ?? "";
      return /resumed/i.test(feedback);
    });
    states.resumeFeedback = await visibleText(page, "rom-action-feedback");

    await page.getByTestId("reset-player").click();
    await page.waitForFunction(() => {
      const feedback = document.querySelector('[data-testid="rom-action-feedback"]')?.textContent ?? "";
      return /reset/i.test(feedback);
    });
    states.resetFeedback = await visibleText(page, "rom-action-feedback");

    await page.getByTestId("stop-player").click();
    await page.waitForFunction(() => {
      const feedback = document.querySelector('[data-testid="rom-action-feedback"]')?.textContent ?? "";
      return /stopped/i.test(feedback);
    });
    states.stopFeedback = await visibleText(page, "rom-action-feedback");
    await screenshot(page, args.outDir, screenshots, "03-player-stopped.png");

    await page.getByTestId("verify-rom").click();
    await page.waitForFunction(() => {
      const feedback = document.querySelector('[data-testid="run-status"]')?.textContent ?? "";
      return /proof captured|captured/i.test(feedback);
    });
    states.verifyFeedback = await visibleText(page, "run-status");

    await page.getByTestId("export-rom").click();
    await page.waitForFunction(() => {
      const feedback = document.querySelector('[data-testid="rom-action-feedback"]')?.textContent ?? "";
      return /export/i.test(feedback);
    });
    states.exportFeedback = await visibleText(page, "rom-action-feedback");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByText("Drive16").first().waitFor();
    states.mobileLayout = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    }));
    if (states.mobileLayout.hasHorizontalOverflow) {
      throw new Error(
        `Mobile layout has horizontal overflow: ${states.mobileLayout.scrollWidth}px > ${states.mobileLayout.clientWidth}px`,
      );
    }
    await screenshot(page, args.outDir, screenshots, "04-mobile.png");

    const summary = {
      status: "passed",
      checkedAt: new Date().toISOString(),
      url: args.url,
      romPath: args.romPath,
      browser: launchLabel,
      screenshots,
      states,
      warnings,
      errors,
    };
    await writeFile(
      path.join(args.outDir, "browser-smoke.json"),
      `${JSON.stringify(summary, null, 2)}\n`,
    );

    if (errors.length > 0) {
      throw new Error(`Browser console/page errors were captured: ${errors.join(" | ")}`);
    }

    console.log(`Phase 6 browser smoke passed. Evidence: ${args.outDir}`);
  } finally {
    await browser.close();
  }
}

async function screenshot(page, outDir, screenshots, name) {
  const file = path.join(outDir, name);
  await page.screenshot({ path: file, fullPage: false });
  screenshots.push(file);
}

async function visibleText(page, testId) {
  return page
    .getByTestId(testId)
    .textContent()
    .then((text) => text?.replace(/\s+/g, " ").trim() ?? "");
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
