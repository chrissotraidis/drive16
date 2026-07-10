import { invoke } from "@tauri-apps/api/core";

// Client for the real OpenCode agent loop. The Tauri backend proxies these
// calls to the local `opencode serve` instance; the SSE event stream is
// consumed directly by the UI for live activity.

export type ActiveProject = {
  generatedAt: string;
  status: string;
  detail: string;
  projectPath: string;
  agentProjectPath: string;
  romPath: string;
  romExists: boolean;
  created: boolean;
};

export type AgentSendResult = {
  sessionId: string;
  messageId: string;
  partId: string;
  state: string;
  detail: string;
  replyText: string | null;
  finish: string | null;
};

export type PromptSeedResult = {
  generatedAt: string;
  status: string;
  detail: string;
  projectPath: string;
  romPath: string;
  applied: boolean;
  source?: string | null;
};

export async function ensureActiveProject(): Promise<ActiveProject> {
  return invoke<ActiveProject>("ensure_active_project");
}

export async function resetActiveProject(): Promise<ActiveProject> {
  return invoke<ActiveProject>("reset_active_project");
}

export async function abortAgentSession(sessionId: string): Promise<boolean> {
  return invoke<boolean>("abort_opencode_session", { sessionId });
}

export async function seedActiveProjectForPrompt(prompt: string): Promise<PromptSeedResult> {
  return invoke<PromptSeedResult>("seed_active_project_for_prompt", { prompt });
}

export async function sendAgentPrompt({
  sessionId,
  text,
  providerId,
  modelId,
  noReply = false,
  background = false,
  comfyUiEndpoint,
  comfyUiCheckpoint,
  comfyUiLora,
}: {
  sessionId?: string;
  text: string;
  providerId: string;
  modelId: string;
  noReply?: boolean;
  background?: boolean;
  comfyUiEndpoint?: string;
  comfyUiCheckpoint?: string;
  comfyUiLora?: string;
}): Promise<AgentSendResult> {
  return invoke<AgentSendResult>("send_opencode_message", {
    request: {
      sessionId,
      text,
      providerId,
      modelId,
      noReply,
      background,
      comfyUiEndpoint,
      comfyUiCheckpoint,
      comfyUiLora,
    },
  });
}

export type AgentAuthResult = {
  connected: boolean;
  restarted: boolean;
  detail: string;
};

export async function setAgentProviderKey(
  providerId: string,
  apiKey: string,
): Promise<AgentAuthResult> {
  return invoke<AgentAuthResult>("set_opencode_auth", {
    request: { providerId, apiKey },
  });
}

export type AgentPromptContext = {
  spriteGeneration: boolean;
  musicGeneration: boolean;
  comfyUiEndpoint: string;
  comfyUiCheckpoint: string;
  comfyUiLora: string;
  comfyUiState: string;
  comfyUiDetail: string;
};

