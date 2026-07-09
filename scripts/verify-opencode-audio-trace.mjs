#!/usr/bin/env node
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const defaultLogPath = path.join(
  rootDir,
  "artifacts",
  "phase9",
  "live-game-audit",
  "runs",
  "snake-basic",
  "opencode-run.jsonl",
);

function parseArgs(argv) {
  const args = {
    log: defaultLogPath,
    expectAudio: true,
    expectGameProgress: false,
    allowSeededSource: false,
    json: false,
    selfTest: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--log") {
      args.log = path.resolve(argv[++index]);
    } else if (arg === "--expect-audio") {
      args.expectAudio = true;
    } else if (arg === "--no-expect-audio") {
      args.expectAudio = false;
    } else if (arg === "--expect-game-progress") {
      args.expectGameProgress = true;
    } else if (arg === "--allow-seeded-source") {
      args.allowSeededSource = true;
    } else if (arg === "--json") {
      args.json = true;
    } else if (arg === "--self-test") {
      args.selfTest = true;
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
  console.log(`Usage: scripts/verify-opencode-audio-trace.mjs [options]

Checks an OpenCode JSONL trace for the audio verification sequence expected by
Drive16 generated-game audits.

Options:
  --log <file>        OpenCode JSONL trace. Defaults to the current snake-basic audit trace.
  --expect-audio      Require verify_audio, or dump_audio plus capture_audio evidence. Default.
  --no-expect-audio   Parse the trace without requiring audio evidence.
  --expect-game-progress
                      Require source/resource edit, build, frame capture, and input evidence.
  --allow-seeded-source
                      With --expect-game-progress, allow a source file seeded before the trace.
  --json              Print the full summary as JSON.
  --self-test         Run fixture checks.
`);
}

function parseJsonLoose(value) {
  if (!value) return undefined;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function textFromEvent(event) {
  const part = event.part ?? event.payload?.properties?.part;
  if (part?.type === "text" && typeof part.text === "string") return part.text;
  if (typeof event.text === "string") return event.text;
  return "";
}

function toolFromEvent(event) {
  const part = event.part ?? event.payload?.properties?.part;
  if (part?.type !== "tool" || typeof part.tool !== "string") return undefined;
  const state = part.state ?? {};
  return {
    tool: part.tool,
    normalizedTool: part.tool.toLowerCase().replace(/[.-]/g, "_"),
    status: state.status ?? "unknown",
    input: state.input ?? {},
    output: parseJsonLoose(state.output) ?? state.output,
    title: state.title ?? "",
  };
}

function outputHasAudioDump(output) {
  const parsed = parseJsonLoose(output);
  return typeof parsed?.audioDumpPath === "string" && parsed.audioDumpPath.length > 0;
}

function captureAudioWasNonSilent(output) {
  const parsed = parseJsonLoose(output);
  if (!parsed || parsed.ok !== true) return false;
  if (parsed.nonSilent === false) return false;
  if (typeof parsed.maxAbsSample === "number") return parsed.maxAbsSample > 0;
  return true;
}

function dumpAudioWasRequested(input) {
  return input?.dump_audio === true || input?.dumpAudio === true;
}

function toolSucceeded(tool) {
  if (tool.status && tool.status !== "completed") return false;
  const parsed = parseJsonLoose(tool.output);
  if (parsed && parsed.ok === false) return false;
  return true;
}

function toolPath(tool) {
  return [tool.input?.filePath, tool.input?.path, tool.title].filter(Boolean).join(" ");
}

function isSourceOrResourceEdit(tool) {
  if (tool.normalizedTool !== "edit") return false;
  const target = toolPath(tool).replaceAll("\\", "/");
  return /\/(src|res)\/.+\.(c|h|s|res|png|vgm|wav|bin)$/i.test(target);
}

export function analyzeOpenCodeAudioTrace(text) {
  const summary = {
    parsedEvents: 0,
    parseErrors: 0,
    textAudioIntentCount: 0,
    runRomCalls: 0,
    runRomWithInputScript: 0,
    runRomWithDumpAudio: 0,
    runRomWithoutDumpAudio: 0,
    runRomAudioDumpOutputs: 0,
    captureAudioCalls: 0,
    captureAudioSuccesses: 0,
    captureAudioFailures: 0,
    verifyAudioCalls: 0,
    verifyAudioSuccesses: 0,
    verifyAudioFailures: 0,
    compileMusicCalls: 0,
    compileMusicSuccesses: 0,
    compileMusicFailures: 0,
    sourceOrResourceEditCalls: 0,
    buildRomCalls: 0,
    buildRomSuccesses: 0,
    buildRomFailures: 0,
    buildRomAfterLastSourceOrResourceEdit: false,
    captureFrameCalls: 0,
    sendInputCalls: 0,
    sendInputSuccesses: 0,
    sendInputDirectionalCalls: 0,
    sendInputStartCalls: 0,
  };
  let eventIndex = 0;
  let lastSourceOrResourceEditIndex = -1;
  let lastBuildRomIndex = -1;

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    eventIndex += 1;
    let event;
    try {
      event = JSON.parse(line);
      summary.parsedEvents += 1;
    } catch {
      summary.parseErrors += 1;
      continue;
    }

    const eventText = textFromEvent(event).toLowerCase();
    if (/\b(capture_audio|dump_audio|audio dump|sound evidence)\b/.test(eventText)) {
      summary.textAudioIntentCount += 1;
    }

    const tool = toolFromEvent(event);
    if (!tool) continue;

    if (isSourceOrResourceEdit(tool)) {
      summary.sourceOrResourceEditCalls += 1;
      lastSourceOrResourceEditIndex = eventIndex;
    }

    if (tool.normalizedTool.includes("build_rom")) {
      summary.buildRomCalls += 1;
      lastBuildRomIndex = eventIndex;
      if (toolSucceeded(tool)) {
        summary.buildRomSuccesses += 1;
      } else {
        summary.buildRomFailures += 1;
      }
    }

    if (tool.normalizedTool.includes("run_rom")) {
      summary.runRomCalls += 1;
      const output = parseJsonLoose(tool.output);
      if (
        tool.input?.use_input_script === true ||
        tool.input?.useInputScript === true ||
        typeof output?.inputScriptPath === "string"
      ) {
        summary.runRomWithInputScript += 1;
      }
      if (dumpAudioWasRequested(tool.input)) {
        summary.runRomWithDumpAudio += 1;
      } else {
        summary.runRomWithoutDumpAudio += 1;
      }
      if (outputHasAudioDump(tool.output)) {
        summary.runRomAudioDumpOutputs += 1;
      }
    }

    if (tool.normalizedTool.includes("capture_audio")) {
      summary.captureAudioCalls += 1;
      if (captureAudioWasNonSilent(tool.output)) {
        summary.captureAudioSuccesses += 1;
      } else {
        summary.captureAudioFailures += 1;
      }
    }

    if (tool.normalizedTool.includes("verify_audio")) {
      summary.verifyAudioCalls += 1;
      const parsed = parseJsonLoose(tool.output);
      if (parsed?.ok === true && captureAudioWasNonSilent(parsed.audio)) {
        summary.verifyAudioSuccesses += 1;
      } else {
        summary.verifyAudioFailures += 1;
      }
    }

    if (tool.normalizedTool.includes("compile_music")) {
      summary.compileMusicCalls += 1;
      const parsed = parseJsonLoose(tool.output);
      if (parsed?.ok === true && typeof parsed.vgmPath === "string" && parsed.vgmPath.length > 0) {
        summary.compileMusicSuccesses += 1;
      } else {
        summary.compileMusicFailures += 1;
      }
    }

    if (tool.normalizedTool.includes("capture_frame")) {
      summary.captureFrameCalls += 1;
    }

    if (tool.normalizedTool.includes("send_input")) {
      summary.sendInputCalls += 1;
      const succeeded = toolSucceeded(tool);
      if (succeeded) {
        summary.sendInputSuccesses += 1;
      }
      const buttons = [
        ...(Array.isArray(tool.input?.p1_buttons) ? tool.input.p1_buttons : []),
        ...(Array.isArray(tool.input?.p2_buttons) ? tool.input.p2_buttons : []),
      ]
        .map((button) => String(button).trim().toLowerCase())
        .filter(Boolean);
      if (succeeded && buttons.some((button) => ["left", "right", "up", "down"].includes(button))) {
        summary.sendInputDirectionalCalls += 1;
      }
      if (succeeded && buttons.includes("start")) {
        summary.sendInputStartCalls += 1;
      }
    }
  }

  summary.buildRomAfterLastSourceOrResourceEdit =
    lastSourceOrResourceEditIndex < 0 || lastBuildRomIndex > lastSourceOrResourceEditIndex;

  return summary;
}

export function validateOpenCodeAudioTrace(text, options = {}) {
  const expectAudio = options.expectAudio ?? true;
  const expectGameProgress = options.expectGameProgress ?? false;
  const allowSeededSource = options.allowSeededSource ?? false;
  const label = options.label ?? "OpenCode trace";
  const summary = analyzeOpenCodeAudioTrace(text);
  const issues = [];

  if (summary.parseErrors > 0) {
    issues.push(`${label} contains ${summary.parseErrors} unparseable JSONL event(s).`);
  }

  if (expectGameProgress) {
    if (summary.sourceOrResourceEditCalls === 0 && !allowSeededSource) {
      issues.push(`${label} has no source/resource edit.`);
    }
    if (summary.buildRomCalls === 0) {
      issues.push(`${label} has no drive16-sgdk-build.build_rom call.`);
    }
    if (summary.sourceOrResourceEditCalls > 0 && !summary.buildRomAfterLastSourceOrResourceEdit) {
      issues.push(`${label} edited source/resources but never rebuilt afterward.`);
    }
    if (summary.buildRomCalls > 0 && summary.buildRomSuccesses === 0) {
      issues.push(`${label} called build_rom but did not complete a successful build.`);
    }
    if (summary.captureFrameCalls === 0) {
      issues.push(`${label} has no drive16-emulator.capture_frame call.`);
    }
    if (summary.sendInputCalls === 0) {
      issues.push(`${label} has no drive16-emulator.send_input call.`);
    }
    if (summary.sendInputCalls > 0 && summary.sendInputSuccesses === 0) {
      issues.push(`${label} called send_input but did not complete a successful input event.`);
    }
  }

  if (!expectAudio) {
    return { summary, issues };
  }

  const hasOneShotAudioProof = summary.verifyAudioSuccesses > 0;
  const hasTwoStepAudioProof =
    summary.runRomWithDumpAudio > 0 &&
    summary.runRomAudioDumpOutputs > 0 &&
    summary.captureAudioSuccesses > 0;

  if (!hasOneShotAudioProof && summary.runRomCalls === 0) {
    issues.push(`${label} has no drive16-emulator.run_rom call.`);
  }
  if (!hasOneShotAudioProof && summary.runRomWithDumpAudio === 0) {
    issues.push(`${label} has no run_rom call with dump_audio=true.`);
  }
  if (!hasOneShotAudioProof && summary.captureAudioCalls === 0) {
    issues.push(`${label} has no drive16-emulator.capture_audio call.`);
  }
  if (summary.runRomWithDumpAudio > 0 && summary.runRomAudioDumpOutputs === 0) {
    issues.push(`${label} requested dump_audio but no run_rom output reported an audioDumpPath.`);
  }
  if (summary.captureAudioCalls > 0 && summary.captureAudioSuccesses === 0) {
    issues.push(`${label} called capture_audio but did not capture non-silent audio.`);
  }
  if (summary.verifyAudioCalls > 0 && summary.verifyAudioSuccesses === 0) {
    issues.push(`${label} called verify_audio but did not verify non-silent audio.`);
  }
  if (summary.compileMusicFailures > 2) {
    issues.push(`${label} repeated failed compile_music calls after the two-attempt cap.`);
  }
  if (
    !hasOneShotAudioProof &&
    summary.textAudioIntentCount > 0 &&
    summary.runRomWithoutDumpAudio >= 2 &&
    summary.runRomWithDumpAudio === 0
  ) {
    issues.push(
      `${label} contains audio-verification intent text but repeated run_rom calls omitted dump_audio=true.`,
    );
  }

  return { summary, issues };
}

function goodTrace() {
  return [
    {
      type: "text",
      part: { type: "text", text: "Final run uses verify_audio to capture sound." },
    },
    {
      type: "tool_use",
      part: {
        type: "tool",
        tool: "drive16-emulator_verify_audio",
        state: {
          status: "completed",
          input: { rom_path: "out/rom.bin", frames: 300 },
          output: JSON.stringify({
            ok: true,
            run: { ok: true, audioDumpPath: "last-audio.wav" },
            audio: { ok: true, audioDumpPath: "last-audio.wav", nonSilent: true, maxAbsSample: 1200 },
          }),
        },
      },
    },
  ]
    .map((event) => JSON.stringify(event))
    .join("\n");
}

function badLoopTrace() {
  const events = [
    {
      type: "text",
      part: { type: "text", text: "Let me run with audio dump enabled." },
    },
  ];
  for (let index = 0; index < 3; index += 1) {
    events.push({
      type: "tool_use",
      part: {
        type: "tool",
        tool: "drive16-emulator_run_rom",
        state: {
          status: "completed",
          input: { rom_path: "out/rom.bin", use_input_script: true },
          output: JSON.stringify({ ok: true, audioDumpPath: null }),
        },
      },
    });
  }
  return events.map((event) => JSON.stringify(event)).join("\n");
}

function missingCaptureTrace() {
  return [
    {
      type: "tool_use",
      part: {
        type: "tool",
        tool: "drive16-emulator_run_rom",
        state: {
          status: "completed",
          input: { rom_path: "out/rom.bin", dump_audio: true },
          output: JSON.stringify({ ok: true, audioDumpPath: "last-audio.wav" }),
        },
      },
    },
  ]
    .map((event) => JSON.stringify(event))
    .join("\n");
}

function badMmlLoopTrace() {
  const events = [];
  for (let index = 0; index < 3; index += 1) {
    events.push({
      type: "tool_use",
      part: {
        type: "tool",
        tool: "drive16-mml-music_compile_music",
        state: {
          status: "completed",
          input: { symbol: "snake_loop" },
          output: JSON.stringify({ ok: false, error: "Expected track or tag identifier", vgmPath: null }),
        },
      },
    });
  }
  return events.map((event) => JSON.stringify(event)).join("\n");
}

export { goodTrace as goodOpenCodeAudioTraceFixture };

function goodGameTrace() {
  return [
    {
      type: "tool_use",
      part: {
        type: "tool",
        tool: "edit",
        state: {
          status: "completed",
          input: { filePath: "/tmp/drive16/project/src/main.c" },
          output: "Edit applied successfully.",
        },
      },
    },
    {
      type: "tool_use",
      part: {
        type: "tool",
        tool: "drive16-sgdk-build_build_rom",
        state: {
          status: "completed",
          input: { project_path: "/tmp/drive16/project" },
          output: JSON.stringify({ ok: true, romPath: "/tmp/drive16/project/out/rom.bin" }),
        },
      },
    },
    {
      type: "tool_use",
      part: {
        type: "tool",
        tool: "drive16-emulator_run_rom",
        state: {
          status: "completed",
          input: { rom_path: "out/rom.bin", dump_audio: true },
          output: JSON.stringify({ ok: true, audioDumpPath: "last-audio.wav" }),
        },
      },
    },
    {
      type: "tool_use",
      part: {
        type: "tool",
        tool: "drive16-emulator_capture_frame",
        state: {
          status: "completed",
          input: { rom_path: "out/rom.bin" },
          output: JSON.stringify({ ok: true, screenshotPath: "screen.png" }),
        },
      },
    },
    {
      type: "tool_use",
      part: {
        type: "tool",
        tool: "drive16-emulator_send_input",
        state: {
          status: "completed",
          input: { buttons: ["RIGHT"] },
          output: JSON.stringify({ ok: true }),
        },
      },
    },
    {
      type: "tool_use",
      part: {
        type: "tool",
        tool: "drive16-emulator_capture_audio",
        state: {
          status: "completed",
          input: { audioDumpPath: "last-audio.wav" },
          output: JSON.stringify({ ok: true, audioDumpPath: "last-audio.wav", nonSilent: true, maxAbsSample: 1000 }),
        },
      },
    },
  ]
    .map((event) => JSON.stringify(event))
    .join("\n");
}

function sourceEditWithoutBuildTrace() {
  return [
    {
      type: "tool_use",
      part: {
        type: "tool",
        tool: "edit",
        state: {
          status: "completed",
          input: { filePath: "/tmp/drive16/project/src/main.c" },
          output: "Edit applied successfully.",
        },
      },
    },
    {
      type: "tool_use",
      part: {
        type: "tool",
        tool: "edit",
        state: {
          status: "completed",
          input: { filePath: "/tmp/drive16/project/PLAYTEST.md" },
          output: "Edit applied successfully.",
        },
      },
    },
  ]
    .map((event) => JSON.stringify(event))
    .join("\n");
}

export { goodGameTrace as goodOpenCodeGameTraceFixture };

async function runSelfTest() {
  const good = validateOpenCodeAudioTrace(goodTrace(), { label: "good fixture" });
  if (good.issues.length > 0) {
    throw new Error(`Good fixture failed:\n- ${good.issues.join("\n- ")}`);
  }

  const badLoop = validateOpenCodeAudioTrace(badLoopTrace(), { label: "bad loop fixture" });
  if (
    !badLoop.issues.some((issue) => issue.includes("no run_rom call with dump_audio=true")) ||
    !badLoop.issues.some((issue) => issue.includes("repeated run_rom calls omitted dump_audio=true"))
  ) {
    throw new Error(`Bad loop fixture did not catch the repeated audio-loop bug:\n- ${badLoop.issues.join("\n- ")}`);
  }

  const missingCapture = validateOpenCodeAudioTrace(missingCaptureTrace(), { label: "missing capture fixture" });
  if (!missingCapture.issues.some((issue) => issue.includes("no drive16-emulator.capture_audio call"))) {
    throw new Error(`Missing-capture fixture did not catch missing capture_audio:\n- ${missingCapture.issues.join("\n- ")}`);
  }

  const badMmlLoop = validateOpenCodeAudioTrace(badMmlLoopTrace(), { label: "bad MML loop fixture" });
  if (!badMmlLoop.issues.some((issue) => issue.includes("repeated failed compile_music calls after the two-attempt cap"))) {
    throw new Error(`Bad MML loop fixture did not catch repeated compile_music calls:\n- ${badMmlLoop.issues.join("\n- ")}`);
  }

  const goodGame = validateOpenCodeAudioTrace(goodGameTrace(), {
    label: "good game fixture",
    expectAudio: true,
    expectGameProgress: true,
  });
  if (goodGame.issues.length > 0) {
    throw new Error(`Good game fixture failed:\n- ${goodGame.issues.join("\n- ")}`);
  }

  const sourceEditNoBuild = validateOpenCodeAudioTrace(sourceEditWithoutBuildTrace(), {
    label: "source edit without build fixture",
    expectAudio: false,
    expectGameProgress: true,
  });
  if (
    !sourceEditNoBuild.issues.some((issue) => issue.includes("edited source/resources but never rebuilt afterward")) ||
    !sourceEditNoBuild.issues.some((issue) => issue.includes("no drive16-sgdk-build.build_rom call"))
  ) {
    throw new Error(
      `Source-edit-without-build fixture did not catch missing rebuild:\n- ${sourceEditNoBuild.issues.join("\n- ")}`,
    );
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "drive16-opencode-audio-trace-"));
  try {
    const tracePath = path.join(tempDir, "good.jsonl");
    await writeFile(tracePath, `${goodTrace()}\n`);
    const text = await readFile(tracePath, "utf8");
    const fileCheck = validateOpenCodeAudioTrace(text, { label: tracePath });
    if (fileCheck.issues.length > 0) {
      throw new Error(`File fixture failed:\n- ${fileCheck.issues.join("\n- ")}`);
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }

  console.log("OpenCode audio trace verifier self-test passed.");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.selfTest) {
    await runSelfTest();
    return;
  }

  const text = await readFile(args.log, "utf8");
  const result = validateOpenCodeAudioTrace(text, {
    expectAudio: args.expectAudio,
    expectGameProgress: args.expectGameProgress,
    allowSeededSource: args.allowSeededSource,
    label: path.relative(rootDir, args.log),
  });

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(
      [
        `OpenCode audio trace: ${result.issues.length === 0 ? "pass" : "fail"}`,
        `source_edits=${result.summary.sourceOrResourceEditCalls}`,
        `build_rom=${result.summary.buildRomCalls}`,
        `run_rom=${result.summary.runRomCalls}`,
        `capture_frame=${result.summary.captureFrameCalls}`,
        `send_input=${result.summary.sendInputCalls}`,
        `dump_audio=${result.summary.runRomWithDumpAudio}`,
        `capture_audio=${result.summary.captureAudioCalls}`,
        `verify_audio=${result.summary.verifyAudioCalls}`,
        `compile_music=${result.summary.compileMusicCalls}`,
        `non_silent=${result.summary.captureAudioSuccesses + result.summary.verifyAudioSuccesses}`,
      ].join(" "),
    );
    if (result.issues.length > 0) {
      console.log(`Issues:\n- ${result.issues.join("\n- ")}`);
    }
  }

  if (result.issues.length > 0) {
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
