import { invoke } from "@tauri-apps/api/core";

// Client for the real OpenCode agent loop. The Tauri backend proxies these
// calls to the local `opencode serve` instance; the SSE event stream is
// consumed directly by the UI for live activity.

export type ActiveProject = {
  generatedAt: string;
  status: string;
  detail: string;
  projectPath: string;
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

export async function ensureActiveProject(): Promise<ActiveProject> {
  return invoke<ActiveProject>("ensure_active_project");
}

export async function resetActiveProject(): Promise<ActiveProject> {
  return invoke<ActiveProject>("reset_active_project");
}

export async function sendAgentPrompt({
  sessionId,
  text,
  providerId,
  modelId,
  noReply = false,
  background = false,
}: {
  sessionId?: string;
  text: string;
  providerId: string;
  modelId: string;
  noReply?: boolean;
  background?: boolean;
}): Promise<AgentSendResult> {
  return invoke<AgentSendResult>("send_opencode_message", {
    request: {
      sessionId,
      text,
      providerId,
      modelId,
      noReply,
      background,
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
      ]
    : [];

  return [
    `Active Drive16 project: ${projectPath}`,
    [
      "Session continuity:",
      "- OpenCode is receiving this as a fresh session to avoid stale prior-agent context.",
      "- Treat the active project folder as the durable conversation state.",
      "- Before editing, read GAME.md, ASSETS.md, and PLAYTEST.md when present.",
      "- If the user asks for a change, fix, addition, or refinement, modify the current game instead of starting over.",
      "- After the turn, update GAME.md, ASSETS.md, and PLAYTEST.md with what changed, what was verified, and what remains broken.",
    ].join("\n"),
    [
      "Verification contract:",
      "- Do not call the game done or playable just because out/rom.bin exists.",
      "- Build the ROM, run it, capture a frame, test input, and capture audio when sound is expected.",
      "- If audio is expected, run the emulator with dump_audio enabled and treat silence as a failed audio check.",
      "- If any screen, input, or audio check is missing or failed, say the playability gate failed and explain why.",
    ].join("\n"),
    contextLines.length ? `Drive16 settings:\n${contextLines.join("\n")}` : "",
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
  if (normalized.includes("capture_audio")) {
    const audioFailed = failed || (completed && captureAudioDetailReportsFailure(detail));
    return {
      eventType: audioFailed ? "agent.audio.failed" : completed ? "agent.audio.checked" : "agent.audio.checking",
      label: audioFailed ? "Audio check failed" : completed ? "Audio checked" : "Checking audio",
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