export function agentPromptWithProject(
  projectPath: string,
  userText: string,
  context?: AgentPromptContext,
): string {
  const contextLines = context
    ? [
        `AI sprites: ${context.spriteGeneration ? "enabled" : "disabled"}`,
        `MML music: ${context.musicGeneration ? "enabled" : "disabled"}`,
        `ComfyUI endpoint: ${context.comfyUiEndpoint || "not configured"}`,
        `ComfyUI checkpoint: ${context.comfyUiCheckpoint || "not configured"}`,
        `ComfyUI LoRA: ${context.comfyUiLora || "not configured"}`,
        `ComfyUI readiness: ${context.comfyUiState || "unknown"} - ${
          context.comfyUiDetail || "not checked"
        }`,
      ]
    : [];
  const spriteFallbackLines =
    context?.spriteGeneration && context.comfyUiState !== "ready"
      ? [
          "Sprite fallback:",
          "- AI sprites are enabled, but ComfyUI is not ready.",
          "- Do not claim ComfyUI-generated sprites were used.",
          "- Use primitive/manual Genesis-safe graphics for this turn and record the fallback in ASSETS.md.",
        ].join("\n")
      : "";

  return [
    `Active Drive16 project: ${projectPath}`,
    [
      "Session continuity:",
      "- OpenCode is receiving this as a fresh session to avoid stale prior-agent context.",
      "- Treat the active project folder as the durable conversation state.",
      "- Before editing, read GAME.md, ASSETS.md, and PLAYTEST.md when present.",
      "- If the user asks for a change, fix, addition, or refinement, modify the current game instead of starting over.",
      "- Do not polish project docs before gameplay exists. Early ASSETS.md planning rows are okay only when marked Planned or Pending.",
      "- After source/resource edits, build, emulator checks, input checks, and audio checks, update GAME.md, ASSETS.md, and PLAYTEST.md with what changed, what was verified, and what remains broken.",
    ].join("\n"),
    [
      "Verification contract:",
      "- Do not call the game done or playable just because out/rom.bin exists.",
      "- Never claim out/rom.bin is built unless build_rom succeeded after the final source/resource edit.",
      "- Never write Known Issues: none unless PLAYTEST.md passes with evidence.",
      "- Never claim audio was omitted unless the user explicitly requested no audio; failed, skipped, timed-out, or silent audio keeps the gate failed.",
      "- For a simple generated game, after reading GAME.md, ASSETS.md, PLAYTEST.md, and src/main.c, edit src/main.c before any more inspection only when the project is still blank; if a seeded starter is already present, build and test it first.",
      "- Do not use todo-list tools for simple generated games; make one compact first implementation, then build.",
      "- Keep the first implementation small: no decorative custom tile arrays, no generated-art wiring, and no extra systems before the first successful build_rom.",
      "- Do not read README.md, Makefile, src/boot/*, or res/resources.* unless the build fails or you are actually adding resource assets/music.",
      "- When reading or globbing active project files, use absolute paths under the Active Drive16 project; do not use repo-root relative globs like res/* for audit projects.",
      "- Build after the final code/resource edit; an older out/rom.bin is stale evidence.",
      "- Build the core playable game before optional music unless the user specifically asked for music first.",
      "- If src/main.c already contains a simple seeded starter for the requested game, build and test it before rewriting it or polishing docs.",
      "- Use only SGDK APIs that are present in the starter or local examples, or query drive16-rag first.",
      "- Do not use VDP_drawRect, srand, or C library rand(); for blocky graphics, load solid 8x8 tiles and draw cells with VDP_fillTileMapRect.",
      "- For simple Snake prompts, use examples/game-skeletons/snake-basic/ as the first code/audio shape when available; copy/adapt its src/main.c and res/ files before docs updates, then build.",
      "- For simple Pong prompts, use examples/game-skeletons/pong-basic/ as the first code/audio shape when available; copy/adapt its src/main.c and res/ files before docs updates, then build.",
      "- For simple Tetris prompts, use examples/game-skeletons/tetris-basic/ as the first code/audio shape when available; copy/adapt its src/main.c and res/ files before docs updates, then build.",
      "- Build the ROM, run it, call verify_screen, test input, and capture audio when sound is expected.",
      "- Immediately after build_rom succeeds, do not inspect or rewrite docs; run_rom, verify_screen, send_input with lowercase p1_buttons such as [\"right\"], run_rom with use_input_script true, capture_frame again, send_input with p1_buttons [\"start\"] when restart applies, then verify_audio if sound is expected.",
      "- verify_screen must pass before Playability gate: PASS. If it rejects sparse composition, flat color, or weak scene structure, repair the game and run it once more; a second failure keeps the gate failed.",
      "- Never use raw VRAM tile numbers as art. Load custom tile data with a proven SGDK API or reuse a validated skeleton that already does so.",
      "- Pause checks must prove both pause and resume. Do not guard all input with `if (paused) return` before checking Start, because that makes resume impossible.",
      "- Edge-trigger Start, rotate, and action buttons; held D-pad movement may use deliberate repeat timing, but must not move once per frame.",
      "- Valid send_input button names are lowercase: left, right, up, down, start, a, b, c, x, y, z, mode. Do not use SGDK constants like BUTTON_RIGHT.",
      "- For audio checks after movement tests, call verify_audio with use_input_script false unless the sound specifically requires held input.",
      "- If audio is expected, use drive16-emulator.verify_audio and treat silence as a failed audio check.",
      "- In PLAYTEST.md, use an exact ## Evidence section and include the exact genre evidence phrases when passing; for Snake include: score starts at 0, snake and food visible, D-pad movement visible, food can be approached or eaten, collision fail state checked, restart checked; for Pong include: paddles and ball visible, paddle input tested, ball travels and bounces, scoring changes, serve or point restart visible; for Tetris include: playfield and score/line state readable, piece spawns visibly, left/right/down movement works, rotation works, pieces lock into grid, line clear or stacking present, game-over possible.",
      "- In ASSETS.md, primitive text/tile rows should use the code path or drawing function in Symbol / File, such as `src/main.c draw_piece()`, not only a shared character like `#`.",
      "- If one primitive glyph or helper is reused across multiple roles, explicitly say the shared primitive reuse is intentional in each affected row.",
      "- In ASSETS.md, every music/sound row must record the resource symbol/file and the phrase captured non-silent audio evidence when verify_audio succeeds.",
      "- If Known Issues lists limitations, do not write Next Intended Change: none.",
      "- Before compiling MML music, read or query corpus/mml/ctrmml-megadrive.md; if two compile attempts fail, record audio as failed and finish the gameplay checks.",
      "- The two-attempt MML cap is strict; do not call compile_music a third time in the same turn.",
      "- If a seeded starter already includes a VGM/XGM resource, use it and verify audio; do not compile replacement music.",
      "- If any screen, input, or audio check is missing or failed, say the playability gate failed and explain why.",
    ].join("\n"),
    contextLines.length ? `Drive16 settings:\n${contextLines.join("\n")}` : "",
    spriteFallbackLines,
    userText,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export type AgentActivity = {
  kind: "tool" | "step" | "status";
  eventType: string;
  label: string;
  detail: string;
  sessionId?: string;
};

export type AgentActivityRepairState = {
  buildNeedsFix: boolean;
  buildFixLogged: boolean;
};

export function createAgentActivityRepairState(): AgentActivityRepairState {
  return {
    buildNeedsFix: false,
    buildFixLogged: false,
  };
}

export function visibleAgentActivityEvents(
  activity: AgentActivity,
  repairState: AgentActivityRepairState,
): AgentActivity[] {
  if (activity.eventType === "agent.build.failed") {
    repairState.buildNeedsFix = true;
    repairState.buildFixLogged = false;
    return [activity];
  }

  if (
    repairState.buildNeedsFix &&
    !repairState.buildFixLogged &&
    (activity.eventType === "agent.files.editing" ||
      activity.eventType === "agent.files.edited")
  ) {
    repairState.buildFixLogged = true;
    return [
      {
        ...activity,
        eventType: "agent.build.fixing",
        label: "Fixing build",
      },
      activity,
    ];
  }

  if (repairState.buildNeedsFix && activity.eventType === "agent.build.started") {
    return [
      {
        ...activity,
        eventType: "agent.build.retrying",
        label: "Retrying build",
      },
    ];
  }

  if (repairState.buildNeedsFix && activity.eventType === "agent.build.finished") {
    repairState.buildNeedsFix = false;
    repairState.buildFixLogged = false;
    return [
      {
        ...activity,
        eventType: "agent.build.fixed",
        label: "Build fixed",
      },
    ];
  }

  return [activity];
}

type OpenCodeEventEnvelope = {
  type?: string;
  sessionID?: string;
  status?: { type?: string };
  part?: {
    type?: string;
    tool?: string;
    state?: { status?: string; title?: string };
  };
  payload?: {
    type?: string;
    properties?: {
      sessionID?: string;
      status?: { type?: string };
      part?: {
        type?: string;
        tool?: string;
        state?: { status?: string; title?: string };
      };
    };
  };
};

// Turns a raw SSE data line into a human-readable activity item, or
// undefined for events that are noise (text deltas, syncs, heartbeats).
export function agentActivityFromEvent(raw: string): AgentActivity | undefined {
  let parsed: OpenCodeEventEnvelope;
  try {
    parsed = JSON.parse(raw) as OpenCodeEventEnvelope;
  } catch {
    return undefined;
  }

  const payloadType = parsed.payload?.type ?? parsed.type;
  const properties =
    parsed.payload?.properties ??
    (parsed.part
      ? {
          sessionID: parsed.sessionID,
          status: parsed.status,
          part: parsed.part,
        }
      : undefined);
  if (!payloadType || !properties) return undefined;
  const sessionId = properties.sessionID;

  if (payloadType === "message.part.updated" || payloadType === "tool_use") {
    const part = properties.part;
    if (part?.type === "tool" && part.tool) {
      const status = part.state?.status ?? "running";
      const title = part.state?.title;
      const activity = toolActivity(part.tool, status, title);
      return {
        kind: "tool",
        eventType: activity.eventType,
        label: activity.label,
        detail: activity.detail,
        sessionId,
      };
    }
    return undefined;
  }

  if (payloadType === "session.status") {
    const status = properties.status?.type;
    if (status === "idle") {
      return {
        kind: "status",
        eventType: "agent.finished",
        label: "Agent finished",
        detail: "",
        sessionId,
      };
    }
    return undefined;
  }

  return undefined;
}

function toolActivity(
  tool: string,
  status: string,
  title: string | undefined,
): { eventType: string; label: string; detail: string } {
  const friendly: Record<string, string> = {
    write: "Writing code",
    edit: "Editing code",
    read: "Reading files",
    bash: "Running a command",
    grep: "Searching the project",
    glob: "Searching the project",
    list: "Listing files",
    todowrite: "Planning",
    todoread: "Planning",
  };
  const normalized = tool.toLowerCase();
  const detail = title ?? tool;
  const failed = status === "error" || status === "failed";
  const completed = status === "completed";

  if (normalized.includes("build_rom")) {
    return {
      eventType: failed ? "agent.build.failed" : completed ? "agent.build.finished" : "agent.build.started",
      label: failed ? "Build failed" : completed ? "ROM build finished" : "Building the ROM",
      detail,
    };
  }
  if (normalized.includes("read_build_log")) {
    return {
      eventType: "agent.build.log",
      label: "Reading build failure",
      detail,
    };
  }
  if (normalized.includes("run_rom")) {
    return {
      eventType: failed ? "agent.rom.failed" : completed ? "agent.rom.ran" : "agent.rom.run",
      label: failed ? "ROM run failed" : completed ? "ROM run finished" : "Running the ROM",
      detail,
    };
  }
  if (normalized.includes("capture_frame")) {
    return {
      eventType: failed ? "agent.screenshot.failed" : completed ? "agent.screenshot.checked" : "agent.screenshot.checking",
      label: failed ? "Screenshot check failed" : completed ? "Screenshot checked" : "Checking screenshot",
      detail,
    };
  }
  if (normalized.includes("verify_screen")) {
    return {
      eventType: failed ? "agent.screenshot.failed" : completed ? "agent.screenshot.checked" : "agent.screenshot.checking",
      label: failed ? "Screen quality failed" : completed ? "Screen quality passed" : "Checking screen quality",
      detail,
    };
  }
  if (normalized.includes("capture_audio")) {
    const audioFailed = failed || (completed && captureAudioDetailReportsFailure(detail));
    return {
      eventType: audioFailed ? "agent.audio.failed" : completed ? "agent.audio.checked" : "agent.audio.checking",
      label: audioFailed ? "Audio check failed" : completed ? "Audio checked" : "Checking audio",
      detail,
    };
  }
  if (normalized.includes("verify_audio")) {
    const audioFailed = failed || (completed && captureAudioDetailReportsFailure(detail));
    return {
      eventType: audioFailed ? "agent.audio.failed" : completed ? "agent.audio.checked" : "agent.audio.checking",
      label: audioFailed ? "Audio check failed" : completed ? "Audio verified" : "Verifying audio",
      detail,
    };
  }
  if (normalized.includes("send_input")) {
    return {
      eventType: failed ? "agent.input.failed" : completed ? "agent.input.tested" : "agent.input.testing",
      label: failed ? "Input test failed" : completed ? "Input tested" : "Testing controls",
      detail,
    };
  }
  if (normalized.includes("comfyui") || normalized.includes("sprite_workflow")) {
    return {
      eventType: failed
        ? "agent.assets.sprite.failed"
        : completed
          ? "agent.assets.sprite.finished"
          : "agent.assets.sprite.started",
      label: failed ? "Sprite generation failed" : completed ? "Sprite generation finished" : "Generating sprites",
      detail,
    };
  }
  if (normalized.includes("validate") && normalized.includes("sprite")) {
    return {
      eventType: failed
        ? "agent.assets.sprite.invalid"
        : completed
          ? "agent.assets.sprite.validated"
          : "agent.assets.sprite.validating",
      label: failed ? "Sprite validation failed" : completed ? "Sprite validated" : "Validating sprites",
      detail,
    };
  }
  if (normalized.includes("query_documents") || normalized.includes("rag")) {
    return {
      eventType: "agent.reference",
      label: "Looking up Genesis reference",
      detail,
    };
  }
  if (normalized.includes("compile_music")) {
    return {
      eventType: failed ? "agent.assets.music.failed" : completed ? "agent.assets.music.finished" : "agent.assets.music.started",
      label: failed ? "Music compile failed" : completed ? "Music compile finished" : "Compiling music",
      detail,
    };
  }

  if (normalized === "read") {
    return {
      eventType: completed ? "agent.files.read" : "agent.files.reading",
      label: completed ? "File read" : "Reading file",
      detail,
    };
  }
  if (normalized === "edit" || normalized === "write") {
    return {
      eventType: failed ? "agent.files.edit.failed" : completed ? "agent.files.edited" : "agent.files.editing",
      label: failed ? "File edit failed" : completed ? "File edited" : "Editing file",
      detail,
    };
  }
  if (normalized === "grep" || normalized === "glob" || normalized === "list") {
    return {
      eventType: "agent.files.search",
      label: friendly[normalized],
      detail,
    };
  }
  if (normalized === "todowrite" || normalized === "todoread") {
    return {
      eventType: "agent.plan",
      label: "Planning",
      detail,
    };
  }
  const base = friendly[normalized] ?? `Using ${tool}`;
  return {
    eventType: failed ? "agent.tool.failed" : completed ? "agent.tool.finished" : "agent.tool.started",
    label: failed ? `${base} failed` : completed ? `${base} done` : base,
    detail,
  };
}

function captureAudioDetailReportsFailure(detail: string): boolean {
  const normalized = detail.toLowerCase();
  return (
    normalized.includes("no audio dump") ||
    normalized.includes("dump_audio=true") ||
    normalized.includes('"ok": false') ||
    normalized.includes('"ok":false') ||
    /\b(error|failed|failure)\b/.test(normalized) ||
    /(?:maxabssample|max_abs(?:_sample)?)["'\s:=]+0\b/.test(normalized) ||
    /nonsilent["'\s:=]+false\b/.test(normalized)
  );
}
