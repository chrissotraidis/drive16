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
    coreStatus: process.env.DRIVE16_VERIFY_CORE_STATUS ?? "missing",
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
                       Default: missing.
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
  const expectedComfyUiProbeErrors = [];
  const screenshots = [];
  const states = {};
  let openRouterCompletionRequests = 0;
  const smokeOpenRouterModel = "openrouter/auto";
  const smokeOllamaModels = [
    "rafw007/Qwen3.6-35B-A3B-mlx-claude-coder-abliterated:latest",
    "gpt-oss:120b",
  ];

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
    await context.route("https://openrouter.ai/api/v1/models", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            { id: "deepseek/deepseek-chat-v3.1", name: "DeepSeek V3.1" },
            { id: smokeOpenRouterModel, name: "OpenRouter Auto" },
            { id: "~openai/gpt-latest", name: "GPT Latest" },
          ],
        }),
      });
    });
    await context.route("https://openrouter.ai/api/v1/chat/completions", async (route) => {
      openRouterCompletionRequests += 1;
      const requestBody = route.request().postDataJSON();
      if (requestBody?.model !== smokeOpenRouterModel) {
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
    await context.route("http://127.0.0.1:11434/api/tags", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          models: smokeOllamaModels.map((name) => ({ name })),
        }),
      });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(args.timeoutMs);
    page.on("console", (message) => {
      const entry = `${message.type()}: ${message.text()}`;
      if (message.type() === "error") {
        const location = message.location();
        if (
          /Failed to load resource/i.test(message.text()) &&
          typeof location.url === "string" &&
          location.url.endsWith("/system_stats")
        ) {
          expectedComfyUiProbeErrors.push(`${entry} (${location.url})`);
          return;
        }
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

    const firstRunWorkspace = page.getByTestId("first-run-workspace");
    await firstRunWorkspace.waitFor();
    const firstRunText = await firstRunWorkspace.innerText();
    for (const expected of ["Describe a game", "Open a project", "Snake", "Pong", "Tetris", "Asteroids"]) {
      if (!firstRunText.includes(expected)) {
        throw new Error(`First-run workspace is missing ${expected}.`);
      }
    }
    await firstRunWorkspace.getByRole("button", { name: "Snake" }).click();
    const seededDraft = await page.getByLabel("Message Drive16").inputValue();
    if (!/Snake game/i.test(seededDraft)) {
      throw new Error("Snake example did not seed the chat composer.");
    }
    await page.getByLabel("Message Drive16").fill("");
    states.firstRunWorkspace = firstRunText;

    states.initialTruthSurface = await playerTruthSurface(page);
    assertNoRomTruthSurface(states.initialTruthSurface, "Initial app load");
    assertRealTimestamps(states.initialTruthSurface, "Initial app load");

    await screenshot(page, args.outDir, screenshots, "01-initial.png");

    await submitComposer(page, "What should I build next?");
    await waitForNewestMessage(page, /OpenRouter needs an API key/i);
    states.freeformGateMessage = await newestMessageText(page);
    if (!/OpenRouter needs an API key/i.test(states.freeformGateMessage)) {
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
      throw new Error("OpenRouter API key did not survive reload in the same app window.");
    }
    await page.waitForFunction((modelId) => {
      const modelSelect = document.querySelector('select[aria-label="OpenRouter model"]');
      return Array.from(modelSelect?.querySelectorAll("option") ?? []).some(
        (option) => option.value === modelId,
      );
    }, smokeOpenRouterModel);
    await page.locator('select[aria-label="OpenRouter model"]').selectOption(smokeOpenRouterModel);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByTestId("agent-settings-open").waitFor();
    await page.getByTestId("agent-settings-open").click();
    await page.getByTestId("openrouter-settings").waitFor();
    await page.waitForFunction((modelId) => {
      const modelSelect = document.querySelector('select[aria-label="OpenRouter model"]');
      return Array.from(modelSelect?.querySelectorAll("option") ?? []).some(
        (option) => option.value === modelId,
      );
    }, smokeOpenRouterModel);
    const restoredOpenRouterModel = await page.locator('select[aria-label="OpenRouter model"]').inputValue();
    if (restoredOpenRouterModel !== smokeOpenRouterModel) {
      throw new Error(
        `OpenRouter model did not survive reload. Expected ${smokeOpenRouterModel}, saw ${restoredOpenRouterModel}.`,
      );
    }
    states.openRouterApiKeyRestored = "OpenRouter API key survived reload.";
    states.openRouterModelRestored = restoredOpenRouterModel;

    await page.getByRole("button", { name: "Ollama", exact: true }).click();
    await page.getByTestId("ollama-settings").waitFor();
    if (await page.getByLabel("Ollama endpoint").isVisible()) {
      throw new Error("Ollama endpoint should stay behind Advanced setup by default.");
    }
    await page.getByTestId("advanced-ollama-setup").locator("summary").click();
    await page.getByLabel("Ollama endpoint").waitFor();
    await page.waitForFunction((modelIds) => {
      const modelSelect = document.querySelector('select[aria-label="Ollama model"]');
      const options = Array.from(modelSelect?.querySelectorAll("option") ?? []).map(
        (option) => option.value,
      );
      return modelIds.every((modelId) => options.includes(modelId));
    }, smokeOllamaModels);
    await page.locator('select[aria-label="Ollama model"]').selectOption(smokeOllamaModels[1]);
    await page.getByRole("button", { name: "Test Ollama" }).click();
    await page.waitForFunction(() => {
      const status =
        document.querySelector('[data-testid="model-connection-status"]')?.textContent ?? "";
      return /Connected|Ollama model available/i.test(status);
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByTestId("agent-settings-open").waitFor();
    await page.getByTestId("agent-settings-open").click();
    await page.getByTestId("ollama-settings").waitFor();
    const restoredOllamaModel = await page.locator('select[aria-label="Ollama model"]').inputValue();
    if (restoredOllamaModel !== smokeOllamaModels[1]) {
      throw new Error(
        `Ollama model did not survive reload. Expected ${smokeOllamaModels[1]}, saw ${restoredOllamaModel}.`,
      );
    }
    states.ollamaModelDropdown = {
      models: smokeOllamaModels,
      selected: restoredOllamaModel,
      connection: await visibleText(page, "model-connection-status"),
    };
    await page.getByRole("button", { name: "OpenRouter", exact: true }).click();
    await page.getByTestId("openrouter-settings").waitFor();

    const smokeComfyUiEndpoint = new URL(args.url).origin;
    await page.getByTestId("sprite-enhancement-input").check({ force: true });
    await page.getByTestId("comfyui-config").waitFor();
    await page.getByTestId("advanced-sprite-setup").locator("summary").click();
    await page.getByLabel("ComfyUI endpoint").fill(smokeComfyUiEndpoint);
    await page.getByLabel("ComfyUI checkpoint").fill("drive16-smoke-checkpoint.safetensors");
    await page.getByLabel("ComfyUI LoRA").fill("drive16-smoke-lora.safetensors");
    await page.getByTestId("music-enhancement-input").check({ force: true });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByTestId("agent-settings-open").waitFor();
    await page.getByTestId("agent-settings-open").click();
    await page.getByTestId("openrouter-settings").waitFor();
    await page.getByTestId("advanced-sprite-setup").locator("summary").click();
    const restoredSpriteToggle = await page.getByTestId("sprite-enhancement-input").isChecked();
    const restoredMusicToggle = await page.getByTestId("music-enhancement-input").isChecked();
    const restoredComfyEndpoint = await page.getByLabel("ComfyUI endpoint").inputValue();
    const restoredComfyCheckpoint = await page.getByLabel("ComfyUI checkpoint").inputValue();
    const restoredComfyLora = await page.getByLabel("ComfyUI LoRA").inputValue();
    if (!restoredSpriteToggle || !restoredMusicToggle) {
      throw new Error("Enhancement toggles did not survive reload.");
    }
    if (
      restoredComfyEndpoint !== smokeComfyUiEndpoint ||
      restoredComfyCheckpoint !== "drive16-smoke-checkpoint.safetensors" ||
      restoredComfyLora !== "drive16-smoke-lora.safetensors"
    ) {
      throw new Error("ComfyUI settings did not survive reload.");
    }
    states.settingsPersistence = {
      spriteGeneration: restoredSpriteToggle,
      musicGeneration: restoredMusicToggle,
      comfyUiEndpoint: restoredComfyEndpoint,
      comfyUiCheckpoint: restoredComfyCheckpoint,
      comfyUiLora: restoredComfyLora,
    };

    await page.getByRole("button", { name: "Test OpenRouter" }).click();
    await page.waitForFunction(() => {
      const status =
        document.querySelector('[data-testid="model-connection-status"]')?.textContent ?? "";
      return /Connected|OpenRouter key accepted/i.test(status);
    });
    states.openRouterConnection = await visibleText(page, "model-connection-status");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByTestId("agent-settings-open").waitFor();
    await page.getByTestId("agent-settings-open").click();
    await page.getByTestId("openrouter-settings").waitFor();
    states.openRouterConnectionAfterReload = await visibleText(page, "model-connection-status");
    if (!/Connected|OpenRouter key accepted/i.test(states.openRouterConnectionAfterReload)) {
      throw new Error(
        `OpenRouter accepted connection state did not survive reload: ${states.openRouterConnectionAfterReload}`,
      );
    }
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

    await submitComposer(page, "Build a game.");
    await waitForNewestMessage(page, /Before I build, give me a little direction:/i);
    states.broadPromptQuestions = await newestMessageText(page);
    for (const expectedQuestion of [
      "What genre or reference should it follow?",
      "What should the player control?",
      "primitive tiles first, or try generated sprites/music?",
    ]) {
      if (!states.broadPromptQuestions.includes(expectedQuestion)) {
        throw new Error(
          `Broad prompt did not ask the expected question "${expectedQuestion}": ${states.broadPromptQuestions}`,
        );
      }
    }
    if (openRouterCompletionRequests !== 0) {
      throw new Error("Broad build prompt asked for clarification but still called OpenRouter.");
    }

    await submitComposer(page, "Give me one compact idea for a Genesis demo.");
    await waitForNewestMessage(page, /Mocked OpenRouter live reply for Drive16 smoke\./i);
    states.openRouterReply = await newestMessageText(page);
    if (openRouterCompletionRequests !== 1) {
      throw new Error(`Expected one OpenRouter completion request, saw ${openRouterCompletionRequests}.`);
    }

    await submitComposer(page, "smoke overclaim guard");
    await waitForNewestMessage(
      page,
      /I can.t treat that as verified because this was a freeform model reply/i,
    );
    states.openRouterSecondReply = await newestMessageText(page);
    if (/^ROM built successfully/i.test(states.openRouterSecondReply)) {
      throw new Error(`Freeform model overclaim was not guarded: ${states.openRouterSecondReply}`);
    }
    if (openRouterCompletionRequests !== 2) {
      throw new Error(`Expected two OpenRouter completion requests, saw ${openRouterCompletionRequests}.`);
    }

    await submitComposer(page, "Make a sprite I can move left and right with music.");
    await waitForNewestMessage(
      page,
      /Previewed the (?:bundled sprite\/music|generated sprite and music|generated music) demo/i,
    );
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
      "Open Last Save",
      "Import ROM",
      "Import Test ROM",
      "Verify",
    ]) {
      if (!states.projectMenu.includes(expectedAction)) {
        throw new Error(`Project menu is missing ${expectedAction}`);
      }
    }
    if (!/Set Up Play|Replace Play Core/i.test(states.projectMenu)) {
      throw new Error("Project menu is missing the Play core setup action.");
    }
    if (!/Asset roles|ASSETS\.md/i.test(states.projectMenu)) {
      throw new Error("Project menu is missing the ASSETS.md role ledger preview.");
    }
    await page.getByTestId("project-summary").waitFor();
    await page.getByTestId("project-asset-roles").waitFor();
    await screenshot(page, args.outDir, screenshots, "02-project-menu.png");

    await page.getByTestId("menu-new-project").click();
    await page.getByTestId("project-menu").waitFor({ state: "detached" });
    await page.waitForFunction(() => {
      const feedback =
        document.querySelector('[data-testid="rom-action-feedback"]')?.textContent ?? "";
      return /New starter project|blank starter|starter project/i.test(feedback);
    });
    states.newProjectFeedback = await visibleText(page, "rom-action-feedback");
    states.newProjectTruthSurface = await playerTruthSurface(page);
    assertNoRomTruthSurface(states.newProjectTruthSurface, "New Project");
    assertRealTimestamps(states.newProjectTruthSurface, "New Project");
    if (states.newProjectTruthSurface.messages.length !== 1) {
      throw new Error(
        `New Project should reset chat to one starter message, saw ${states.newProjectTruthSurface.messages.length}: ${JSON.stringify(states.newProjectTruthSurface.messages)}`,
      );
    }
    if (!/project\.new|Blank starter template loaded/i.test(states.newProjectTruthSurface.rawLogText)) {
      throw new Error(
        `New Project raw log did not show the reset event: ${states.newProjectTruthSurface.rawLogText}`,
      );
    }

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
      return /Imported ROM preview captured|Browser preview is using simulated frames/i.test(feedback);
    });
    states.importFeedback = await visibleText(page, "rom-action-feedback");
    states.importTruthSurface = await playerTruthSurface(page);
    assertStoppedVolumeControl(states.importTruthSurface, "Imported ROM");
    if (!/Needs Repair|Checking/i.test(states.importTruthSurface.runStatus)) {
      throw new Error(
        `Imported ROM should not show top-level Ready before playability evidence passes: ${states.importTruthSurface.runStatus}`,
      );
    }
    if (!/Play ROM|Waiting|Preparing|Playing/i.test(states.importTruthSurface.playButtonText)) {
      throw new Error(
        `Imported ROM did not leave the player in a ROM-capable state: ${states.importTruthSurface.playButtonText}`,
      );
    }
    if (!states.importTruthSurface.evidenceText.includes("Gate: needs repair")) {
      throw new Error(
        `Imported ROM should show a needs-repair playability gate until input/audio pass: ${states.importTruthSurface.evidenceText}`,
      );
    }
    if (!states.importTruthSurface.evidenceText.includes("Screen: frame captured")) {
      throw new Error(
        `Imported ROM should show captured-frame evidence before player checks: ${states.importTruthSurface.evidenceText}`,
      );
    }
    if (!states.importTruthSurface.evidenceText.includes("Audio: unverified")) {
      throw new Error(
        `Imported browser ROM should not claim audio proof without a native dump: ${states.importTruthSurface.evidenceText}`,
      );
    }

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
      states.activePlayerTruthSurface = await playerTruthSurface(page);
      if (states.activePlayerTruthSurface.volumeSliderValue !== "0") {
        throw new Error(
          `Interactive Play should start with app volume at 0%, saw ${states.activePlayerTruthSurface.volumeSliderValue}%.`,
        );
      }
      if (states.activePlayerTruthSurface.volumeSliderDisabled !== false) {
        throw new Error("Interactive Play volume slider should be enabled for deliberate user opt-in.");
      }
      if (!/Muted|Volume 0%/i.test(states.activePlayerTruthSurface.audioButtonText)) {
        throw new Error(
          `Interactive Play should show muted audio at startup, saw ${states.activePlayerTruthSurface.audioButtonText}.`,
        );
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
    }
    await screenshot(page, args.outDir, screenshots, "03-player-stopped.png");

    await page.getByTestId("project-menu-toggle").click();
    await page.getByTestId("project-menu").waitFor();
    await page.getByTestId("verify-rom").click();
    await page.getByTestId("project-menu").waitFor({ state: "detached" });
    await page.waitForFunction(() => {
      const feedback = document.querySelector('[data-testid="rom-action-feedback"]')?.textContent ?? "";
      return /Imported ROM preview captured|Active project ROM preview captured/i.test(feedback);
    });
    states.verifyFeedback = await visibleText(page, "rom-action-feedback");

    await page.getByTestId("export-rom").click();
    await page.waitForFunction(() => {
      const feedback = document.querySelector('[data-testid="rom-action-feedback"]')?.textContent ?? "";
      return /export/i.test(feedback);
    });
    states.exportFeedback = await visibleText(page, "rom-action-feedback");

    await page.getByTestId("project-menu-toggle").click();
    await page.getByTestId("project-menu").waitFor();
    await page.getByTestId("menu-new-project").click();
    await page.getByTestId("project-menu").waitFor({ state: "detached" });
    await page.waitForFunction(() => {
      const feedback =
        document.querySelector('[data-testid="rom-action-feedback"]')?.textContent ?? "";
      return /New starter project|blank starter|starter project/i.test(feedback);
    });
    states.newProjectAfterRomFeedback = await visibleText(page, "rom-action-feedback");
    states.newProjectAfterRomTruthSurface = await playerTruthSurface(page);
    assertNoRomTruthSurface(states.newProjectAfterRomTruthSurface, "New Project after ROM import");
    assertRealTimestamps(states.newProjectAfterRomTruthSurface, "New Project after ROM import");
    if (states.newProjectAfterRomTruthSurface.messages.length !== 1) {
      throw new Error(
        `New Project after ROM import should reset chat to one starter message, saw ${states.newProjectAfterRomTruthSurface.messages.length}: ${JSON.stringify(states.newProjectAfterRomTruthSurface.messages)}`,
      );
    }
    if (!/project\.new|Blank starter template loaded/i.test(states.newProjectAfterRomTruthSurface.rawLogText)) {
      throw new Error(
        `New Project after ROM import raw log did not show the reset event: ${states.newProjectAfterRomTruthSurface.rawLogText}`,
      );
    }
    await screenshot(page, args.outDir, screenshots, "03b-new-project-after-rom.png");

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
      expectedComfyUiProbeErrors,
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

async function waitForNewestMessage(page, pattern) {
  await page.waitForFunction((source) => {
    const pattern = new RegExp(source, "i");
    const messages = Array.from(document.querySelectorAll(".messages .message"));
    const newest = messages[messages.length - 1]?.textContent ?? "";
    return pattern.test(newest);
  }, pattern.source);
}

async function playerTruthSurface(page) {
  return page.evaluate(() => {
    const playButton = document.querySelector('[data-testid="play-active-rom"]');
    const audioButton = document.querySelector('[data-testid="player-audio-toggle"]');
    const volumeSlider = document.querySelector('[data-testid="player-volume-slider"]');
    const rawLog = document.querySelector('[data-testid="chat-raw-log"]');
    return {
      projectName: document.querySelector('[data-testid="project-menu-toggle"]')?.textContent?.trim() ?? "",
      runStatus:
        document.querySelector('[data-testid="run-status"]')?.textContent?.replace(/\s+/g, " ").trim() ??
        "",
      screenText:
        document.querySelector('[data-testid="starter-rom-screen"]')?.textContent?.replace(/\s+/g, " ").trim() ??
        "",
      firstRunText:
        document.querySelector('[data-testid="first-run-workspace"]')?.textContent?.replace(/\s+/g, " ").trim() ??
        "",
      playButtonText: playButton?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      playDisabled: playButton instanceof HTMLButtonElement ? playButton.disabled : undefined,
      audioButtonText: audioButton?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      audioDisabled: audioButton instanceof HTMLButtonElement ? audioButton.disabled : undefined,
      volumeSliderValue: volumeSlider instanceof HTMLInputElement ? volumeSlider.value : undefined,
      volumeSliderDisabled: volumeSlider instanceof HTMLInputElement ? volumeSlider.disabled : undefined,
      evidenceText:
        document.querySelector('[data-testid="playtest-evidence"]')?.textContent?.replace(/\s+/g, " ").trim() ??
        "",
      evidencePills: Array.from(document.querySelectorAll(".evidence-pill")).map((node) => ({
        text: node.textContent?.replace(/\s+/g, " ").trim() ?? "",
        className: node.className,
      })),
      visibleLogText:
        document.querySelector(".chat-build-log-items")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      rawLogText: rawLog?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      rawLogOpen: rawLog instanceof HTMLDetailsElement ? rawLog.open : undefined,
      messages: Array.from(document.querySelectorAll(".messages .message")).map(
        (node) => node.textContent?.replace(/\s+/g, " ").trim() ?? "",
      ),
      messageTimes: Array.from(document.querySelectorAll(".message-meta time")).map(
        (node) => node.textContent?.replace(/\s+/g, " ").trim() ?? "",
      ),
      buildLogTimes: Array.from(document.querySelectorAll(".chat-build-log-items time")).map(
        (node) => node.textContent?.replace(/\s+/g, " ").trim() ?? "",
      ),
      heartbeatText:
        document.querySelector('[data-testid="opencode-heartbeat-status"]')?.textContent?.replace(/\s+/g, " ").trim() ??
        "",
    };
  });
}

function assertNoRomTruthSurface(surface, label) {
  if (surface.projectName !== "Untitled Project") {
    throw new Error(`${label} should show Untitled Project, saw ${surface.projectName}`);
  }
  if (surface.runStatus !== "Ready") {
    throw new Error(`${label} top-level status should be Ready for an idle no-ROM app, saw ${surface.runStatus}`);
  }
  if (
    !/NO ROM/i.test(surface.screenText) &&
    !/What should Drive16 build\?.*Describe a game.*Open a project/i.test(surface.firstRunText)
  ) {
    throw new Error(
      `${label} should show the guided no-ROM start state, saw ${surface.screenText || surface.firstRunText}`,
    );
  }
  if (surface.playButtonText !== "No ROM" || surface.playDisabled !== true) {
    throw new Error(
      `${label} Play button should be disabled as No ROM, saw ${JSON.stringify({
        text: surface.playButtonText,
        disabled: surface.playDisabled,
      })}`,
    );
  }
  if (surface.audioButtonText !== "Audio unavailable" || surface.audioDisabled !== true) {
    throw new Error(
      `${label} audio button should be disabled as unavailable, saw ${JSON.stringify({
        text: surface.audioButtonText,
        disabled: surface.audioDisabled,
      })}`,
    );
  }
  assertStoppedVolumeControl(surface, label);
  for (const expected of ["Gate: no ROM", "Screen: no ROM", "Input: no ROM", "Audio: no ROM"]) {
    if (!surface.evidenceText.includes(expected)) {
      throw new Error(`${label} evidence row is missing "${expected}": ${surface.evidenceText}`);
    }
  }
  if (!surface.rawLogText.includes("Raw log")) {
    throw new Error(`${label} should expose the raw log disclosure.`);
  }
  if (surface.rawLogOpen !== false) {
    throw new Error(`${label} raw log should be closed by default.`);
  }
}

function assertStoppedVolumeControl(surface, label) {
  if (surface.volumeSliderValue !== "0" || surface.volumeSliderDisabled !== true) {
    throw new Error(
      `${label} should keep the app volume slider at disabled 0%, saw ${JSON.stringify({
        value: surface.volumeSliderValue,
        disabled: surface.volumeSliderDisabled,
      })}`,
    );
  }
}

function assertRealTimestamps(surface, label) {
  for (const [kind, values] of [
    ["message", surface.messageTimes],
    ["build log", surface.buildLogTimes],
  ]) {
    for (const value of values ?? []) {
      if (/^now$/i.test(value)) {
        throw new Error(`${label} ${kind} timestamp regressed to "Now".`);
      }
      if (value && !/\d{1,2}:\d{2}/.test(value)) {
        throw new Error(`${label} ${kind} timestamp is not a real clock time: ${value}`);
      }
    }
  }

  if (/now/i.test(surface.heartbeatText ?? "")) {
    throw new Error(`${label} heartbeat status should show a real clock time, not "Now".`);
  }
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
