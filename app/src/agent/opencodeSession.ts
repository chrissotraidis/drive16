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
}: {
  sessionId?: string;
  text: string;
  providerId: string;
  modelId: string;
}): Promise<AgentSendResult> {
  return invoke<AgentSendResult>("send_opencode_message", {
    request: {
      sessionId,
      text,
      providerId,
      modelId,
      noReply: false,
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

export function agentPromptWithProject(projectPath: string, userText: string): string {
  return `Active Drive16 project: ${projectPath}\n\n${userText}`;
}

export type AgentActivity = {
  kind: "tool" | "step" | "status";
  label: string;
  detail: string;
  sessionId?: string;
};

type OpenCodeEventEnvelope = {
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

  const payload = parsed.payload;
  const properties = payload?.properties;
  if (!payload?.type || !properties) return undefined;
  const sessionId = properties.sessionID;

  if (payload.type === "message.part.updated") {
    const part = properties.part;
    if (part?.type === "tool" && part.tool) {
      const status = part.state?.status ?? "running";
      const title = part.state?.title;
      return {
        kind: "tool",
        label: toolActivityLabel(part.tool, status),
        detail: title ?? part.tool,
        sessionId,
      };
    }
    return undefined;
  }

  if (payload.type === "session.status") {
    const status = properties.status?.type;
    if (status === "idle") {
      return { kind: "status", label: "Agent finished", detail: "", sessionId };
    }
    return undefined;
  }

  return undefined;
}

function toolActivityLabel(tool: string, status: string): string {
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
  if (normalized.includes("build_rom")) return status === "completed" ? "ROM build finished" : "Building the ROM";
  if (normalized.includes("read_build_log")) return "Reading the build log";
  if (normalized.includes("run_rom")) return "Running the ROM";
  if (normalized.includes("capture_frame")) return "Checking the screen";
  if (normalized.includes("capture_audio")) return "Checking the audio";
  if (normalized.includes("send_input")) return "Testing controls";
  if (normalized.includes("query_documents") || normalized.includes("rag")) return "Looking up Genesis reference";
  if (normalized.includes("compile_music")) return "Compiling music";
  const base = friendly[normalized] ?? `Using ${tool}`;
  return status === "completed" ? `${base} - done` : base;
}
