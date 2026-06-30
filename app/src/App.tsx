import {
  Activity,
  AlertCircle,
  Box,
  CheckCircle2,
  Circle,
  Code2,
  Download,
  Eye,
  EyeOff,
  FolderOpen,
  FolderTree,
  Gamepad2,
  KeyRound,
  Maximize2,
  Menu,
  MessageSquareText,
  Minimize2,
  Pause,
  Play,
  Plus,
  RefreshCcw,
  Save,
  Send,
  Settings,
  ShieldCheck,
  Square,
  TerminalSquare,
  Wrench,
  X,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import type { ReactNode } from "react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type BuildState = "idle" | "building" | "running" | "error";
type TransportState = "running" | "paused";
type ModelProvider = "openrouter" | "ollama";
type ConnectionState = HealthState | "idle" | "testing";
type MessageSource = "local" | "opencode" | "model";

type Message = {
  id: number;
  role: "user" | "agent";
  source?: MessageSource;
  body: string;
  time: string;
};

type ConversationMode = {
  state: HealthState;
  label: string;
  detail: string;
};

type ToolStep = {
  label: string;
  detail: string;
  state: "done" | "active" | "queued";
};

type HealthState = "ready" | "warning" | "missing";

type HealthCheck = {
  name: string;
  state: HealthState;
  detail: string;
  hints?: string[];
};

type PreflightReport = {
  generatedAt: string;
  summaryState: HealthState;
  checks: HealthCheck[];
};

type FramebufferFrame = {
  frameIndex: number;
  width: number;
  height: number;
  format: string;
  rgb565Data: string;
};

type StarterRomPreview = {
  status: HealthState;
  detail: string;
  generatedAt: string;
  projectPath: string;
  romPath: string;
  screenshotPath: string;
  frameStreamPath: string;
  screenshotDataUrl: string;
  frames: number;
  streamEvery: number;
  streamedFrames: number;
  frameWidth: number;
  frameHeight: number;
  framebufferFrames: FramebufferFrame[];
};

type ProjectFileEntry = {
  label: string;
  path: string;
  state: HealthState;
};

type ProjectSummary = {
  generatedAt: string;
  name: string;
  projectPath: string;
  romPath: string;
  exportDirectory: string;
  romStatus: HealthState;
  romDetail: string;
  files: ProjectFileEntry[];
};

type RomExportResult = {
  generatedAt: string;
  status: HealthState;
  detail: string;
  sourceRomPath: string;
  exportPath: string;
  bytes: number;
};

type ProjectSaveResult = {
  generatedAt: string;
  status: HealthState;
  detail: string;
  sourceProjectPath: string;
  snapshotPath: string;
  files: number;
};

type V1PromptResult = {
  status: HealthState;
  detail: string;
  generatedAt: string;
  prompt: string;
  projectPath: string;
  romPath: string;
  neutralScreenshotPath: string;
  rightScreenshotPath: string;
  audioDumpPath: string;
  frameStreamPath: string;
  screenshotDataUrl: string;
  frames: number;
  streamEvery: number;
  streamedFrames: number;
  frameWidth: number;
  frameHeight: number;
  framebufferFrames: FramebufferFrame[];
  movementDetail: string;
  audioMaxAbs: number;
};

type OpenCodeBridgeStatus = {
  generatedAt: string;
  state: HealthState;
  detail: string;
  baseUrl: string;
  healthUrl: string;
  eventUrl: string;
  version?: string;
  launched: boolean;
};

type OpenCodeSendResult = {
  sessionId: string;
  messageId: string;
  partId: string;
  state: HealthState;
  detail: string;
};

type OpenCodeEvent = {
  id: number;
  type: string;
  detail: string;
  time: string;
};

type ModelOption = {
  id: string;
  name: string;
};

type ModelConnectionReport = {
  state: ConnectionState;
  detail: string;
  baseUrl?: string;
  model?: string;
  models?: string[];
};

type EnhancementSettings = {
  spriteGeneration: boolean;
  musicGeneration: boolean;
};

type PromptAssetMode = "core" | "generatedMusic" | "generatedAssets";

type ComfyUiEndpointStatus = {
  generatedAt: string;
  state: ConnectionState;
  detail: string;
  baseUrl: string;
  systemStatsUrl: string;
  version?: string;
  devices: number;
  checks: HealthCheck[];
};

type OllamaEndpointStatus = {
  generatedAt: string;
  state: ConnectionState;
  detail: string;
  baseUrl: string;
  tagsUrl: string;
  model: string;
  models: string[];
};

type DecodedFramebufferFrame = {
  frameIndex: number;
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
};

const openRouterKeyUrl = "https://openrouter.ai/api/v1/key";
const openRouterModelsUrl = "https://openrouter.ai/api/v1/models";
const defaultOllamaEndpoint = "http://127.0.0.1:11434";
const defaultOllamaModel = "qwen2.5-coder:7b";
const defaultComfyUiEndpoint = "http://127.0.0.1:8188";
const defaultComfyUiCheckpoint = "sd_xl_base_1.0.safetensors";
const defaultComfyUiLora = "pixel-art-xl.safetensors";

const preferredOpenRouterModels = [
  "~anthropic/claude-sonnet-latest",
  "~openai/gpt-latest",
  "~google/gemini-pro-latest",
  "~google/gemini-flash-latest",
  "qwen/qwen3.7-max",
  "openrouter/auto",
];

const fallbackModelOptions: ModelOption[] = [
  {
    id: "~anthropic/claude-sonnet-latest",
    name: "Claude Sonnet Latest",
  },
  {
    id: "~openai/gpt-latest",
    name: "GPT Latest",
  },
  {
    id: "~google/gemini-pro-latest",
    name: "Gemini Pro Latest",
  },
];

const starterMessages: Message[] = [
  {
    id: 1,
    role: "agent",
    source: "local",
    body: "Starter project loaded. Blank ROM is running.",
    time: "09:41",
  },
  {
    id: 2,
    role: "user",
    body: "Make a sprite I can move left and right with music.",
    time: "09:42",
  },
  {
    id: 3,
    role: "agent",
    source: "local",
    body: "Local proof path is ready: that prompt builds the bundled sprite/music ROM and verifies movement and audio.",
    time: "09:42",
  },
];

const previewPreflight: PreflightReport = {
  generatedAt: "preview",
  summaryState: "warning",
  checks: [
    {
      name: "OpenCode",
      state: "warning",
      detail: "Native preflight runs inside the Tauri app",
    },
    {
      name: "Docker",
      state: "warning",
      detail: "Browser preview cannot inspect local commands",
    },
    {
      name: "SGDK build",
      state: "ready",
      detail: "scripts/build-sgdk.sh tracked",
    },
    {
      name: "Genteel",
      state: "ready",
      detail: "sidecar path tracked from Phase 0",
    },
  ],
};

const previewStarterRom: StarterRomPreview = {
  status: "warning",
  detail: "Native starter ROM launch runs inside the Tauri app",
  generatedAt: "preview",
  projectPath: "examples/app-starter-blank",
  romPath: "examples/app-starter-blank/out/rom.bin",
  screenshotPath: "preview",
  frameStreamPath: "preview",
  screenshotDataUrl: "",
  frames: 180,
  streamEvery: 30,
  streamedFrames: 0,
  frameWidth: 320,
  frameHeight: 240,
  framebufferFrames: [],
};

const previewOpenCode: OpenCodeBridgeStatus = {
  generatedAt: "preview",
  state: "warning",
  detail: "OpenCode bridge checks run inside Tauri or against a local preview server",
  baseUrl: "http://127.0.0.1:4096",
  healthUrl: "http://127.0.0.1:4096/global/health",
  eventUrl: "http://127.0.0.1:4096/global/event",
  launched: false,
};

const previewProjectSummary: ProjectSummary = {
  generatedAt: "preview",
  name: "Starter Project",
  projectPath: "examples/app-starter-blank",
  romPath: "examples/app-starter-blank/out/rom.bin",
  exportDirectory: "artifacts/phase3/exports",
  romStatus: "warning",
  romDetail: "Native project summary runs inside the Tauri app",
  files: [
    {
      label: "Main C",
      path: "examples/app-starter-blank/src/main.c",
      state: "ready",
    },
    {
      label: "Resources",
      path: "examples/app-starter-blank/res/resources.res",
      state: "ready",
    },
    {
      label: "Bundled sprite",
      path: "assets/core/player.png",
      state: "ready",
    },
    {
      label: "Bundled loop",
      path: "assets/core/loop.vgm",
      state: "ready",
    },
  ],
};

const previewExportResult: RomExportResult = {
  generatedAt: "preview",
  status: "warning",
  detail: "Export runs inside the Tauri app",
  sourceRomPath: "examples/app-starter-blank/out/rom.bin",
  exportPath: "artifacts/phase3/exports/drive16-starter-preview.bin",
  bytes: 0,
};

const previewSaveResult: ProjectSaveResult = {
  generatedAt: "preview",
  status: "warning",
  detail: "Save runs inside the Tauri app",
  sourceProjectPath: "examples/app-starter-blank",
  snapshotPath: "artifacts/phase3/projects/drive16-starter-preview",
  files: 0,
};

const previewV1PromptResult: V1PromptResult = {
  status: "warning",
  detail: "Native v1 prompt verification runs inside the Tauri app",
  generatedAt: "preview",
  prompt: "make a sprite I can move left and right with music",
  projectPath: "examples/phase2-core-assets",
  romPath: "examples/phase2-core-assets/out/rom.bin",
  neutralScreenshotPath: "preview",
  rightScreenshotPath: "preview",
  audioDumpPath: "preview",
  frameStreamPath: "preview",
  screenshotDataUrl: "",
  frames: 180,
  streamEvery: 30,
  streamedFrames: 0,
  frameWidth: 320,
  frameHeight: 240,
  framebufferFrames: [],
  movementDetail: "Preview mode",
  audioMaxAbs: 1,
};

function App() {
  const [messages, setMessages] = useState<Message[]>(starterMessages);
  const [draft, setDraft] = useState("");
  const [buildState, setBuildState] = useState<BuildState>("running");
  const [transport, setTransport] = useState<TransportState>("running");
  const [spriteX, setSpriteX] = useState(52);
  const [preflight, setPreflight] = useState<PreflightReport>(previewPreflight);
  const [preflightSource, setPreflightSource] = useState("checking");
  const [starterRom, setStarterRom] = useState<StarterRomPreview>(previewStarterRom);
  const [starterSource, setStarterSource] = useState("checking");
  const [starterBusy, setStarterBusy] = useState(true);
  const [projectSummary, setProjectSummary] =
    useState<ProjectSummary>(previewProjectSummary);
  const [projectSource, setProjectSource] = useState("checking");
  const [exportResult, setExportResult] = useState<RomExportResult | undefined>();
  const [exportBusy, setExportBusy] = useState(false);
  const [saveResult, setSaveResult] = useState<ProjectSaveResult | undefined>();
  const [saveBusy, setSaveBusy] = useState(false);
  const [v1PromptResult, setV1PromptResult] = useState<V1PromptResult | undefined>();
  const [v1PromptSource, setV1PromptSource] = useState("idle");
  const [openCode, setOpenCode] = useState<OpenCodeBridgeStatus>(previewOpenCode);
  const [openCodeSource, setOpenCodeSource] = useState("checking");
  const [openCodeSessionId, setOpenCodeSessionId] = useState<string | undefined>();
  const [openCodeEvents, setOpenCodeEvents] = useState<OpenCodeEvent[]>([]);
  const [openCodeBusy, setOpenCodeBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [emulatorFocused, setEmulatorFocused] = useState(false);
  const [actionDetail, setActionDetail] = useState(
    "Starter template loaded. Run the ROM or ask for sprite and music.",
  );
  const [modelProvider, setModelProvider] = useState<ModelProvider>("openrouter");
  const [activeModel, setActiveModel] = useState(fallbackModelOptions[0].id);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>(fallbackModelOptions);
  const [modelsSource, setModelsSource] = useState("fallback");
  const [openRouterKey, setOpenRouterKey] = useState("");
  const [showOpenRouterKey, setShowOpenRouterKey] = useState(false);
  const [ollamaEndpoint, setOllamaEndpoint] = useState(defaultOllamaEndpoint);
  const [ollamaModel, setOllamaModel] = useState(defaultOllamaModel);
  const [enhancements, setEnhancements] = useState<EnhancementSettings>({
    spriteGeneration: false,
    musicGeneration: false,
  });
  const [comfyUiEndpoint, setComfyUiEndpoint] = useState(defaultComfyUiEndpoint);
  const [comfyUiCheckpoint, setComfyUiCheckpoint] = useState(defaultComfyUiCheckpoint);
  const [comfyUiLora, setComfyUiLora] = useState(defaultComfyUiLora);
  const [comfyUiConnection, setComfyUiConnection] = useState<ComfyUiEndpointStatus>({
    generatedAt: "0",
    state: "idle",
    detail: "Not tested",
    baseUrl: defaultComfyUiEndpoint,
    systemStatsUrl: `${defaultComfyUiEndpoint}/system_stats`,
    devices: 0,
    checks: [],
  });
  const [modelConnection, setModelConnection] = useState<ModelConnectionReport>({
    state: "idle",
    detail: "Not tested",
  });
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const messageIdRef = useRef(starterMessages.length + 1);
  const openCodeEventIdRef = useRef(1);

  useEffect(() => {
    void refreshPreflight();
    void launchStarterRom();
    void connectOpenCode();
    void loadProjectSummary();
  }, []);

  useEffect(() => {
    if (!settingsOpen || modelProvider !== "openrouter") return;
    if (modelsSource !== "fallback") return;

    void refreshOpenRouterModels();
  }, [modelProvider, modelsSource, settingsOpen]);

  useEffect(() => {
    if (openCode.state !== "ready" || !openCode.eventUrl) return;
    if (typeof EventSource === "undefined") {
      appendOpenCodeEvent("sse.unavailable", "Browser EventSource is unavailable");
      return;
    }

    appendOpenCodeEvent("sse.connecting", "Opening OpenCode event stream");
    const events = new EventSource(openCode.eventUrl);

    events.onopen = () => {
      appendOpenCodeEvent("sse.open", "OpenCode event stream connected");
    };

    events.onmessage = (event) => {
      appendOpenCodeEventFromData(event.data);
    };

    events.onerror = () => {
      appendOpenCodeEvent("sse.waiting", "OpenCode event stream is waiting to reconnect");
    };

    return () => {
      events.close();
    };
  }, [openCode.eventUrl, openCode.state]);

  useEffect(() => {
    const element = messagesRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
  }, [messages]);

  const buildLabel = useMemo(() => {
    if (buildState === "building") return "Building";
    if (buildState === "running") return "Running";
    if (buildState === "error") return "Error";
    return "Idle";
  }, [buildState]);

  const runSteps = useMemo<ToolStep[]>(() => {
    const openCodeConnected = openCode.state === "ready";
    return [
      {
        label: "OpenCode HTTP",
        detail: openCodeConnected
          ? `${openCode.version ?? "server"} at ${openCode.baseUrl}`
          : openCode.detail,
        state: openCodeConnected ? "done" : "active",
      },
      {
        label: "SSE stream",
        detail:
          openCodeEvents.length > 0
            ? openCodeEvents[0].type
            : openCodeConnected
              ? "Waiting for server events"
              : "Connect OpenCode first",
        state: openCodeConnected ? "active" : "queued",
      },
      {
        label: "User message",
        detail: openCodeSessionId
          ? `Session ${shortIdentifier(openCodeSessionId)}`
          : "Create session on first send",
        state: openCodeSessionId ? "done" : openCodeConnected ? "active" : "queued",
      },
      {
        label: "CORE ROM",
        detail: v1PromptResult
          ? `Sprite and music verified, audio ${v1PromptResult.audioMaxAbs}`
          : "Ask for sprite and music",
        state: v1PromptResult ? "done" : "queued",
      },
    ];
  }, [openCode, openCodeEvents, openCodeSessionId, v1PromptResult]);

  const conversationMode = useMemo(
    () =>
      getConversationMode(
        modelProvider,
        activeModel,
        ollamaModel,
        modelConnection,
        openCode,
      ),
    [activeModel, modelConnection, modelProvider, ollamaModel, openCode],
  );

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;

    const userMessage = makeMessage("user", trimmed);
    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setOpenCodeBusy(true);
    const shouldRunV1 = isV1Prompt(trimmed);
    const shouldRunGeneratedMusic = shouldRunV1 && enhancements.musicGeneration;
    const shouldRunGeneratedSprite = shouldRunGeneratedMusic && enhancements.spriteGeneration;
    if (shouldRunV1) {
      setBuildState("building");
      setV1PromptSource("running");
    }

    if (!shouldRunV1) {
      const gateMessage = freeformGateMessage(
        modelProvider,
        activeModel,
        ollamaModel,
        modelConnection,
        openCode,
      );
      if (gateMessage) {
        appendOpenCodeEvent("message.gated", gateMessage);
        setMessages((current) => [...current, makeMessage("agent", gateMessage, "local")]);
        noteAction("Freeform model replies are paused. ROM-changing prompts still work.");
        setOpenCodeBusy(false);
        return;
      }
    }

    let openCodeResult: OpenCodeSendResult | undefined;
    try {
      openCodeResult = await sendOpenCodeMessage(trimmed);
      setOpenCodeSessionId(openCodeResult.sessionId);
      appendOpenCodeEvent("message.posted", openCodeResult.detail);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "OpenCode message send failed";
      appendOpenCodeEvent("message.local", detail);
      if (!shouldRunV1) {
        const agentMessage = makeMessage(
          "agent",
          `The message stayed local. Freeform model replies are paused because ${detail}. ROM-changing prompts still use the verified local build path.`,
          "local",
        );
        setMessages((current) => [...current, agentMessage]);
        noteAction("Message handled locally. ROM-changing prompts are still available.");
        setOpenCodeBusy(false);
        return;
      }
    }

    try {
      if (shouldRunV1) {
        const promptResult = shouldRunGeneratedMusic
          ? await runPhase4MusicPrompt(trimmed, shouldRunGeneratedSprite)
          : await runV1Prompt(trimmed);
        const promptAssetMode: PromptAssetMode = shouldRunGeneratedSprite
          ? "generatedAssets"
          : shouldRunGeneratedMusic
            ? "generatedMusic"
            : "core";
        applyV1PromptResult(promptResult, promptAssetMode);
        noteAction(
          shouldRunGeneratedSprite
            ? "Generated sprite and MML ROM proof completed."
            : shouldRunGeneratedMusic
              ? "Generated MML ROM proof completed."
              : "CORE ROM proof completed.",
        );
        const agentMessage = makeMessage(
          "agent",
          promptReadyMessage(shouldRunGeneratedMusic, shouldRunGeneratedSprite),
          "local",
        );
        setMessages((current) => [...current, agentMessage]);
        const readyEvent = shouldRunGeneratedSprite
          ? "phase4.assets.ready"
          : shouldRunGeneratedMusic
            ? "phase4.music.ready"
            : "v1.ready";
        appendOpenCodeEvent(readyEvent, promptResult.romPath);
      } else {
        const agentMessage = makeMessage(
          "agent",
          openCodeResult
            ? `Logged to OpenCode session ${shortIdentifier(
                openCodeResult.sessionId,
              )} without requesting a model reply. Live freeform answer streaming is not wired in this shell yet; ROM-changing prompts use the verified local build path.`
            : "Message captured locally. Live freeform answer streaming is not wired in this shell yet; ROM-changing prompts use the verified local build path.",
          openCodeResult ? "opencode" : "local",
        );
        setMessages((current) => [...current, agentMessage]);
        noteAction("Message captured without a live model reply.");
      }
      setBuildState("running");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "OpenCode message send failed";
      const agentMessage = makeMessage(
        "agent",
        shouldRunV1
          ? `The v1 ROM run could not finish yet. ${detail}`
          : `OpenCode bridge could not send that yet. ${detail}`,
        "local",
      );
      setMessages((current) => [...current, agentMessage]);
      appendOpenCodeEvent(shouldRunV1 ? "v1.failed" : "message.failed", detail);
      setBuildState("error");
      setV1PromptSource("error");
    } finally {
      setOpenCodeBusy(false);
    }
  }

  function makeMessage(role: Message["role"], body: string, source?: MessageSource): Message {
    const id = messageIdRef.current;
    messageIdRef.current += 1;
    return {
      id,
      role,
      source,
      body,
      time: "Now",
    };
  }

  function appendOpenCodeEvent(type: string, detail: string) {
    const id = openCodeEventIdRef.current;
    openCodeEventIdRef.current += 1;
    setOpenCodeEvents((current) =>
      [
        {
          id,
          type,
          detail,
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
        },
        ...current,
      ].slice(0, 8),
    );
  }

  function noteAction(detail: string) {
    setActionDetail(detail);
  }

  function appendOpenCodeEventFromData(data: string) {
    try {
      const parsed = JSON.parse(data) as {
        type?: string;
        properties?: {
          sessionID?: string;
          messageID?: string;
          info?: { id?: string; role?: string };
          part?: { type?: string; messageID?: string };
        };
      };
      const type = parsed.type ?? "event";
      const properties = parsed.properties;
      const detail =
        properties?.sessionID ??
        properties?.messageID ??
        properties?.info?.id ??
        properties?.part?.messageID ??
        "OpenCode event received";
      appendOpenCodeEvent(type, detail);
    } catch {
      appendOpenCodeEvent("event.raw", data.slice(0, 80));
    }
  }

  async function connectOpenCode() {
    setOpenCodeSource("checking");

    if (isTauriRuntime()) {
      try {
        const report = await invoke<OpenCodeBridgeStatus>("connect_opencode");
        setOpenCode(report);
        setOpenCodeSource("tauri");
        appendOpenCodeEvent(
          report.state === "ready" ? "server.ready" : "server.warning",
          report.detail,
        );
        return;
      } catch (error) {
        setOpenCode({
          ...previewOpenCode,
          state: "warning",
          detail: error instanceof Error ? error.message : "OpenCode command unavailable",
          generatedAt: "error",
        });
        setOpenCodeSource("error");
        return;
      }
    }

    try {
      const response = await fetch(previewOpenCode.healthUrl, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const health = (await response.json()) as { healthy?: boolean; version?: string };
      setOpenCode({
        ...previewOpenCode,
        state: health.healthy ? "ready" : "warning",
        detail: health.healthy
          ? "OpenCode preview server is reachable"
          : "OpenCode preview server reported unhealthy",
        version: health.version,
      });
      setOpenCodeSource("preview");
      appendOpenCodeEvent("server.ready", "OpenCode preview server is reachable");
    } catch (error) {
      setOpenCode({
        ...previewOpenCode,
        state: "warning",
        detail:
          error instanceof Error
            ? error.message
            : "OpenCode preview server is not reachable",
      });
      setOpenCodeSource("preview");
    }
  }

  async function sendOpenCodeMessage(text: string): Promise<OpenCodeSendResult> {
    if (isTauriRuntime()) {
      return invoke<OpenCodeSendResult>("send_opencode_message", {
        request: {
          sessionId: openCodeSessionId,
          text,
        },
      });
    }

    if (openCode.state !== "ready") {
      throw new Error("OpenCode is not connected");
    }

    const sessionId = openCodeSessionId ?? (await createPreviewOpenCodeSession());
    const stamp = Date.now().toString(36);
    const messageId = `msg_drive16_${stamp}`;
    const partId = `prt_drive16_${stamp}`;
    const response = await fetch(`${openCode.baseUrl}/session/${sessionId}/message`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messageID: messageId,
        noReply: true,
        parts: [
          {
            id: partId,
            type: "text",
            text,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenCode message request failed with HTTP ${response.status}`);
    }

    return {
      sessionId,
      messageId,
      partId,
      state: "ready",
      detail: "Message posted to OpenCode with noReply",
    };
  }

  async function createPreviewOpenCodeSession() {
    const response = await fetch(`${openCode.baseUrl}/session`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Drive16 app conversation",
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenCode session request failed with HTTP ${response.status}`);
    }

    const session = (await response.json()) as { id?: string };
    if (!session.id) {
      throw new Error("OpenCode session response did not include an id");
    }

    return session.id;
  }

  async function runV1Prompt(text: string): Promise<V1PromptResult> {
    if (isTauriRuntime()) {
      return invoke<V1PromptResult>("run_v1_prompt", { prompt: text });
    }

    const framebufferFrames = [
      makePreviewFrame(0, 0x3944),
      makePreviewFrame(30, 0x4145),
    ];
    return {
      ...previewV1PromptResult,
      prompt: text,
      framebufferFrames,
      streamedFrames: framebufferFrames.length,
      detail: "Preview v1 prompt verification",
    };
  }

  async function runPhase4MusicPrompt(
    text: string,
    useGeneratedSprite: boolean,
  ): Promise<V1PromptResult> {
    if (isTauriRuntime()) {
      return invoke<V1PromptResult>("run_phase4_music_prompt", {
        request: { prompt: text, useGeneratedSprite },
      });
    }

    const framebufferFrames = [
      makePreviewFrame(0, 0x2b45),
      makePreviewFrame(30, 0x3150),
    ];
    return {
      ...previewV1PromptResult,
      prompt: text,
      projectPath: "artifacts/phase4/generated-music-prompt/project",
      romPath: "artifacts/phase4/generated-music-prompt/project/out/rom.bin",
      neutralScreenshotPath: "artifacts/phase4/generated-music-prompt/phase4-music-neutral.png",
      rightScreenshotPath: "artifacts/phase4/generated-music-prompt/phase4-music-right.png",
      audioDumpPath: "artifacts/phase4/generated-music-prompt/phase4-music-audio.wav",
      frameStreamPath: "artifacts/phase4/generated-music-prompt/phase4-music-frames.rgb565",
      framebufferFrames,
      streamedFrames: framebufferFrames.length,
      detail: useGeneratedSprite
        ? "Preview Phase 4 generated sprite and MML music verification"
        : "Preview Phase 4 generated MML music verification",
    };
  }

  function applyV1PromptResult(result: V1PromptResult, assetMode: PromptAssetMode = "core") {
    setV1PromptResult(result);
    setV1PromptSource(isTauriRuntime() ? "tauri" : "preview");
    setStarterSource(isTauriRuntime() ? "tauri" : "preview");
    setStarterBusy(false);
    setTransport("running");
    setStarterRom({
      status: result.status,
      detail: result.detail,
      generatedAt: result.generatedAt,
      projectPath: result.projectPath,
      romPath: result.romPath,
      screenshotPath: result.neutralScreenshotPath,
      frameStreamPath: result.frameStreamPath,
      screenshotDataUrl: result.screenshotDataUrl,
      frames: result.frames,
      streamEvery: result.streamEvery,
      streamedFrames: result.streamedFrames,
      frameWidth: result.frameWidth,
      frameHeight: result.frameHeight,
      framebufferFrames: result.framebufferFrames,
    });
    setProjectSummary({
      generatedAt: result.generatedAt,
      name:
        assetMode === "generatedAssets"
          ? "Generated Sprite and MML ROM"
          : assetMode === "generatedMusic"
            ? "Generated MML Music ROM"
            : "Generated CORE ROM",
      projectPath: result.projectPath,
      romPath: result.romPath,
      exportDirectory: "artifacts/phase3/exports",
      romStatus: result.status,
      romDetail: result.detail,
      files: [
        {
          label: "Main C",
          path: `${result.projectPath}/src/main.c`,
          state: "ready",
        },
        {
          label: "Resources",
          path: `${result.projectPath}/res/resources.res`,
          state: "ready",
        },
        {
          label: assetMode === "generatedAssets" ? "Generated sprite" : "Bundled sprite",
          path:
            assetMode === "generatedAssets"
              ? "artifacts/phase4/live-comfyui-sprite"
              : "assets/core/player.png",
          state: "ready",
        },
        {
          label: assetMode !== "core" ? "Generated MML loop" : "Bundled loop",
          path:
            assetMode !== "core"
              ? "artifacts/phase4/generated-music-prompt/project/res/generated_music.vgm"
              : "assets/core/loop.vgm",
          state: "ready",
        },
      ],
    });
  }

  async function loadProjectSummary() {
    setProjectSource("checking");

    if (!isTauriRuntime()) {
      setProjectSummary(previewProjectSummary);
      setProjectSource("preview");
      return;
    }

    try {
      const summary = await invoke<ProjectSummary>("load_project_summary");
      setProjectSummary(summary);
      setProjectSource("tauri");
    } catch (error) {
      setProjectSummary({
        ...previewProjectSummary,
        romStatus: "warning",
        romDetail:
          error instanceof Error
            ? error.message
            : "Native project summary was not available",
        generatedAt: "error",
      });
      setProjectSource("error");
    }
  }

  async function exportRom() {
    setExportBusy(true);
    noteAction("Exporting the current ROM.");

    if (!isTauriRuntime()) {
      setExportResult(previewExportResult);
      appendOpenCodeEvent("export.preview", previewExportResult.exportPath);
      noteAction(`Preview export ready at ${previewExportResult.exportPath}.`);
      setExportBusy(false);
      return;
    }

    try {
      const result = await invoke<RomExportResult>("export_current_rom");
      setExportResult(result);
      appendOpenCodeEvent("export.ready", result.exportPath);
      noteAction(`ROM exported to ${result.exportPath}.`);
      void loadProjectSummary();
    } catch (error) {
      const detail = error instanceof Error ? error.message : "ROM export failed";
      setExportResult({
        ...previewExportResult,
        status: "missing",
        detail,
        generatedAt: "error",
      });
      appendOpenCodeEvent("export.failed", detail);
      noteAction(`ROM export failed: ${detail}`);
    } finally {
      setExportBusy(false);
    }
  }

  async function refreshOpenRouterModels() {
    setModelsSource("loading");

    try {
      const response = await fetch(openRouterModelsUrl, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = (await response.json()) as {
        data?: Array<{ id?: string; name?: string }>;
      };
      const modelMap = new Map(
        (payload.data ?? [])
          .filter((model): model is { id: string; name?: string } => Boolean(model.id))
          .map((model) => [
            model.id,
            {
              id: model.id,
              name: model.name ?? model.id,
            },
          ]),
      );
      const preferred = preferredOpenRouterModels
        .map((id) => modelMap.get(id))
        .filter((model): model is ModelOption => Boolean(model));
      const fallback = Array.from(modelMap.values()).slice(0, 8);
      const nextOptions = preferred.length > 0 ? preferred : fallback;

      if (nextOptions.length > 0) {
        setModelOptions(nextOptions);
        if (!nextOptions.some((model) => model.id === activeModel)) {
          setActiveModel(nextOptions[0].id);
        }
      }
      setModelsSource("ready");
    } catch {
      setModelOptions(fallbackModelOptions);
      setModelsSource("error");
    }
  }

  async function testModelConnection() {
    if (modelProvider === "ollama") {
      await testOllamaConnection();
      return;
    }

    if (modelProvider !== "openrouter") {
      setModelConnection({
        state: "warning",
        detail: "Provider test is not available",
      });
      return;
    }

    const trimmedKey = openRouterKey.trim();
    if (!trimmedKey) {
      setModelConnection({
        state: "missing",
        detail: "OpenRouter key required",
      });
      return;
    }

    setModelConnection({
      state: "testing",
      detail: "Testing OpenRouter",
    });

    try {
      const response = await fetch(openRouterKeyUrl, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${trimmedKey}`,
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      setModelConnection({
        state: "ready",
        detail: "OpenRouter key accepted",
      });
      appendOpenCodeEvent("model.ready", shortModelLabel(activeModel));
    } catch (error) {
      setModelConnection({
        state: "missing",
        detail:
          error instanceof Error
            ? `OpenRouter rejected the key: ${error.message}`
            : "OpenRouter rejected the key",
      });
      appendOpenCodeEvent("model.failed", "OpenRouter key test failed");
    }
  }

  async function testOllamaConnection() {
    const endpoint = ollamaEndpoint.trim();
    const model = ollamaModel.trim();
    if (!endpoint) {
      setModelConnection({
        state: "missing",
        detail: "Ollama endpoint required",
      });
      return;
    }
    if (!model) {
      setModelConnection({
        state: "missing",
        detail: "Ollama model required",
      });
      return;
    }

    setModelConnection({
      state: "testing",
      detail: "Checking Ollama",
    });

    try {
      if (!isTauriRuntime()) {
        const baseUrl = normalizeLocalEndpoint(endpoint, "11434");
        const detail = "Native app checks Ollama locally";
        setModelConnection({
          state: "warning",
          detail,
          baseUrl,
          model,
          models: [],
        });
        appendOpenCodeEvent("model.warning", detail);
        return;
      }

      const result = await invoke<OllamaEndpointStatus>("check_ollama_endpoint", {
        request: { endpoint, model },
      });

      setModelConnection({
        state: result.state,
        detail: result.detail,
        baseUrl: result.baseUrl,
        model: result.model,
        models: result.models,
      });
      appendOpenCodeEvent(
        result.state === "ready" ? "model.ready" : "model.warning",
        result.detail,
      );
    } catch (error) {
      const detail =
        error instanceof Error ? `Ollama check failed: ${error.message}` : "Ollama check failed";
      setModelConnection({
        state: "missing",
        detail,
        baseUrl: endpoint,
        model,
        models: [],
      });
      appendOpenCodeEvent("model.failed", detail);
    }
  }

  async function testComfyUiConnection() {
    if (!enhancements.spriteGeneration) {
      setComfyUiConnection((current) => ({
        ...current,
        state: "warning",
        detail: "Enable AI sprites first",
        checks: [],
      }));
      return;
    }

    const endpoint = comfyUiEndpoint.trim();
    const checkpoint = comfyUiCheckpoint.trim() || defaultComfyUiCheckpoint;
    const lora = comfyUiLora.trim() || defaultComfyUiLora;
    if (!endpoint) {
      setComfyUiConnection((current) => ({
        ...current,
        state: "missing",
        detail: "ComfyUI endpoint required",
        checks: [],
      }));
      return;
    }

    setComfyUiConnection((current) => ({
      ...current,
      state: "testing",
      detail: "Checking ComfyUI",
      checks: [],
    }));

    try {
      const result = isTauriRuntime()
        ? await invoke<ComfyUiEndpointStatus>("check_comfyui_endpoint", {
            request: { endpoint, checkpoint, lora },
          })
        : await checkComfyUiEndpointInBrowser(endpoint, checkpoint, lora);

      setComfyUiConnection(result);
      appendOpenCodeEvent(
        result.state === "ready" ? "comfyui.ready" : "comfyui.missing",
        result.detail,
      );
    } catch (error) {
      const detail =
        error instanceof Error ? `ComfyUI check failed: ${error.message}` : "ComfyUI check failed";
      setComfyUiConnection((current) => ({
        ...current,
        state: "missing",
        detail,
        checks: [
          {
            name: "API",
            state: "missing",
            detail,
          },
        ],
      }));
      appendOpenCodeEvent("comfyui.failed", detail);
    }
  }

  function handleOpenRouterKeyChange(value: string) {
    setOpenRouterKey(value);
    resetModelConnectionIfChecked("OpenRouter not tested");
  }

  function handleProviderChange(value: ModelProvider) {
    setModelProvider(value);
    setModelConnection({
      state: "idle",
      detail: value === "openrouter" ? "OpenRouter not tested" : "Ollama not tested",
    });
    if (value === "ollama") {
      setShowOpenRouterKey(false);
    }
    noteAction(
      value === "openrouter"
        ? "Model provider switched to OpenRouter."
        : "Model provider switched to Ollama.",
    );
  }

  function handleOpenRouterModelChange(value: string) {
    setActiveModel(value);
    resetModelConnectionIfChecked("OpenRouter not tested");
  }

  function handleOllamaEndpointChange(value: string) {
    setOllamaEndpoint(value);
    resetModelConnectionIfChecked("Ollama not tested");
  }

  function handleOllamaModelChange(value: string) {
    setOllamaModel(value);
    resetModelConnectionIfChecked("Ollama not tested");
  }

  function resetModelConnectionIfChecked(detail: string) {
    if (modelConnection.state !== "idle" && modelConnection.state !== "testing") {
      setModelConnection({
        state: "idle",
        detail,
      });
    }
  }

  function handleComfyUiEndpointChange(value: string) {
    setComfyUiEndpoint(value);
    resetComfyUiConnectionIfChecked();
  }

  function handleComfyUiCheckpointChange(value: string) {
    setComfyUiCheckpoint(value);
    resetComfyUiConnectionIfChecked();
  }

  function handleComfyUiLoraChange(value: string) {
    setComfyUiLora(value);
    resetComfyUiConnectionIfChecked();
  }

  function resetComfyUiConnectionIfChecked() {
    if (
      comfyUiConnection.state === "ready" ||
      comfyUiConnection.state === "missing" ||
      comfyUiConnection.state === "warning"
    ) {
      setComfyUiConnection((current) => ({
        ...current,
        state: "idle",
        detail: "Not tested",
        checks: [],
      }));
    }
  }

  function handleEnhancementChange(key: keyof EnhancementSettings, enabled: boolean) {
    setEnhancements((current) => ({
      ...current,
      [key]: enabled,
    }));

    if (key === "spriteGeneration" && !enabled) {
      setComfyUiConnection((current) => ({
        ...current,
        state: "idle",
        detail: "Not tested",
        checks: [],
      }));
    }

    appendOpenCodeEvent(
      enabled ? "enhancement.enabled" : "enhancement.disabled",
      key === "spriteGeneration" ? "ComfyUI sprites" : "MML music",
    );
  }

  function resetPreview() {
    setTransport("running");
    setBuildState("running");
    setSpriteX(52);
    noteAction("Starter ROM reset requested.");
    appendOpenCodeEvent("starter.reset", "Starter ROM reset requested");
    void launchStarterRom("Starter ROM reset and running.");
  }

  function startNewProject() {
    setMessages([
      makeMessage(
        "agent",
        "New starter project ready. It uses the blank SGDK template; ask for sprite and music when you want the CORE demo.",
      ),
    ]);
    setDraft("");
    setExportResult(undefined);
    setSaveResult(undefined);
    setV1PromptResult(undefined);
    setV1PromptSource("idle");
    setOpenCodeSessionId(undefined);
    setTransport("running");
    setSpriteX(52);
    setProjectSummary(previewProjectSummary);
    setProjectSource(isTauriRuntime() ? "checking" : "preview");
    noteAction("New project started from the blank starter template.");
    appendOpenCodeEvent("project.new", "Blank starter template loaded");
    void loadProjectSummary();
    void launchStarterRom("New starter project running.");
  }

  async function saveProject() {
    setSaveBusy(true);
    noteAction("Saving the current project snapshot.");

    if (!isTauriRuntime()) {
      setSaveResult(previewSaveResult);
      appendOpenCodeEvent("project.save.preview", previewSaveResult.snapshotPath);
      noteAction(`Preview save ready at ${previewSaveResult.snapshotPath}.`);
      setSaveBusy(false);
      return;
    }

    try {
      const result = await invoke<ProjectSaveResult>("save_current_project");
      setSaveResult(result);
      appendOpenCodeEvent("project.saved", result.snapshotPath);
      noteAction(`Project saved to ${result.snapshotPath}.`);
      void loadProjectSummary();
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Project save failed";
      setSaveResult({
        ...previewSaveResult,
        status: "missing",
        detail,
        generatedAt: "error",
      });
      appendOpenCodeEvent("project.save.failed", detail);
      noteAction(`Project save failed: ${detail}`);
    } finally {
      setSaveBusy(false);
    }
  }

  function runCurrentProject() {
    noteAction("Running the current starter ROM.");
    appendOpenCodeEvent("run.started", projectSummary.romPath);
    void launchStarterRom("Current starter ROM is running.");
  }

  function toggleEmulatorFocus() {
    setEmulatorFocused((current) => {
      const next = !current;
      noteAction(next ? "Focused emulator view enabled." : "Focused emulator view closed.");
      appendOpenCodeEvent(next ? "view.focused" : "view.restored", "Emulator view");
      return next;
    });
  }

  async function refreshPreflight() {
    setPreflightSource("checking");
    noteAction("Checking tool health.");

    if (!isTauriRuntime()) {
      setPreflight(previewPreflight);
      setPreflightSource("preview");
      noteAction("Preview checks are limited. Native app preflight shows exact setup needs.");
      return;
    }

    try {
      const report = await invoke<PreflightReport>("run_preflight");
      setPreflight(report);
      setPreflightSource("tauri");
      noteAction(`Tool health: ${preflightSummaryLabel(report.summaryState, "tauri")}.`);
    } catch (error) {
      setPreflight({
        generatedAt: "error",
        summaryState: "warning",
        checks: [
          {
            name: "Preflight",
            state: "warning",
            detail:
              error instanceof Error
                ? error.message
                : "Native preflight was not available",
          },
        ],
      });
      setPreflightSource("error");
      noteAction("Tool health check command was unavailable.");
    }
  }

  async function launchStarterRom(doneMessage = "Starter ROM running.") {
    setStarterBusy(true);
    setStarterSource("checking");
    setBuildState("building");
    noteAction("Launching starter ROM.");

    if (!isTauriRuntime()) {
      setStarterRom(makePreviewStarterRom());
      setStarterSource("preview");
      setBuildState("running");
      noteAction(`${doneMessage} Browser preview is using simulated frames.`);
      setStarterBusy(false);
      return;
    }

    try {
      const preview = await invoke<StarterRomPreview>("launch_starter_rom");
      setStarterRom(preview);
      setStarterSource("tauri");
      setBuildState("running");
      noteAction(doneMessage);
    } catch (error) {
      setStarterRom({
        ...previewStarterRom,
        status: "warning",
        detail:
          error instanceof Error
            ? error.message
            : "Starter ROM launch was not available",
        generatedAt: "error",
      });
      setStarterSource("error");
      setBuildState("error");
      noteAction("Starter ROM could not launch.");
    } finally {
      setStarterBusy(false);
    }
  }

  return (
    <main className={`app-shell ${emulatorFocused ? "emulator-focused" : ""}`}>
      <TopBar
        actionDetail={actionDetail}
        buildLabel={buildLabel}
        buildState={buildState}
        exportBusy={exportBusy}
        menuOpen={projectMenuOpen}
        onExportRom={() => {
          void exportRom();
        }}
        onRunProject={runCurrentProject}
        onSaveProject={() => {
          void saveProject();
        }}
        onToggleMenu={() => setProjectMenuOpen((current) => !current)}
        runBusy={starterBusy || buildState === "building"}
        saveBusy={saveBusy}
      />

      <section className="workspace" aria-label="Drive16 workspace">
        <aside className="left-pane" aria-label="Conversation and project">
          <div className="pane-header">
            <div>
              <p className="label">Conversation</p>
              <h1>Drive16 Agent</h1>
            </div>
            <div className="header-tools">
              <div
                className={`opencode-chip ${openCode.state}`}
                data-testid="opencode-bridge-status"
                title={openCode.detail}
              >
                {healthIcon(openCode.state)}
                <span>{openCode.state === "ready" ? "OpenCode live" : "OpenCode check"}</span>
              </div>
              <button
                className="icon-button"
                aria-label="Agent settings"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings size={18} />
              </button>
            </div>
          </div>

          <div className="agent-config-row" data-testid="agent-config-row">
            <span title={providerTitle(modelProvider, activeModel, ollamaEndpoint, ollamaModel)}>
              <KeyRound size={15} />
              Inference
              <strong>{providerDisplayLabel(modelProvider, activeModel, ollamaModel)}</strong>
            </span>
            <button type="button" onClick={() => setSettingsOpen(true)}>
              Agent Settings
            </button>
          </div>

          <div
            className={`conversation-mode-panel ${conversationMode.state}`}
            data-testid="conversation-mode-panel"
          >
            <span>
              {healthIcon(conversationMode.state)}
              Mode
              <strong>{conversationMode.label}</strong>
            </span>
            <small>{conversationMode.detail}</small>
          </div>

          <div className="messages" aria-label="Message history" ref={messagesRef}>
            {messages.map((message) => (
              <article
                className={`message ${message.role} ${message.source ?? ""}`}
                key={message.id}
              >
                <div className="message-meta">
                  <span>{messageMetaLabel(message)}</span>
                  <time>{message.time}</time>
                </div>
                <p>{message.body}</p>
              </article>
            ))}
          </div>

          <div className="split-panel">
            <section className="tool-stream" aria-label="Agent steps">
              <SectionTitle icon={<TerminalSquare size={16} />} title="Run" />
              <ol>
                {runSteps.map((step) => (
                  <li className={step.state} key={step.label}>
                    <span className="step-dot" aria-hidden="true">
                      {step.state === "done" ? (
                        <CheckCircle2 size={14} />
                      ) : step.state === "active" ? (
                        <Activity size={14} />
                      ) : (
                        <Circle size={14} />
                      )}
                    </span>
                    <span>
                      <strong>{step.label}</strong>
                      <small>{step.detail}</small>
                    </span>
                  </li>
                ))}
              </ol>
              <div className="event-feed" data-testid="opencode-event-feed">
                <strong>Events</strong>
                {openCodeEvents.length > 0 ? (
                  openCodeEvents.map((event) => (
                    <p key={event.id}>
                      <span>{event.time}</span>
                      <b>{event.type}</b>
                      <small>{event.detail}</small>
                    </p>
                  ))
                ) : (
                  <p>
                    <span>{sourceLabel(openCodeSource, "OpenCode bridge")}</span>
                    <b>{openCode.state === "ready" ? "ready" : "waiting"}</b>
                    <small>{openCode.detail}</small>
                  </p>
                )}
              </div>
            </section>

            <section className="file-tree" aria-label="Project files">
              <SectionTitle icon={<FolderTree size={16} />} title="Files" />
              <div className="project-summary" data-testid="project-summary">
                <strong>{projectSummary.name}</strong>
                <span title={projectSummary.projectPath}>
                  {shortPath(projectSummary.projectPath)}
                </span>
                <small>{sourceLabel(projectSource, "Native project")}</small>
              </div>
              <ul>
                {projectSummary.files.map((file) => (
                  <li className={file.state} key={file.path}>
                    <Code2 size={14} />
                    <span>
                      <b>{file.label}</b>
                      <small title={file.path}>{shortPath(file.path)}</small>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <form className="composer" onSubmit={submitMessage}>
            <MessageSquareText size={18} />
            <input
              aria-label="Message Drive16"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask Drive16 to change the ROM"
            />
            <button aria-label="Send message" type="submit" disabled={openCodeBusy}>
              <Send size={18} />
            </button>
          </form>
        </aside>

        <section className="right-pane" aria-label="Live emulator">
          <div className="emulator-toolbar">
            <div>
              <p className="label">Live ROM</p>
              <h2>{projectSummary.name}</h2>
            </div>
            <div className="toolbar-actions" aria-label="Emulator actions">
              <IconControl
                label={transport === "running" ? "Pause emulator" : "Resume emulator"}
                onClick={() => {
                  const next = transport === "running" ? "paused" : "running";
                  setTransport(next);
                  noteAction(next === "running" ? "Emulator resumed." : "Emulator paused.");
                  appendOpenCodeEvent(
                    next === "running" ? "emulator.resumed" : "emulator.paused",
                    projectSummary.romPath,
                  );
                }}
              >
                {transport === "running" ? <Pause size={18} /> : <Play size={18} />}
              </IconControl>
              <IconControl
                label="Launch starter ROM"
                onClick={resetPreview}
                disabled={starterBusy}
              >
                <RefreshCcw size={18} />
              </IconControl>
              <IconControl
                label={emulatorFocused ? "Exit focused emulator" : "Focus emulator"}
                onClick={toggleEmulatorFocus}
              >
                {emulatorFocused ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </IconControl>
            </div>
          </div>

          <div className="emulator-frame">
            <div className="screen-bezel">
              <div
                className={`genesis-screen ${transport} ${
                  starterRom.framebufferFrames.length > 0
                    ? "framebuffer"
                    : starterRom.screenshotDataUrl
                      ? "captured"
                      : "fallback"
                }`}
                data-testid="starter-rom-screen"
              >
                <FramebufferCanvas
                  fallback={
                    starterRom.screenshotDataUrl ? (
                      <img
                        className="starter-frame"
                        src={starterRom.screenshotDataUrl}
                        alt="Starter project ROM frame"
                      />
                    ) : (
                      <>
                        <div className="scanlines" />
                        <span className="screen-title">DRIVE16 BLANK ROM</span>
                        <span className="screen-status">
                          {starterBusy
                            ? "LOADING"
                            : transport === "running"
                              ? "PREVIEW"
                              : "PAUSED"}
                        </span>
                        <span
                          className="sprite-cursor"
                          style={{ left: `${spriteX}%` }}
                          aria-hidden="true"
                        />
                      </>
                    )
                  }
                  frames={starterRom.framebufferFrames}
                  streamEvery={starterRom.streamEvery}
                  transport={transport}
                />
                <span className={`screen-badge ${starterRom.status}`}>
                  {starterBadge(starterRom, starterBusy, transport)}
                </span>
              </div>
            </div>
          </div>

          <div className="status-grid">
            <section className="runtime-panel" aria-label="Runtime status">
              <SectionTitle icon={<Gamepad2 size={16} />} title="ROM" />
              <div
                className={`starter-summary ${starterRom.status}`}
                data-testid="starter-rom-summary"
              >
                {healthIcon(starterRom.status)}
                <span>{starterLabel(starterRom, starterBusy)}</span>
                <small>{sourceLabel(starterSource, "Native starter ROM")}</small>
              </div>
              <div className="rom-metadata">
                <span>ROM</span>
                <strong title={projectSummary.romPath}>{shortPath(projectSummary.romPath)}</strong>
                <span>Frame</span>
                <strong>{starterRom.frames} frames</strong>
                <span>Stream</span>
                <strong>
                  {starterRom.streamedFrames > 0
                    ? `${starterRom.streamedFrames} frames`
                    : "Pending"}
                </strong>
                <span>Canvas</span>
                <strong>
                  {starterRom.framebufferFrames.length > 0
                    ? `${starterRom.frameWidth}x${starterRom.frameHeight}`
                    : "Pending"}
                </strong>
                <span>Export</span>
                <strong title={exportResult?.exportPath ?? projectSummary.exportDirectory}>
                  {exportResult
                    ? `${formatBytes(exportResult.bytes)} exported`
                    : shortPath(projectSummary.exportDirectory)}
                </strong>
                <span>Movement</span>
                <strong title={v1PromptResult?.movementDetail ?? v1PromptSource}>
                  {v1PromptResult ? "Right input verified" : "Pending"}
                </strong>
                <span>Audio</span>
                <strong>
                  {v1PromptResult
                    ? `Non-silent ${v1PromptResult.audioMaxAbs}`
                    : "Pending"}
                </strong>
              </div>
            </section>

            <section className="runtime-panel" aria-label="Tool health">
              <div className="panel-title-row">
                <SectionTitle icon={<Wrench size={16} />} title="Tools" />
                <button
                  className="refresh-health"
                  type="button"
                  aria-label="Refresh tool health"
                  data-testid="refresh-health"
                  onClick={refreshPreflight}
                >
                  <RefreshCcw size={14} />
                </button>
              </div>
              <div
                className={`preflight-summary ${preflight.summaryState}`}
                data-testid="preflight-summary"
              >
                {healthIcon(preflight.summaryState)}
                <span>{preflightSummaryLabel(preflight.summaryState, preflightSource)}</span>
                <small>{sourceLabel(preflightSource)}</small>
              </div>
              <div className="health-list" data-testid="tool-health-list">
                {preflight.checks.map((tool) => (
                  <div className={`health-item ${tool.state}`} key={tool.name}>
                    <span>{tool.name}</span>
                    <strong>{stateLabel(tool.state)}</strong>
                    <small>{tool.detail}</small>
                    {tool.hints && tool.hints.length > 0 ? (
                      <ul className="health-hints" aria-label={`${tool.name} setup hints`}>
                        {tool.hints.map((hint) => (
                          <li key={hint}>{hint}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>
      </section>
      {settingsOpen ? (
        <SettingsPanel
          activeModel={activeModel}
          comfyUiCheckpoint={comfyUiCheckpoint}
          comfyUiConnection={comfyUiConnection}
          comfyUiEndpoint={comfyUiEndpoint}
          comfyUiLora={comfyUiLora}
          connection={modelConnection}
          enhancements={enhancements}
          modelOptions={modelOptions}
          modelProvider={modelProvider}
          modelsSource={modelsSource}
          ollamaEndpoint={ollamaEndpoint}
          ollamaModel={ollamaModel}
          openRouterKey={openRouterKey}
          showOpenRouterKey={showOpenRouterKey}
          onClose={() => setSettingsOpen(false)}
          onComfyUiCheckpointChange={handleComfyUiCheckpointChange}
          onComfyUiEndpointChange={handleComfyUiEndpointChange}
          onComfyUiLoraChange={handleComfyUiLoraChange}
          onEnhancementChange={handleEnhancementChange}
          onModelChange={handleOpenRouterModelChange}
          onOllamaEndpointChange={handleOllamaEndpointChange}
          onOllamaModelChange={handleOllamaModelChange}
          onOpenRouterKeyChange={handleOpenRouterKeyChange}
          onProviderChange={handleProviderChange}
          onRefreshModels={refreshOpenRouterModels}
          onShowOpenRouterKeyChange={setShowOpenRouterKey}
          onTestComfyUiConnection={testComfyUiConnection}
          onTestConnection={testModelConnection}
        />
      ) : null}
      {projectMenuOpen ? (
        <ProjectMenu
          activeModel={activeModel}
          exportBusy={exportBusy}
          exportResult={exportResult}
          modelProvider={modelProvider}
          ollamaEndpoint={ollamaEndpoint}
          ollamaModel={ollamaModel}
          preflight={preflight}
          projectSummary={projectSummary}
          saveBusy={saveBusy}
          saveResult={saveResult}
          onClose={() => setProjectMenuOpen(false)}
          onExportRom={() => {
            void exportRom();
          }}
          onNewProject={() => {
            startNewProject();
            setProjectMenuOpen(false);
          }}
          onOpenSettings={() => {
            setProjectMenuOpen(false);
            setSettingsOpen(true);
          }}
          onSaveProject={() => {
            void saveProject();
          }}
        />
      ) : null}
    </main>
  );
}

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function isV1Prompt(text: string) {
  const normalized = text.toLowerCase();
  return (
    normalized.includes("sprite") &&
    normalized.includes("music") &&
    (normalized.includes("move") || normalized.includes("left") || normalized.includes("right"))
  );
}

function promptReadyMessage(generatedMusic: boolean, generatedSprite: boolean) {
  if (generatedMusic && generatedSprite) {
    return isTauriRuntime()
      ? "Built and verified the generated sprite with generated MML music. Right input moved the sprite, audio is non-silent, and the ROM is running on the right."
      : "Previewed the generated sprite and MML music flow. The native app command builds the ROM, verifies Right-input movement, and checks non-silent audio.";
  }
  if (generatedMusic) {
    return isTauriRuntime()
      ? "Built and verified the bundled sprite with generated MML music. Right input moved the sprite, audio is non-silent, and the ROM is running on the right."
      : "Previewed the generated MML music flow. The native app command builds the ROM, verifies Right-input movement, and checks non-silent audio.";
  }
  return isTauriRuntime()
    ? "Built and verified the bundled sprite/music ROM. Right input moved the sprite, audio is non-silent, and the ROM is running on the right."
    : "Previewed the bundled sprite/music ROM flow. The native app command builds the ROM, verifies Right-input movement, and checks non-silent audio.";
}

function messageMetaLabel(message: Message) {
  if (message.role === "user") return "You";
  if (message.source === "opencode") return "OpenCode log";
  if (message.source === "model") return "Model";
  return "Local proof";
}

function getConversationMode(
  provider: ModelProvider,
  activeModel: string,
  ollamaModel: string,
  connection: ModelConnectionReport,
  openCode: OpenCodeBridgeStatus,
): ConversationMode {
  const providerLabel = providerDisplayLabel(provider, activeModel, ollamaModel);

  if (connection.state !== "ready") {
    return {
      state: "warning",
      label: "ROM proof only",
      detail: `${providerLabel} is ${connectionLabel(
        connection.state,
      ).toLowerCase()}; freeform model replies are paused.`,
    };
  }

  if (openCode.state !== "ready") {
    return {
      state: "warning",
      label: "Provider checked",
      detail: `OpenCode is ${stateLabel(
        openCode.state,
      ).toLowerCase()}; freeform model replies are paused.`,
    };
  }

  return {
    state: "warning",
    label: "OpenCode no-reply",
    detail: "Provider and OpenCode are reachable; this shell logs freeform messages without live answer streaming.",
  };
}

function freeformGateMessage(
  provider: ModelProvider,
  activeModel: string,
  ollamaModel: string,
  connection: ModelConnectionReport,
  openCode: OpenCodeBridgeStatus,
) {
  const providerLabel = providerDisplayLabel(provider, activeModel, ollamaModel);

  if (connection.state !== "ready") {
    return `${providerLabel} is ${connectionLabel(
      connection.state,
    ).toLowerCase()}. Freeform model replies are paused; ROM-changing prompts still use the verified local build path.`;
  }

  if (openCode.state !== "ready") {
    return `OpenCode is ${stateLabel(
      openCode.state,
    ).toLowerCase()}. Freeform model replies are paused; ROM-changing prompts still use the verified local build path.`;
  }

  return undefined;
}

function preflightSummaryLabel(state: HealthState, source = "") {
  if (source === "preview" && state === "warning") return "Preview checks limited";
  if (state === "ready") return "All core tools ready";
  if (state === "missing") return "Setup needed";
  return "Needs attention";
}

function stateLabel(state: HealthState) {
  if (state === "ready") return "Ready";
  if (state === "missing") return "Missing";
  return "Check";
}

function sourceLabel(source: string, nativeLabel = "Native preflight") {
  if (source === "tauri") return nativeLabel;
  if (source === "checking") return "Checking";
  if (source === "error") return "Command unavailable";
  return "Preview mode";
}

function starterLabel(preview: StarterRomPreview, busy: boolean) {
  if (busy) return "Launching starter ROM";
  if (preview.status === "ready" && preview.framebufferFrames.length > 0) {
    return "Framebuffer stream loaded";
  }
  if (preview.status === "ready") return "Starter ROM loaded";
  if (preview.generatedAt === "error") return "Starter ROM unavailable";
  return "Starter ROM preview";
}

function starterBadge(
  preview: StarterRomPreview,
  busy: boolean,
  transport: TransportState,
) {
  if (busy) return "LOADING";
  if (transport === "paused") return "PAUSED";
  if (preview.status === "ready" && preview.framebufferFrames.length > 0) {
    return "RGB565";
  }
  if (preview.status === "ready") return "GENTEEL";
  return "PREVIEW";
}

function shortPath(path: string) {
  const parts = path.split("/").filter(Boolean);
  if (parts.length <= 3) return path;
  return `${parts[0]}/${parts[1]}/.../${parts[parts.length - 1]}`;
}

function shortIdentifier(value: string) {
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function formatBytes(bytes: number) {
  if (bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function healthIcon(state: HealthState) {
  if (state === "ready") return <CheckCircle2 size={15} />;
  if (state === "missing") return <AlertCircle size={15} />;
  return <Activity size={15} />;
}

function FramebufferCanvas({
  fallback,
  frames,
  streamEvery,
  transport,
}: {
  fallback: ReactNode;
  frames: FramebufferFrame[];
  streamEvery: number;
  transport: TransportState;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [frameCursor, setFrameCursor] = useState(0);
  const decodedFrames = useMemo(() => decodeFramebufferFrames(frames), [frames]);
  const activeFrame =
    decodedFrames.length > 0 ? decodedFrames[frameCursor % decodedFrames.length] : null;

  useEffect(() => {
    setFrameCursor(0);
  }, [decodedFrames.length]);

  useEffect(() => {
    if (transport !== "running" || decodedFrames.length <= 1) return;

    const intervalMs = Math.max(90, Math.round((streamEvery / 60) * 1000));
    const timer = window.setInterval(() => {
      setFrameCursor((value) => (value + 1) % decodedFrames.length);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [decodedFrames.length, streamEvery, transport]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activeFrame) return;

    canvas.width = activeFrame.width;
    canvas.height = activeFrame.height;
    const context = canvas.getContext("2d");
    if (!context) return;

    const imageData = context.createImageData(activeFrame.width, activeFrame.height);
    imageData.data.set(activeFrame.rgba);
    context.putImageData(imageData, 0, 0);
  }, [activeFrame]);

  if (!activeFrame) {
    return <>{fallback}</>;
  }

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-label="Genteel framebuffer"
        className="framebuffer-canvas"
        data-frame-index={activeFrame.frameIndex}
        data-testid="framebuffer-canvas"
      />
      <span className="frame-index" data-testid="framebuffer-frame-index">
        Frame {activeFrame.frameIndex}
      </span>
    </>
  );
}

function decodeFramebufferFrames(frames: FramebufferFrame[]) {
  return frames.flatMap((frame) => {
    if (frame.format !== "RGB565") return [];
    const bytes = base64ToBytes(frame.rgb565Data);
    const expectedLength = frame.width * frame.height * 2;
    if (bytes.length !== expectedLength) return [];

    const rgba = new Uint8ClampedArray(frame.width * frame.height * 4);
    for (let sourceIndex = 0, targetIndex = 0; sourceIndex < bytes.length; sourceIndex += 2) {
      const value = bytes[sourceIndex] | (bytes[sourceIndex + 1] << 8);
      const red = (value >> 11) & 0x1f;
      const green = (value >> 5) & 0x3f;
      const blue = value & 0x1f;
      rgba[targetIndex] = (red << 3) | (red >> 2);
      rgba[targetIndex + 1] = (green << 2) | (green >> 4);
      rgba[targetIndex + 2] = (blue << 3) | (blue >> 2);
      rgba[targetIndex + 3] = 255;
      targetIndex += 4;
    }

    return [
      {
        frameIndex: frame.frameIndex,
        width: frame.width,
        height: frame.height,
        rgba,
      },
    ];
  });
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function makePreviewStarterRom(): StarterRomPreview {
  const framebufferFrames = [
    makePreviewFrame(0, 0x3944),
    makePreviewFrame(30, 0x4145),
  ];

  return {
    ...previewStarterRom,
    framebufferFrames,
    streamedFrames: framebufferFrames.length,
  };
}

function makePreviewFrame(frameIndex: number, color: number): FramebufferFrame {
  const width = 320;
  const height = 240;
  const bytes = new Uint8Array(width * height * 2);
  for (let index = 0; index < bytes.length; index += 2) {
    bytes[index] = color & 0xff;
    bytes[index + 1] = color >> 8;
  }

  return {
    frameIndex,
    width,
    height,
    format: "RGB565",
    rgb565Data: bytesToBase64(bytes),
  };
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 32768;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function shortModelLabel(model: string) {
  const clean = model.replace(/^~/, "");
  const pathParts = clean.split("/");
  const slug = pathParts[pathParts.length - 1] ?? clean;
  return slug
    .split("-")
    .filter(Boolean)
    .map((part: string) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function shortOllamaLabel(model: string) {
  const clean = model.trim();
  if (!clean) return "Local model";
  return clean
    .split(/[-_:/]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function providerDisplayLabel(
  provider: ModelProvider,
  activeModel: string,
  ollamaModel: string,
) {
  if (provider === "openrouter") return shortModelLabel(activeModel);
  return `Ollama ${shortOllamaLabel(ollamaModel)}`;
}

function providerTitle(
  provider: ModelProvider,
  activeModel: string,
  ollamaEndpoint: string,
  ollamaModel: string,
) {
  if (provider === "openrouter") return activeModel;
  return `${ollamaModel || "Ollama model"} at ${ollamaEndpoint || defaultOllamaEndpoint}`;
}

function connectionIcon(state: ConnectionState) {
  if (state === "ready") return <CheckCircle2 size={15} />;
  if (state === "missing") return <AlertCircle size={15} />;
  if (state === "testing") return <Activity size={15} />;
  return <Circle size={15} />;
}

function connectionLabel(state: ConnectionState) {
  if (state === "ready") return "Connected";
  if (state === "missing") return "Failed";
  if (state === "testing") return "Testing";
  if (state === "warning") return "Check";
  return "Not tested";
}

function modelsSourceLabel(source: string) {
  if (source === "ready") return "Models live";
  if (source === "loading") return "Models loading";
  if (source === "error") return "Fallback models";
  return "Fallback models";
}

async function checkComfyUiEndpointInBrowser(
  endpoint: string,
  _checkpoint: string,
  _lora: string,
): Promise<ComfyUiEndpointStatus> {
  const baseUrl = normalizeComfyUiEndpoint(endpoint);
  const systemStatsUrl = `${baseUrl}/system_stats`;
  const response = await fetch(systemStatsUrl, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const stats = (await response.json()) as {
    system?: { comfyui_version?: string };
    devices?: unknown[];
  };
  if (!stats.system) {
    throw new Error("system stats missing");
  }

  return {
    generatedAt: Date.now().toString(),
    state: "ready",
    detail: "ComfyUI system stats available",
    baseUrl,
    systemStatsUrl,
    version: stats.system.comfyui_version,
    devices: Array.isArray(stats.devices) ? stats.devices.length : 0,
    checks: [
      {
        name: "API",
        state: "ready",
        detail: "System stats available",
      },
    ],
  };
}

function normalizeComfyUiEndpoint(endpoint: string) {
  return normalizeLocalEndpoint(endpoint, "8188");
}

function normalizeLocalEndpoint(endpoint: string, defaultPort: string) {
  const trimmed = endpoint.trim().replace(/\/+$/, "");
  if (!trimmed) {
    throw new Error("endpoint required");
  }

  const withScheme = trimmed.includes("://") ? trimmed : `http://${trimmed}`;
  const parsed = new URL(withScheme);
  if (parsed.protocol !== "http:") {
    throw new Error("use local http endpoint");
  }
  if (parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") {
    throw new Error("endpoint must be local");
  }

  const port = parsed.port || defaultPort;
  return `http://${parsed.hostname}:${port}`;
}

function SettingsPanel({
  activeModel,
  comfyUiCheckpoint,
  comfyUiConnection,
  comfyUiEndpoint,
  comfyUiLora,
  connection,
  enhancements,
  modelOptions,
  modelProvider,
  modelsSource,
  ollamaEndpoint,
  ollamaModel,
  openRouterKey,
  showOpenRouterKey,
  onClose,
  onComfyUiCheckpointChange,
  onComfyUiEndpointChange,
  onComfyUiLoraChange,
  onEnhancementChange,
  onModelChange,
  onOllamaEndpointChange,
  onOllamaModelChange,
  onOpenRouterKeyChange,
  onProviderChange,
  onRefreshModels,
  onShowOpenRouterKeyChange,
  onTestComfyUiConnection,
  onTestConnection,
}: {
  activeModel: string;
  comfyUiCheckpoint: string;
  comfyUiConnection: ComfyUiEndpointStatus;
  comfyUiEndpoint: string;
  comfyUiLora: string;
  connection: ModelConnectionReport;
  enhancements: EnhancementSettings;
  modelOptions: ModelOption[];
  modelProvider: ModelProvider;
  modelsSource: string;
  ollamaEndpoint: string;
  ollamaModel: string;
  openRouterKey: string;
  showOpenRouterKey: boolean;
  onClose: () => void;
  onComfyUiCheckpointChange: (value: string) => void;
  onComfyUiEndpointChange: (value: string) => void;
  onComfyUiLoraChange: (value: string) => void;
  onEnhancementChange: (key: keyof EnhancementSettings, enabled: boolean) => void;
  onModelChange: (value: string) => void;
  onOllamaEndpointChange: (value: string) => void;
  onOllamaModelChange: (value: string) => void;
  onOpenRouterKeyChange: (value: string) => void;
  onProviderChange: (value: ModelProvider) => void;
  onRefreshModels: () => void;
  onShowOpenRouterKeyChange: (value: boolean) => void;
  onTestComfyUiConnection: () => void;
  onTestConnection: () => void;
}) {
  const testing = connection.state === "testing";
  const testingComfyUi = comfyUiConnection.state === "testing";

  return (
    <div className="settings-backdrop">
      <section
        aria-label="Agent settings"
        aria-modal="true"
        className="settings-panel"
        role="dialog"
      >
        <div className="settings-header">
          <div>
            <p className="label">Settings</p>
            <h2>Agent Settings</h2>
          </div>
          <button className="icon-button" type="button" aria-label="Close settings" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="settings-body">
          <section className="settings-section" aria-label="Model provider">
            <SectionTitle icon={<Settings size={16} />} title="Provider" />
            <div className="segmented-control" role="group" aria-label="Model provider">
              <button
                className={modelProvider === "openrouter" ? "active" : ""}
                type="button"
                onClick={() => onProviderChange("openrouter")}
              >
                OpenRouter
              </button>
              <button
                className={modelProvider === "ollama" ? "active" : ""}
                type="button"
                onClick={() => onProviderChange("ollama")}
              >
                Ollama
              </button>
            </div>
          </section>

          {modelProvider === "openrouter" ? (
            <section
              className="settings-section"
              aria-label="OpenRouter settings"
              data-testid="openrouter-settings"
            >
              <div className="settings-section-title">
                <SectionTitle icon={<KeyRound size={16} />} title="OpenRouter" />
                <button
                  className="refresh-health"
                  type="button"
                  aria-label="Refresh OpenRouter models"
                  onClick={onRefreshModels}
                  disabled={modelsSource === "loading"}
                >
                  <RefreshCcw size={14} />
                </button>
              </div>

              <label className="field-row">
                <span>Model</span>
                <select
                  aria-label="OpenRouter model"
                  value={activeModel}
                  onChange={(event) => onModelChange(event.target.value)}
                >
                  {modelOptions.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field-row">
                <span>API key</span>
                <div className="secret-field">
                  <input
                    aria-label="OpenRouter API key"
                    autoComplete="off"
                    onChange={(event) => onOpenRouterKeyChange(event.target.value)}
                    spellCheck={false}
                    type={showOpenRouterKey ? "text" : "password"}
                    value={openRouterKey}
                  />
                  <button
                    aria-label={showOpenRouterKey ? "Hide OpenRouter key" : "Show OpenRouter key"}
                    disabled={!openRouterKey}
                    onClick={() => onShowOpenRouterKeyChange(!showOpenRouterKey)}
                    type="button"
                  >
                    {showOpenRouterKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>

              <div
                className={`connection-summary ${connection.state}`}
                data-testid="model-connection-status"
              >
                {connectionIcon(connection.state)}
                <span>{connectionLabel(connection.state)}</span>
                <small>{connection.detail}</small>
              </div>

              <div className="settings-meta">
                <span>{modelsSourceLabel(modelsSource)}</span>
                <strong>{shortModelLabel(activeModel)}</strong>
              </div>
            </section>
          ) : (
            <section
              className="settings-section"
              aria-label="Ollama settings"
              data-testid="ollama-settings"
            >
              <div className="settings-section-title">
                <SectionTitle icon={<TerminalSquare size={16} />} title="Ollama" />
              </div>

              <label className="field-row">
                <span>Endpoint</span>
                <input
                  aria-label="Ollama endpoint"
                  autoComplete="off"
                  onChange={(event) => onOllamaEndpointChange(event.target.value)}
                  spellCheck={false}
                  type="url"
                  value={ollamaEndpoint}
                />
              </label>

              <label className="field-row">
                <span>Model</span>
                <input
                  aria-label="Ollama model"
                  autoComplete="off"
                  onChange={(event) => onOllamaModelChange(event.target.value)}
                  spellCheck={false}
                  type="text"
                  value={ollamaModel}
                />
              </label>

              <div
                className={`connection-summary ${connection.state}`}
                data-testid="model-connection-status"
              >
                {connectionIcon(connection.state)}
                <span>{connectionLabel(connection.state)}</span>
                <small>{connection.detail}</small>
              </div>

              <div className="settings-meta">
                <span>No API key required</span>
                <strong title={connection.baseUrl ?? ollamaEndpoint}>
                  {shortOllamaLabel(connection.model ?? ollamaModel)}
                </strong>
              </div>
              {connection.models?.length ? (
                <div className="provider-model-list" data-testid="ollama-models">
                  <span>Installed models</span>
                  <strong title={connection.models.join(", ")}>
                    {connection.models.slice(0, 3).map(shortOllamaLabel).join(", ")}
                  </strong>
                </div>
              ) : null}
            </section>
          )}

          <section className="settings-section" aria-label="Enhancement toggles">
            <SectionTitle icon={<Wrench size={16} />} title="Enhancements" />
            <div className="enhancement-list">
              <label className="enhancement-toggle" data-testid="sprite-enhancement-toggle">
                <input
                  aria-label="AI sprites enhancement"
                  checked={enhancements.spriteGeneration}
                  onChange={(event) =>
                    onEnhancementChange("spriteGeneration", event.target.checked)
                  }
                  data-testid="sprite-enhancement-input"
                  type="checkbox"
                />
                <span className="toggle-switch" aria-hidden="true" />
                <span className="toggle-copy">
                  <strong>AI sprites</strong>
                  <small>ComfyUI generator</small>
                </span>
                <span className="toggle-status">
                  {enhancements.spriteGeneration ? "On" : "Off"}
                </span>
              </label>

              {enhancements.spriteGeneration ? (
                <div className="comfyui-config" data-testid="comfyui-config">
                  <label className="field-row">
                    <span>ComfyUI endpoint</span>
                    <div className="endpoint-field">
                      <input
                        aria-label="ComfyUI endpoint"
                        autoComplete="off"
                        data-testid="comfyui-endpoint-input"
                        onChange={(event) => onComfyUiEndpointChange(event.target.value)}
                        spellCheck={false}
                        type="url"
                        value={comfyUiEndpoint}
                      />
                      <button
                        aria-label="Test ComfyUI"
                        data-testid="test-comfyui"
                        disabled={testingComfyUi}
                        onClick={onTestComfyUiConnection}
                        type="button"
                      >
                        <ShieldCheck size={15} />
                        {testingComfyUi ? "Checking" : "Test"}
                      </button>
                    </div>
                  </label>

                  <label className="field-row">
                    <span>SDXL checkpoint</span>
                    <input
                      aria-label="ComfyUI checkpoint"
                      autoComplete="off"
                      data-testid="comfyui-checkpoint-input"
                      onChange={(event) => onComfyUiCheckpointChange(event.target.value)}
                      spellCheck={false}
                      type="text"
                      value={comfyUiCheckpoint}
                    />
                  </label>

                  <label className="field-row">
                    <span>Pixel art LoRA</span>
                    <input
                      aria-label="ComfyUI LoRA"
                      autoComplete="off"
                      data-testid="comfyui-lora-input"
                      onChange={(event) => onComfyUiLoraChange(event.target.value)}
                      spellCheck={false}
                      type="text"
                      value={comfyUiLora}
                    />
                  </label>

                  <div
                    className={`connection-summary ${comfyUiConnection.state}`}
                    data-testid="comfyui-connection-status"
                  >
                    {connectionIcon(comfyUiConnection.state)}
                    <span>{connectionLabel(comfyUiConnection.state)}</span>
                    <small>{comfyUiConnection.detail}</small>
                  </div>

                  {comfyUiConnection.checks.length ? (
                    <div className="readiness-list" data-testid="comfyui-readiness-checks">
                      {comfyUiConnection.checks.map((check) => (
                        <div className={`connection-summary ${check.state}`} key={check.name}>
                          {connectionIcon(check.state)}
                          <span>{check.name}</span>
                          <small>
                            {check.detail}
                            {check.hints?.length ? (
                              <span className="readiness-hints">
                                {check.hints.slice(0, 3).map((hint) => (
                                  <span key={hint}>{hint}</span>
                                ))}
                              </span>
                            ) : null}
                          </small>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="settings-meta">
                    <span>{comfyUiConnection.version ?? "Version pending"}</span>
                    <strong>{`${comfyUiConnection.devices} device${
                      comfyUiConnection.devices === 1 ? "" : "s"
                    }`}</strong>
                  </div>
                </div>
              ) : null}

              <label className="enhancement-toggle" data-testid="music-enhancement-toggle">
                <input
                  aria-label="MML music enhancement"
                  checked={enhancements.musicGeneration}
                  onChange={(event) =>
                    onEnhancementChange("musicGeneration", event.target.checked)
                  }
                  data-testid="music-enhancement-input"
                  type="checkbox"
                />
                <span className="toggle-switch" aria-hidden="true" />
                <span className="toggle-copy">
                  <strong>MML music</strong>
                  <small>ctrmml compiler</small>
                </span>
                <span className="toggle-status">
                  {enhancements.musicGeneration ? "On" : "Off"}
                </span>
              </label>
            </div>
            <div className="settings-meta">
              <span>CORE path</span>
              <strong>Bundled assets remain default</strong>
            </div>
          </section>
        </div>

        <div className="settings-footer">
          <button type="button" onClick={onClose}>
            Close
          </button>
          <button
            className="primary-action"
            type="button"
            onClick={onTestConnection}
            disabled={testing}
          >
            <ShieldCheck size={16} />
            {testing
              ? "Testing"
              : modelProvider === "openrouter"
                ? "Test OpenRouter"
                : "Test Ollama"}
          </button>
        </div>
      </section>
    </div>
  );
}

function TopBar({
  actionDetail,
  buildLabel,
  buildState,
  exportBusy,
  menuOpen,
  onExportRom,
  onRunProject,
  onSaveProject,
  onToggleMenu,
  runBusy,
  saveBusy,
}: {
  actionDetail: string;
  buildLabel: string;
  buildState: BuildState;
  exportBusy: boolean;
  menuOpen: boolean;
  onExportRom: () => void;
  onRunProject: () => void;
  onSaveProject: () => void;
  onToggleMenu: () => void;
  runBusy: boolean;
  saveBusy: boolean;
}) {
  return (
    <header className="top-bar">
      <div className="brand-cluster">
        <button
          className="menu-trigger"
          type="button"
          aria-label={menuOpen ? "Close project menu" : "Open project menu"}
          aria-expanded={menuOpen}
          data-testid="project-menu-toggle"
          onClick={onToggleMenu}
        >
          <Menu size={18} />
        </button>
        <div className="brand">
          <Box size={22} />
          <div>
            <strong>Drive16</strong>
            <span>Phase 5 hardening</span>
          </div>
        </div>
      </div>

      <div className="top-center">
        <div className="run-status" data-testid="run-status">
          <span className={`status-pill ${buildState}`}>
            <Square size={10} />
            {buildLabel}
          </span>
          <small title={actionDetail}>{actionDetail}</small>
        </div>
      </div>

      <nav className="top-actions" aria-label="Project actions">
        <button
          type="button"
          data-testid="run-project"
          onClick={onRunProject}
          disabled={runBusy}
        >
          <Play size={16} />
          {runBusy ? "Running" : "Run"}
        </button>
        <button
          type="button"
          data-testid="save-project"
          onClick={onSaveProject}
          disabled={saveBusy}
        >
          <Save size={16} />
          {saveBusy ? "Saving" : "Save"}
        </button>
        <button
          type="button"
          data-testid="export-rom"
          onClick={onExportRom}
          disabled={exportBusy}
        >
          <Download size={16} />
          {exportBusy ? "Exporting" : "Export"}
        </button>
      </nav>
    </header>
  );
}

function ProjectMenu({
  activeModel,
  exportBusy,
  exportResult,
  modelProvider,
  ollamaEndpoint,
  ollamaModel,
  preflight,
  projectSummary,
  saveBusy,
  saveResult,
  onClose,
  onExportRom,
  onNewProject,
  onOpenSettings,
  onSaveProject,
}: {
  activeModel: string;
  exportBusy: boolean;
  exportResult?: RomExportResult;
  modelProvider: ModelProvider;
  ollamaEndpoint: string;
  ollamaModel: string;
  preflight: PreflightReport;
  projectSummary: ProjectSummary;
  saveBusy: boolean;
  saveResult?: ProjectSaveResult;
  onClose: () => void;
  onExportRom: () => void;
  onNewProject: () => void;
  onOpenSettings: () => void;
  onSaveProject: () => void;
}) {
  const attentionChecks = preflight.checks.filter((check) => check.state !== "ready");

  return (
    <div className="project-menu-backdrop" onClick={onClose}>
      <aside
        className="project-menu"
        aria-label="Project menu"
        data-testid="project-menu"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="project-menu-header">
          <div>
            <p className="label">Project Menu</p>
            <h2>{projectSummary.name}</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Close project menu"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <div className="project-menu-body">
          <section className="menu-section" aria-label="Current project">
            <SectionTitle icon={<FolderOpen size={16} />} title="Current Project" />
            <div className="menu-meta-grid">
              <span>Project</span>
              <strong title={projectSummary.projectPath}>{shortPath(projectSummary.projectPath)}</strong>
              <span>ROM</span>
              <strong title={projectSummary.romPath}>
                {shortPath(projectSummary.romPath)}
              </strong>
              <span>Saved</span>
              <strong title={saveResult?.snapshotPath ?? "Not saved yet"}>
                {saveResult ? shortPath(saveResult.snapshotPath) : "Not saved yet"}
              </strong>
              <span>Export</span>
              <strong title={exportResult?.exportPath ?? projectSummary.exportDirectory}>
                {exportResult
                  ? shortPath(exportResult.exportPath)
                  : shortPath(projectSummary.exportDirectory)}
              </strong>
            </div>
          </section>

          <section className="menu-section" aria-label="Project actions">
            <SectionTitle icon={<Save size={16} />} title="Actions" />
            <div className="menu-action-list">
              <button type="button" data-testid="menu-new-project" onClick={onNewProject}>
                <Plus size={16} />
                <span>
                  <strong>New Project</strong>
                  <small>Reset to the blank starter template</small>
                </span>
              </button>
              <button
                type="button"
                data-testid="menu-save-project"
                onClick={onSaveProject}
                disabled={saveBusy}
              >
                <Save size={16} />
                <span>
                  <strong>{saveBusy ? "Saving Project" : "Save Project"}</strong>
                  <small>Snapshot the current project under artifacts</small>
                </span>
              </button>
              <button
                type="button"
                data-testid="menu-export-rom"
                onClick={onExportRom}
                disabled={exportBusy}
              >
                <Download size={16} />
                <span>
                  <strong>{exportBusy ? "Exporting ROM" : "Export ROM"}</strong>
                  <small>Copy the current ROM build for sharing</small>
                </span>
              </button>
            </div>
          </section>

          <section className="menu-section" aria-label="Recent projects">
            <SectionTitle icon={<FolderTree size={16} />} title="Projects" />
            <button className="project-choice active" type="button" onClick={onClose}>
              <strong>Starter Project</strong>
              <small>{shortPath(projectSummary.projectPath)}</small>
            </button>
          </section>

          <section className="menu-section" aria-label="Agent setup">
            <SectionTitle icon={<KeyRound size={16} />} title="Agent" />
            <div className="menu-meta-grid">
              <span>Inference</span>
              <strong title={providerTitle(modelProvider, activeModel, ollamaEndpoint, ollamaModel)}>
                {providerDisplayLabel(modelProvider, activeModel, ollamaModel)}
              </strong>
              <span>Setup</span>
              <strong>{preflightSummaryLabel(preflight.summaryState)}</strong>
            </div>
            <button
              className="menu-secondary-action"
              type="button"
              data-testid="menu-agent-settings"
              onClick={onOpenSettings}
            >
              <Settings size={16} />
              Agent Settings
            </button>
          </section>

          <section className="menu-section" aria-label="Needs attention">
            <SectionTitle icon={<AlertCircle size={16} />} title="Needs Attention" />
            <div className="attention-list">
              {attentionChecks.length > 0 ? (
                attentionChecks.map((check) => (
                  <div className={`attention-item ${check.state}`} key={check.name}>
                    {healthIcon(check.state)}
                    <span>
                      <strong>{check.name}</strong>
                      <small>{check.detail}</small>
                    </span>
                  </div>
                ))
              ) : (
                <div className="attention-item ready">
                  <CheckCircle2 size={15} />
                  <span>
                    <strong>No tool blockers</strong>
                    <small>All tracked checks are ready</small>
                  </span>
                </div>
              )}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

function SectionTitle({
  icon,
  title,
}: {
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className="section-title">
      {icon}
      <h3>{title}</h3>
    </div>
  );
}

function IconControl({
  children,
  disabled,
  label,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      className="icon-button"
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export default App;
