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
    coreStatus: process.env.DRIVE16_VERIFY_CORE_STATUS ?? "dev-only",
    userCorePath: process.env.DRIVE16_VERIFY_USER_CORE
      ? path.resolve(process.env.DRIVE16_VERIFY_USER_CORE)
      : undefined,
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
    } else if (arg === "--core-status") {
      args.coreStatus = argv[++index];
    } else if (arg === "--user-core") {
      args.userCorePath = path.resolve(argv[++index]);
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
  if (!["available", "dev-only", "missing", "needs-user-action", "unsupported"].includes(args.coreStatus)) {
    throw new Error(
      "--core-status must be one of available, dev-only, missing, needs-user-action, unsupported",
    );
  }
  if (args.coreStatus === "available" && !args.userCorePath) {
    throw new Error("--core-status available requires --user-core so Play uses a real selected core.");
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
  --core-status <mode> Interactive core status override for verification.
                       One of: available, dev-only, missing, needs-user-action, unsupported.
                       Default: dev-only.
  --user-core <path>   Optional local .zip or .js/.wasm file path for Set Up Play.
                       When present, the smoke imports it and does not use a status override.
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
  if (args.userCorePath) {
    try {
      await access(args.userCorePath);
    } catch {
      throw new Error(`User core fixture is missing: ${args.userCorePath}`);
    }
  }

  const { chromium } = await loadPlaywright();
  const { browser, launchLabel } = await launchBrowser(chromium);
  const errors = [];
  const warnings = [];
  const screenshots = [];
  const states = {};
  let openRouterCompletionRequests = 0;

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "getGamepads", {
        configurable: true,
        value: () => [],
      });
    });
    if (!args.userCorePath) {
      await context.addInitScript((coreStatus) => {
        window.localStorage.setItem("drive16.interactiveCoreStatusOverride", coreStatus);
      }, args.coreStatus);
    }
    await context.route("https://openrouter.ai/api/v1/key", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            label: "Drive16 smoke",
          },
        }),
      });
    });
    await context.route("https://openrouter.ai/api/v1/chat/completions", async (route) => {
      openRouterCompletionRequests += 1;
      const requestBody = route.request().postDataJSON();
      if (requestBody?.model !== "deepseek/deepseek-chat-v3.1") {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            error: {
              message: `Unexpected model ${requestBody?.model ?? "missing"}`,
            },
          }),
        });
        return;
      }
      const lastUserMessage = [...(requestBody?.messages ?? [])]
        .reverse()
        .find((message) => message?.role === "user")?.content ?? "";
      const content = /smoke overclaim guard/i.test(lastUserMessage)
        ? "ROM built successfully. A sprite is on screen and music is playing."
        : "Mocked OpenRouter live reply for Drive16 smoke.";
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          model: requestBody.model,
          choices: [
            {
              message: {
                content,
              },
            },
          ],
          usage: {
            prompt_tokens: 21,
            completion_tokens: 9,
            total_tokens: 30,
          },
        }),
      });
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

    await submitComposer(page, "What should I build next?");
    await page.getByText(/OpenRouter needs a session key/i).last().waitFor();
    states.freeformGateMessage = await newestMessageText(page);
    if (!/OpenRouter needs a session key/i.test(states.freeformGateMessage)) {
      throw new Error(`No-key freeform gate did not explain the missing key: ${states.freeformGateMessage}`);
    }
    if (openRouterCompletionRequests !== 0) {
      throw new Error("OpenRouter completion was called before the key was tested.");
    }

    const smokeOpenRouterKey = "drive16-smoke-openrouter-key";

    await page.getByTestId("agent-settings-open").click();
    await page.getByTestId("openrouter-settings").waitFor();
    await page.getByLabel("OpenRouter API key").fill(smokeOpenRouterKey);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByTestId("agent-settings-open").waitFor();
    await page.getByTestId("agent-settings-open").click();
    await page.getByTestId("openrouter-settings").waitFor();
    const restoredOpenRouterKey = await page.getByLabel("OpenRouter API key").inputValue();
    if (restoredOpenRouterKey !== smokeOpenRouterKey) {
      throw new Error("OpenRouter session key did not survive reload in the same app window.");
    }
    states.openRouterSessionKeyRestored = "OpenRouter session key survived reload.";
    await page.getByRole("button", { name: "Test OpenRouter" }).click();
    await page.waitForFunction(() => {
      const status =
        document.querySelector('[data-testid="model-connection-status"]')?.textContent ?? "";
      return /Connected|OpenRouter key accepted/i.test(status);
    });
    states.openRouterConnection = await visibleText(page, "model-connection-status");
    await page.getByRole("button", { name: "Close settings" }).click();
    await page.getByTestId("openrouter-settings").waitFor({ state: "detached" });
    await page.getByLabel("Message Drive16").waitFor();
    states.chatRailProviderLeak = await page.evaluate(() => {
      const chatRail = document.querySelector(".chat-rail")?.textContent ?? "";
      return /OpenRouter live/i.test(chatRail);
    });
    if (states.chatRailProviderLeak) {
      throw new Error("Conversation rail still shows OpenRouter live provider status.");
    }

    await submitComposer(page, "Give me one compact idea for a Genesis demo.");
    await page.getByText("Mocked OpenRouter live reply for Drive16 smoke.").waitFor();
    states.openRouterReply = await newestMessageText(page);
    if (openRouterCompletionRequests !== 1) {
      throw new Error(`Expected one OpenRouter completion request, saw ${openRouterCompletionRequests}.`);
    }

    await submitComposer(page, "smoke overclaim guard");
    await page
      .getByText(/ROM built successfully\. A sprite is on screen and music is playing\./i)
      .waitFor();
    states.openRouterSecondReply = await newestMessageText(page);
    if (openRouterCompletionRequests !== 2) {
      throw new Error(`Expected two OpenRouter completion requests, saw ${openRouterCompletionRequests}.`);
    }

    await submitComposer(page, "Make a sprite I can move left and right with music.");
    await page.getByText(/Previewed the bundled sprite\/music demo/i).last().waitFor();
    states.corePromptReply = await newestMessageText(page);
    if (openRouterCompletionRequests !== 2) {
      throw new Error("CORE sprite/music prompt unexpectedly called OpenRouter.");
    }

    if (args.userCorePath) {
      await page.getByTestId("core-import-input").setInputFiles(args.userCorePath);
      await page.waitForFunction(() => {
        const feedback =
          document.querySelector('[data-testid="rom-action-feedback"]')?.textContent ?? "";
        return /Play core ready|User-supplied Genesis core ready/i.test(feedback);
      });
      states.userCoreFeedback = await visibleText(page, "rom-action-feedback");
      await screenshot(page, args.outDir, screenshots, "01b-user-core-ready.png");
    }

    await page.getByTestId("project-menu-toggle").click();
    await page.getByTestId("project-menu").waitFor();
    states.projectMenu = await visibleText(page, "project-menu");
    for (const expectedAction of [
      "New Project",
      "Save Project",
      "Open Last Save",
      "Import ROM",
      "Import Test ROM",
      "Export ROM",
      "Verify",
    ]) {
      if (!states.projectMenu.includes(expectedAction)) {
        throw new Error(`Project menu is missing ${expectedAction}`);
      }
    }
    if (!/Set Up Play|Replace Play Core/i.test(states.projectMenu)) {
      throw new Error("Project menu is missing the Play core setup action.");
    }
    await page.getByTestId("project-summary").waitFor();
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
      return /Imported ROM ready|Browser preview is using simulated frames/i.test(feedback);
    });
    states.importFeedback = await visibleText(page, "rom-action-feedback");

    await page
      .locator('[data-testid="project-menu"] button[aria-label="Close project menu"]')
      .click();
    await page.getByTestId("project-menu").waitFor({ state: "detached" });
    await page.getByTestId("starter-rom-screen").click();
    await page.keyboard.press("ArrowRight");

    await page.getByTestId("open-controls").click();
    await page.getByTestId("controls-panel").waitFor();
    await page.waitForFunction(() => {
      return document.querySelector('[data-testid="rom-last-input"]')?.textContent?.includes("Right");
    });
    states.lastInput = await visibleText(page, "rom-last-input");
    states.visibleKeyboardMapping = await visibleText(page, "rom-controls");
    for (const expectedMapping of ["Arrows", "Z", "X", "C", "Enter"]) {
      if (!states.visibleKeyboardMapping.includes(expectedMapping)) {
        throw new Error(`Default keyboard mapping is missing ${expectedMapping}`);
      }
    }
    states.controlsPanel = {
      keyboard: await visibleText(page, "keyboard-readiness"),
      controller: await visibleText(page, "controller-readiness"),
      mapping: await visibleText(page, "controller-mapping-state"),
    };
    if (!/Keyboard ready/i.test(states.controlsPanel.keyboard)) {
      throw new Error(`Controls panel did not report keyboard readiness: ${states.controlsPanel.keyboard}`);
    }
    if (!/Controller unavailable/i.test(states.controlsPanel.controller)) {
      throw new Error(`No-controller state was not truthful: ${states.controlsPanel.controller}`);
    }
    if (!/Default mapping|Mapping not configured/i.test(states.controlsPanel.mapping)) {
      throw new Error(`Controller mapping state was not visible: ${states.controlsPanel.mapping}`);
    }
    await screenshot(page, args.outDir, screenshots, "02b-controls.png");
    await page.getByTestId("reset-input-profile").click();
    await page.waitForFunction(() => {
      return document
        .querySelector('[data-testid="rom-last-input"]')
        ?.textContent?.includes("Input defaults restored");
    });
    states.inputProfileAfterReset = await page.evaluate(() => {
      const stored = window.localStorage.getItem("drive16.inputProfile.v1");
      if (!stored) return undefined;
      const parsed = JSON.parse(stored);
      return {
        source: parsed.source,
        zBinding: parsed.keyboard?.["button.a"]?.label,
        startBinding: parsed.keyboard?.["button.start"]?.label,
        controllerStart: parsed.controller?.["button.start"]?.[0]?.label,
      };
    });
    if (
      states.inputProfileAfterReset?.source !== "local" ||
      states.inputProfileAfterReset?.zBinding !== "Z" ||
      states.inputProfileAfterReset?.startBinding !== "Enter"
    ) {
      throw new Error(
        `Reset defaults did not persist the expected input profile: ${JSON.stringify(states.inputProfileAfterReset)}`,
      );
    }
    await page.getByTestId("close-controls").click();
    await page.getByTestId("controls-panel").waitFor({ state: "detached" });

    await page.getByTestId("play-active-rom").click();
    await page.waitForFunction(() => {
      const feedback = document.querySelector('[data-testid="rom-action-feedback"]')?.textContent ?? "";
      return /Interactive player started|Play setup failed|Play setup needed/i.test(feedback);
    });
    states.playFeedback = await visibleText(page, "rom-action-feedback");
    if (
      canCoreStatusPlay(args.coreStatus, args.userCorePath) &&
      !/Interactive player started/i.test(states.playFeedback ?? "")
    ) {
      throw new Error(`Interactive Play did not start: ${states.playFeedback}`);
    }
    if (
      !canCoreStatusPlay(args.coreStatus, args.userCorePath) &&
      !/Play setup needed|Verify still (available|works)/i.test(states.playFeedback ?? "")
    ) {
      throw new Error(`Missing-core Play did not explain setup: ${states.playFeedback}`);
    }

    if (canCoreStatusPlay(args.coreStatus, args.userCorePath)) {
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
    }
    await screenshot(page, args.outDir, screenshots, "03-player-stopped.png");

    await page.getByTestId("project-menu-toggle").click();
    await page.getByTestId("project-menu").waitFor();
    await page.getByTestId("verify-rom").click();
    await page.getByTestId("project-menu").waitFor({ state: "detached" });
    await page.waitForFunction(() => {
      const feedback = document.querySelector('[data-testid="rom-action-feedback"]')?.textContent ?? "";
      return /Imported ROM verified|Project ROM verified/i.test(feedback);
    });
    states.verifyFeedback = await visibleText(page, "rom-action-feedback");

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
    await page.getByTestId("project-menu-toggle").click();
    await page.getByTestId("project-menu").waitFor();
    states.mobileProjectMenu = await visibleText(page, "project-menu");
    states.mobileMenuLayout = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    }));
    if (states.mobileMenuLayout.hasHorizontalOverflow) {
      throw new Error(
        `Mobile project menu has horizontal overflow: ${states.mobileMenuLayout.scrollWidth}px > ${states.mobileMenuLayout.clientWidth}px`,
      );
    }
    await screenshot(page, args.outDir, screenshots, "04-mobile.png");

    const summary = {
      status: "passed",
      checkedAt: new Date().toISOString(),
      url: args.url,
      romPath: args.romPath,
      coreStatus: args.coreStatus,
      userCorePath: args.userCorePath,
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

    console.log(`Phase 6 browser smoke passed for core status ${args.coreStatus}. Evidence: ${args.outDir}`);
  } finally {
    await browser.close();
  }
}

function canCoreStatusPlay(coreStatus, userCorePath) {
  return Boolean(userCorePath) || coreStatus === "dev-only";
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

async function submitComposer(page, text) {
  await page.getByLabel("Message Drive16").fill(text);
  await page.getByRole("button", { name: "Send message" }).click();
}

async function newestMessageText(page) {
  return page
    .locator(".messages .message")
    .last()
    .textContent()
    .then((text) => text?.replace(/\s+/g, " ").trim() ?? "");
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
