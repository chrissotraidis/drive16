import { invoke } from "@tauri-apps/api/core";
import { unzipSync } from "fflate";
import type { ChangeEvent, KeyboardEvent } from "react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  defaultOpenRouterModel,
  openRouterFreeformMessages,
  sendOpenRouterFreeformReply,
} from "./agent/openrouter";
import {
  agentActivityFromEvent,
  agentPromptWithProject,
  ensureActiveProject,
  resetActiveProject,
  sendAgentPrompt,
  setAgentProviderKey,
} from "./agent/opencodeSession";
import {
  coreLaunchFailureReadiness,
  activeGamepadActionIds,
  controllerProfileConfigured,
  detectInteractiveCoreReadiness,
  detectGamepadReadiness,
  firstConnectedGamepad,
  launchNostalgistMegadrivePlayer,
  loadInputProfile,
  pauseNostalgistPlayer,
  playerInputActionForId,
  playerInputActionFromKey,
  resetNostalgistPlayer,
  resetInputProfile,
  resumeNostalgistAudio,
  resumeNostalgistPlayer,
  sendNostalgistInput,
  toggleNostalgistMute,
  sameGamepadReadiness,
  stopNostalgistPlayer,
  visibleControllerBindings,
  visibleKeyboardBindings,
  visibleKeyboardMappings,
  type ActiveRomSource,
  type GamepadReadiness,
  type InteractiveCoreReadiness,
  type LoadedInteractiveCore,
  type LoadedPlayerRom,
  type NostalgistPlayerRuntime,
  type PlayerAudioState,
  type PlayerInputAction,
  type PlayerInputActionId,
  type PlayerInputProfile,
  type PlayerSessionState,
} from "./player";
import { ChatRail } from "./components/ChatRail";
import { PlayerPane } from "./components/PlayerPane";
import { ProjectMenu } from "./components/ProjectMenu";
import { SettingsPanel } from "./components/SettingsPanel";
import { TopBar } from "./components/TopBar";
import {
  base64ToBytes,
  connectionLabel,
  defaultComfyUiCheckpoint,
  defaultComfyUiLora,
  formatBytes,
  shortModelLabel,
  shortOllamaLabel,
  shortPath,
} from "./components/ui";

type BuildState = "idle" | "building" | "running" | "error";
type TransportState = "running" | "paused";
type ModelProvider = "openrouter" | "ollama";
type ConnectionState = HealthState | "idle" | "testing";
type MessageSource = "proof" | "system" | "opencode" | "model";

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

type ProjectSnapshot = {
  generatedAt: string;
  name: string;
  projectPath: string;
  detail: string;
};

type RomImportReadiness = {
  generatedAt: string;
  status: HealthState;
  detail: string;
  importDirectory: string;
  acceptedExtensions: string[];
};

type RomImportResult = {
  generatedAt: string;
  status: HealthState;
  detail: string;
  sourceName: string;
  importPath: string;
  bytes: number;
  acceptedExtensions: string[];
};

type RomReadResult = {
  generatedAt: string;
  status: HealthState;
  detail: string;
  romPath: string;
  sourceName: string;
  bytes: number;
  dataBase64: string;
  acceptedExtensions: string[];
};

type InteractiveCoreStatusResult = {
  generatedAt: string;
  status: "available" | "missing";
  detail: string;
  coreName: string;
  source: string;
  importDirectory: string;
  jsPath?: string;
  wasmPath?: string;
  jsBytes?: number;
  wasmBytes?: number;
  acceptedExtensions: string[];
};

type InteractiveCoreUploadFile = {
  fileName: string;
  dataBase64: string;
};

type InteractiveCoreImportResult = InteractiveCoreStatusResult & {
  status: "available";
  jsPath: string;
  wasmPath: string;
  jsBytes: number;
  wasmBytes: number;
};

type InteractiveCoreReadResult = {
  generatedAt: string;
  status: "available";
  detail: string;
  coreName: string;
  source: string;
  jsPath: string;
  wasmPath: string;
  jsBytes: number;
  wasmBytes: number;
  jsDataBase64: string;
  wasmDataBase64: string;
};

type InteractiveCoreSelectedFile = {
  fileName: string;
  bytes: Uint8Array;
};

type ProjectActionNotice = {
  state: HealthState;
  label: string;
  detail: string;
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
  connectedProviders?: string[];
};

type OpenCodeSendResult = {
  sessionId: string;
  messageId: string;
  partId: string;
  state: HealthState;
  detail: string;
  replyText?: string | null;
  finish?: string | null;
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

type EnhancementReadinessState = "disabled" | "needsSetup" | "ready" | "running" | "failed";

type EnhancementReadiness = {
  state: EnhancementReadinessState;
  label: string;
  detail: string;
  nextAction: string;
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
const openRouterSessionKeyStorageKey = "drive16.openrouter.sessionKey.v1";
const defaultOllamaEndpoint = "http://127.0.0.1:11434";
const defaultOllamaModel = "qwen2.5-coder:7b";
const defaultComfyUiEndpoint = "http://127.0.0.1:8188";

const preferredOpenRouterModels = [
  defaultOpenRouterModel,
  "~anthropic/claude-sonnet-latest",
  "~openai/gpt-latest",
  "~google/gemini-pro-latest",
  "~google/gemini-flash-latest",
  "qwen/qwen3.7-max",
  "openrouter/auto",
];

const fallbackModelOptions: ModelOption[] = [
  {
    id: defaultOpenRouterModel,
    name: "DeepSeek V3.1",
  },
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

// Non-secret settings persist across app restarts. The API key is NOT here:
// it lives in OpenCode's local auth store.
const persistedSettingsStorageKey = "drive16.settings.v1";

type PersistedSettings = {
  modelProvider?: ModelProvider;
  activeModel?: string;
  ollamaEndpoint?: string;
  ollamaModel?: string;
  enhancements?: EnhancementSettings;
  comfyUiEndpoint?: string;
  comfyUiCheckpoint?: string;
  comfyUiLora?: string;
};

function loadPersistedSettings(): PersistedSettings {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(persistedSettingsStorageKey);
    if (!raw) return {};
    return JSON.parse(raw) as PersistedSettings;
  } catch {
    return {};
  }
}

function savePersistedSettings(settings: PersistedSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(persistedSettingsStorageKey, JSON.stringify(settings));
  } catch {
    // Storage can be unavailable in locked-down webviews; settings just
    // won't persist.
  }
}

function loadOpenRouterSessionKey() {
  if (typeof window === "undefined") return "";

  try {
    return window.sessionStorage.getItem(openRouterSessionKeyStorageKey) ?? "";
  } catch {
    return "";
  }
}

function saveOpenRouterSessionKey(value: string) {
  if (typeof window === "undefined") return;

  try {
    const trimmed = value.trim();
    if (trimmed) {
      window.sessionStorage.setItem(openRouterSessionKeyStorageKey, trimmed);
    } else {
      window.sessionStorage.removeItem(openRouterSessionKeyStorageKey);
    }
  } catch {
    // Some locked-down WebViews can reject storage; the in-memory key still works.
  }
}

const starterMessages: Message[] = [
  {
    id: 1,
    role: "agent",
    source: "system",
    body: "Starter project loaded. Describe what you want to build.",
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
    source: "proof",
    body: "Try a prompt like that one: it builds the bundled sprite-and-music demo and loads it in the player.",
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
      detail: "Genteel sidecar path is tracked",
    },
  ],
};

const previewStarterRom: StarterRomPreview = {
  status: "warning",
  detail: "Native starter ROM capture runs inside the Tauri app",
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

const previewImportReadiness: RomImportReadiness = {
  generatedAt: "preview",
  status: "ready",
  detail: "Import storage preview",
  importDirectory: "artifacts/phase5/imports",
  acceptedExtensions: [".bin", ".gen", ".md", ".smd"],
};

const previewImportResult: RomImportResult = {
  generatedAt: "preview",
  status: "ready",
  detail: "Preview imported ROM selected",
  sourceName: "rom.bin",
  importPath: "artifacts/phase5/imports/drive16-import-preview-rom.bin",
  bytes: 0,
  acceptedExtensions: previewImportReadiness.acceptedExtensions,
};

const previewInteractiveCoreStatus: InteractiveCoreStatusResult = {
  generatedAt: "preview",
  status: "missing",
  detail: "Set Up Play with a core .zip or .js + .wasm pair.",
  coreName: "genesis_plus_gx",
  source: "No user core",
  importDirectory: "artifacts/phase7/interactive-core",
  acceptedExtensions: [".zip", ".js", ".wasm"],
};

const initialProjectActionNotice: ProjectActionNotice = {
  state: "warning",
  label: "Project actions ready",
  detail: "Use New, Save, Open, Import, or Export from this menu.",
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
  const [recentProjects, setRecentProjects] = useState<ProjectSnapshot[]>([]);
  const [importReadiness, setImportReadiness] = useState<RomImportReadiness | undefined>();
  const [importResult, setImportResult] = useState<RomImportResult | undefined>();
  const [importBusy, setImportBusy] = useState(false);
  const [interactiveCoreStatus, setInteractiveCoreStatus] =
    useState<InteractiveCoreStatusResult>(previewInteractiveCoreStatus);
  const [interactiveCoreBusy, setInteractiveCoreBusy] = useState(false);
  const [projectActionNotice, setProjectActionNotice] =
    useState<ProjectActionNotice>(initialProjectActionNotice);
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
  const [conversationCollapsed, setConversationCollapsed] = useState(false);
  const [statusCollapsed, setStatusCollapsed] = useState(true);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [romInputFocused, setRomInputFocused] = useState(false);
  const [inputProfile, setInputProfile] = useState<PlayerInputProfile>(() => loadInputProfile());
  const [gamepadReadiness, setGamepadReadiness] = useState<GamepadReadiness>(() =>
    detectGamepadReadiness(),
  );
  const [lastInputAction, setLastInputAction] = useState("No local input yet");
  const [lastPlayerInput, setLastPlayerInput] = useState<PlayerInputAction | undefined>();
  const [loadedPlayerRom, setLoadedPlayerRom] = useState<LoadedPlayerRom | undefined>();
  const [loadedInteractiveCore, setLoadedInteractiveCore] =
    useState<LoadedInteractiveCore | undefined>();
  const [playerState, setPlayerState] = useState<PlayerSessionState>("idle");
  const [playerCanvasActive, setPlayerCanvasActive] = useState(false);
  const [playerAudio, setPlayerAudio] = useState<PlayerAudioState>("unavailable");
  const [agentRom, setAgentRom] = useState<{ path: string; stamp: number } | undefined>();
  const [agentProviders, setAgentProviders] = useState<string[]>([]);
  const [workspacePath, setWorkspacePath] = useState<string | undefined>();
  const [toastNotice, setToastNotice] = useState<ProjectActionNotice | undefined>();
  const [interactiveCoreReadiness, setInteractiveCoreReadiness] =
    useState<InteractiveCoreReadiness>(() =>
      detectInteractiveCoreReadiness({
        allowDevCdn: allowDevCoreCdnFallback(),
        storage: previewInteractiveCoreStatus,
      }),
    );
  const [inputProofBusy, setInputProofBusy] = useState(false);
  const [actionDetail, setActionDetail] = useState(
    "Starter project loaded. Describe what you want to build.",
  );
  const [persisted] = useState(loadPersistedSettings);
  const [modelProvider, setModelProvider] = useState<ModelProvider>(
    persisted.modelProvider ?? "openrouter",
  );
  const [activeModel, setActiveModel] = useState(
    persisted.activeModel ?? fallbackModelOptions[0].id,
  );
  const [modelOptions, setModelOptions] = useState<ModelOption[]>(fallbackModelOptions);
  const [modelsSource, setModelsSource] = useState("fallback");
  const [openRouterKey, setOpenRouterKey] = useState(() => loadOpenRouterSessionKey());
  const [showOpenRouterKey, setShowOpenRouterKey] = useState(false);
  const [ollamaEndpoint, setOllamaEndpoint] = useState(
    persisted.ollamaEndpoint ?? defaultOllamaEndpoint,
  );
  const [ollamaModel, setOllamaModel] = useState(persisted.ollamaModel ?? defaultOllamaModel);
  const [enhancements, setEnhancements] = useState<EnhancementSettings>(
    persisted.enhancements ?? {
      spriteGeneration: false,
      musicGeneration: false,
    },
  );
  const [comfyUiEndpoint, setComfyUiEndpoint] = useState(
    persisted.comfyUiEndpoint ?? defaultComfyUiEndpoint,
  );
  const [comfyUiCheckpoint, setComfyUiCheckpoint] = useState(
    persisted.comfyUiCheckpoint ?? defaultComfyUiCheckpoint,
  );
  const [comfyUiLora, setComfyUiLora] = useState(persisted.comfyUiLora ?? defaultComfyUiLora);
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
  const romViewportRef = useRef<HTMLDivElement | null>(null);
  const playerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const playerRuntimeRef = useRef<NostalgistPlayerRuntime | undefined>();
  const romImportInputRef = useRef<HTMLInputElement | null>(null);
  const coreImportInputRef = useRef<HTMLInputElement | null>(null);
  const messageIdRef = useRef(starterMessages.length + 1);
  const openCodeEventIdRef = useRef(1);
  const controllerPressedRef = useRef<Set<PlayerInputActionId>>(new Set());

  useEffect(() => {
    void refreshPreflight();
    void launchRom();
    void connectOpenCode();
    void loadProjectSummary();
    void loadRecentProjects();
    void loadInteractiveCoreStatus();
    if (isTauriRuntime()) {
      void ensureActiveProject()
        .then((project) => setWorkspacePath(project.projectPath))
        .catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (!settingsOpen || modelProvider !== "openrouter") return;
    if (modelsSource !== "fallback") return;

    void refreshOpenRouterModels();
  }, [modelProvider, modelsSource, settingsOpen]);

  // Check enabled enhancements automatically when Settings opens so their
  // status is real without an extra Test click.
  useEffect(() => {
    if (!settingsOpen || !enhancements.spriteGeneration) return;
    if (comfyUiConnection.state !== "idle") return;
    void testComfyUiConnection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsOpen, enhancements.spriteGeneration]);

  // Preflight is a snapshot; re-run it when Settings opens so rows like
  // Docker reflect reality, not app-launch time.
  useEffect(() => {
    if (!settingsOpen) return;
    void refreshPreflight();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsOpen]);

  // Keep non-secret settings across restarts.
  useEffect(() => {
    savePersistedSettings({
      modelProvider,
      activeModel,
      ollamaEndpoint,
      ollamaModel,
      enhancements,
      comfyUiEndpoint,
      comfyUiCheckpoint,
      comfyUiLora,
    });
  }, [
    modelProvider,
    activeModel,
    ollamaEndpoint,
    ollamaModel,
    enhancements,
    comfyUiEndpoint,
    comfyUiCheckpoint,
    comfyUiLora,
  ]);

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
      const activity = agentActivityFromEvent(event.data);
      if (activity && activity.kind === "tool") {
        noteAction(activity.label);
      }
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

  // When the agent finishes a build, load the fresh ROM into the player.
  // The stamp changes on every build so a rebuild at the same path replays.
  useEffect(() => {
    if (!agentRom) return;
    setLoadedPlayerRom(undefined);
    void playActiveRom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentRom?.stamp]);

  // Surface every action result as a visible toast; the notice state also
  // feeds the sr-only live region for assistive tech.
  const noticeSeenRef = useRef(false);
  useEffect(() => {
    if (!noticeSeenRef.current) {
      noticeSeenRef.current = true;
      return;
    }
    setToastNotice(projectActionNotice);
    const timer = window.setTimeout(() => setToastNotice(undefined), 8000);
    return () => window.clearTimeout(timer);
  }, [projectActionNotice]);

  useEffect(() => {
    return () => {
      if (loadedPlayerRom?.objectUrl) {
        URL.revokeObjectURL(loadedPlayerRom.objectUrl);
      }
    };
  }, [loadedPlayerRom?.objectUrl]);

  useEffect(() => {
    return () => {
      disposeInteractivePlayer();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let frame = 0;

    const updateReadiness = () => {
      const nextReadiness = detectGamepadReadiness(inputProfile);
      setGamepadReadiness((current) =>
        sameGamepadReadiness(current, nextReadiness) ? current : nextReadiness,
      );
      return nextReadiness;
    };

    const releasePressedActions = (pressed: Set<PlayerInputActionId>) => {
      pressed.forEach((id) => {
        releaseLocalRomInput(playerInputActionForId(id, "controller"));
      });
    };

    const pollController = () => {
      const readiness = updateReadiness();
      const gamepad = readiness.state === "detected" ? firstConnectedGamepad() : undefined;
      const nextPressed = gamepad
        ? activeGamepadActionIds(gamepad, inputProfile)
        : new Set<PlayerInputActionId>();
      const previousPressed = controllerPressedRef.current;

      nextPressed.forEach((id) => {
        if (!previousPressed.has(id)) {
          applyLocalRomInput(playerInputActionForId(id, "controller"), "controller");
        }
      });

      previousPressed.forEach((id) => {
        if (!nextPressed.has(id)) {
          releaseLocalRomInput(playerInputActionForId(id, "controller"));
        }
      });

      controllerPressedRef.current = nextPressed;
      frame = window.requestAnimationFrame(pollController);
    };

    const handleControllerChange = () => {
      updateReadiness();
    };

    updateReadiness();
    window.addEventListener("gamepadconnected", handleControllerChange);
    window.addEventListener("gamepaddisconnected", handleControllerChange);
    frame = window.requestAnimationFrame(pollController);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("gamepadconnected", handleControllerChange);
      window.removeEventListener("gamepaddisconnected", handleControllerChange);
      releasePressedActions(controllerPressedRef.current);
      controllerPressedRef.current = new Set();
    };
  }, [inputProfile]);

  const buildLabel = useMemo(() => {
    if (buildState === "building") return "Working";
    if (buildState === "error") return "Error";
    return "Ready";
  }, [buildState]);

  const actionFeedback = useMemo<ProjectActionNotice>(() => {
    if (buildState === "error") {
      return {
        state: "missing",
        label: "Action needs attention",
        detail: actionDetail,
      };
    }
    if (importBusy) {
      return {
        state: "warning",
        label: "Importing ROM",
        detail: actionDetail,
      };
    }
    if (exportBusy) {
      return {
        state: "warning",
        label: "Exporting ROM",
        detail: actionDetail,
      };
    }
    if (saveBusy) {
      return {
        state: "warning",
        label: "Saving project",
        detail: actionDetail,
      };
    }
    if (playerState === "loading") {
      return {
        state: "warning",
        label: "Preparing Play",
        detail: actionDetail,
      };
    }
    if (playerState === "error") {
      return {
        state: "missing",
        label: "Play setup failed",
        detail: actionDetail,
      };
    }
    if (projectActionNotice.label === "Play setup needed") {
      return {
        state: "warning",
        label: projectActionNotice.label,
        detail: projectActionNotice.detail,
      };
    }
    if (projectActionNotice.label.startsWith("Interactive player")) {
      return projectActionNotice;
    }
    if (starterBusy || buildState === "building") {
      return {
        state: "warning",
        label: "Verifying ROM",
        detail: actionDetail,
      };
    }
    return {
      state: "ready",
      label: "Ready",
      detail: actionDetail,
    };
  }, [
    actionDetail,
    buildState,
    exportBusy,
    importBusy,
    playerState,
    projectActionNotice,
    saveBusy,
    starterBusy,
  ]);

  const conversationMode = useMemo(
    () =>
      getConversationMode(
        modelProvider,
        activeModel,
        ollamaModel,
        modelConnection,
        openCode,
        openRouterKey.trim().length > 0,
      ),
    [activeModel, modelConnection, modelProvider, ollamaModel, openCode, openRouterKey],
  );

  const activeRomSource = useMemo(
    () => activeRomSourceFor(projectSummary, importResult, v1PromptResult, agentRom?.path),
    [importResult, projectSummary, v1PromptResult, agentRom],
  );
  const preflightWithInteractivePlay = useMemo(
    () => [interactiveCoreHealthCheck(interactiveCoreReadiness), ...preflight.checks],
    [interactiveCoreReadiness, preflight.checks],
  );
  const keyboardMappings = useMemo(() => visibleKeyboardMappings(inputProfile), [inputProfile]);
  const keyboardBindingRows = useMemo(
    () => visibleKeyboardBindings(inputProfile),
    [inputProfile],
  );
  const controllerBindingRows = useMemo(
    () => visibleControllerBindings(inputProfile),
    [inputProfile],
  );
  const controllerMappingReady = useMemo(
    () => controllerProfileConfigured(inputProfile),
    [inputProfile],
  );
  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;

    const userMessage = makeMessage("user", trimmed);
    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setOpenCodeBusy(true);

    // In the desktop app there is exactly one path: the build agent. It
    // reconnects on demand and reports real errors. The freeform/gated chat
    // below only exists for the browser preview, which has no agent bridge.
    if (isTauriRuntime()) {
      try {
        await runAgentPrompt(trimmed);
      } finally {
        setOpenCodeBusy(false);
      }
      return;
    }

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
        openRouterKey.trim().length > 0,
      );
      if (gateMessage) {
        appendOpenCodeEvent("message.gated", gateMessage);
        setMessages((current) => [...current, makeMessage("agent", gateMessage, "system")]);
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
            ? "Generated sprite and music demo ready."
            : shouldRunGeneratedMusic
              ? "Generated music demo ready."
              : "Sprite and music demo ready.",
        );
        const agentMessage = makeMessage(
          "agent",
          promptReadyMessage(shouldRunGeneratedMusic, shouldRunGeneratedSprite),
          "proof",
        );
        setMessages((current) => [...current, agentMessage]);
        const readyEvent = shouldRunGeneratedSprite
          ? "phase4.assets.ready"
          : shouldRunGeneratedMusic
            ? "phase4.music.ready"
            : "v1.ready";
        appendOpenCodeEvent(readyEvent, promptResult.romPath);
      } else {
        const reply = await sendOpenRouterFreeformReply({
          apiKey: openRouterKey,
          model: activeModel,
          messages: openRouterFreeformMessages(messages, trimmed),
        });
        const agentMessage = makeMessage(
          "agent",
          reply.content,
          "model",
        );
        setMessages((current) => [...current, agentMessage]);
        appendOpenCodeEvent(
          "message.model",
          `${shortModelLabel(reply.model)} replied${
            reply.totalTokens ? ` (${reply.totalTokens} tokens)` : ""
          }.`,
        );
        if (openCodeResult) {
          appendOpenCodeEvent("message.logged", shortIdentifier(openCodeResult.sessionId));
        }
        noteAction("Model reply received.");
      }
      setBuildState("running");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "OpenRouter reply failed";
      const agentMessage = makeMessage(
        "agent",
        shouldRunV1
          ? `The ROM build could not finish. ${detail}`
          : `${openRouterReplyFailureMessage(detail)} ROM-changing prompts still use the verified local build path.`,
        shouldRunV1 ? "proof" : "system",
      );
      setMessages((current) => [...current, agentMessage]);
      appendOpenCodeEvent(shouldRunV1 ? "v1.failed" : "message.model.failed", detail);
      if (shouldRunV1) {
        setBuildState("error");
        setV1PromptSource("error");
      } else {
        setBuildState("running");
      }
    } finally {
      setOpenCodeBusy(false);
    }
  }

  async function runAgentPrompt(trimmed: string) {
    // Reconnect on demand: startup connection may have raced the server
    // boot, and the server restarts when a key is saved.
    let bridge = openCode;
    let providers = agentProviders;
    if (bridge.state !== "ready" || !providers.includes("openrouter")) {
      const report = await connectOpenCode();
      if (report) {
        bridge = report;
        providers = report.connectedProviders ?? [];
      }
    }

    if (bridge.state !== "ready") {
      setMessages((current) => [
        ...current,
        makeMessage(
          "agent",
          `I could not reach the build agent: ${bridge.detail} Try again in a few seconds.`,
          "system",
        ),
      ]);
      setBuildState("error");
      return;
    }

    if (modelProvider === "ollama") {
      setMessages((current) => [
        ...current,
        makeMessage(
          "agent",
          "Building through Ollama is not wired up yet. Switch to OpenRouter in Settings to build; Ollama support is on the roadmap.",
          "system",
        ),
      ]);
      return;
    }

    if (!providers.includes("openrouter")) {
      setMessages((current) => [
        ...current,
        makeMessage(
          "agent",
          "I need a model to build with. Open Settings, paste your OpenRouter API key, and click Test OpenRouter — you only have to do this once.",
          "system",
        ),
      ]);
      return;
    }

    setBuildState("building");
    noteAction("The agent is working on your request.");
    try {
      const project = await ensureActiveProject();
      setWorkspacePath(project.projectPath);
      const result = await sendAgentPrompt({
        sessionId: openCodeSessionId ?? undefined,
        text: agentPromptWithProject(project.projectPath, trimmed),
        providerId: "openrouter",
        modelId: activeModel,
      });
      setOpenCodeSessionId(result.sessionId);

      const reply =
        result.replyText?.trim() ||
        "The agent finished but did not send a reply. Check the activity feed.";
      setMessages((current) => [...current, makeMessage("agent", reply, "opencode")]);
      appendOpenCodeEvent("agent.reply", `finish: ${result.finish ?? "unknown"}`);

      const after = await ensureActiveProject();
      if (after.romExists) {
        setAgentRom({ path: after.romPath, stamp: Date.now() });
        noteAction("The project ROM is ready. Loading it into the player.");
      } else {
        noteAction("The agent replied. No ROM has been built yet.");
      }
      setBuildState("running");
    } catch (error) {
      const detail = errorDetail(error, "The agent request failed with no detail");
      setMessages(
        (current) => [
          ...current,
          makeMessage("agent", `Something went wrong while working on that: ${detail}`, "system"),
        ],
      );
      setProjectActionNotice({
        state: "missing",
        label: "Agent request failed",
        detail,
      });
      appendOpenCodeEvent("agent.failed", detail);
      setBuildState("error");
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

  async function connectOpenCode(): Promise<OpenCodeBridgeStatus | undefined> {
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
        const providers = report.connectedProviders ?? [];
        setAgentProviders(providers);
        // A key saved in a previous session lives in OpenCode's auth store,
        // so the agent is ready without re-pasting it.
        if (providers.includes("openrouter")) {
          setModelConnection((current) =>
            current.state === "ready"
              ? current
              : { state: "ready", detail: "Using the saved OpenRouter key" },
          );
        }
        return report;
      } catch (error) {
        setOpenCode({
          ...previewOpenCode,
          state: "warning",
          detail: errorDetail(error, "OpenCode command unavailable"),
          generatedAt: "error",
        });
        setOpenCodeSource("error");
        return undefined;
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
    return undefined;
  }

  async function sendOpenCodeMessage(text: string): Promise<OpenCodeSendResult> {
    if (isTauriRuntime()) {
      return invoke<OpenCodeSendResult>("send_opencode_message", {
        request: {
          sessionId: openCodeSessionId,
          text,
          noReply: true,
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
        ? "Preview of the generated sprite and music build"
        : "Preview of the generated music build",
    };
  }

  function applyV1PromptResult(result: V1PromptResult, assetMode: PromptAssetMode = "core") {
    setImportResult(undefined);
    setV1PromptResult(result);
    setV1PromptSource(isTauriRuntime() ? "tauri" : "preview");
    setBuildState("running");
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
          ? "Generated Sprite and Music ROM"
          : assetMode === "generatedMusic"
            ? "Generated Music ROM"
            : "Sprite and Music Demo",
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

  async function loadRecentProjects() {
    if (!isTauriRuntime()) {
      setRecentProjects(saveResult ? [snapshotFromSaveResult(saveResult)] : []);
      return;
    }

    try {
      const snapshots = await invoke<ProjectSnapshot[]>("list_project_snapshots");
      setRecentProjects(snapshots);
    } catch (error) {
      appendOpenCodeEvent(
        "project.snapshots.failed",
        error instanceof Error ? error.message : "Saved project list unavailable",
      );
    }
  }

  async function loadInteractiveCoreStatus() {
    if (!isTauriRuntime()) {
      applyInteractiveCoreStatus(previewInteractiveCoreStatus);
      return;
    }

    try {
      const status = await invoke<InteractiveCoreStatusResult>("load_interactive_core_status");
      applyInteractiveCoreStatus(status);
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "Interactive core status was unavailable";
      const missingStatus: InteractiveCoreStatusResult = {
        ...previewInteractiveCoreStatus,
        generatedAt: "error",
        detail,
      };
      applyInteractiveCoreStatus(missingStatus);
      appendOpenCodeEvent("core.status.failed", detail);
    }
  }

  async function prepareInteractiveCoreImport() {
    if (!isTauriRuntime()) {
      applyInteractiveCoreStatus(previewInteractiveCoreStatus);
      return previewInteractiveCoreStatus;
    }

    const status = await invoke<InteractiveCoreStatusResult>("prepare_interactive_core_import");
    applyInteractiveCoreStatus(status);
    return status;
  }

  function applyInteractiveCoreStatus(status: InteractiveCoreStatusResult) {
    setInteractiveCoreStatus(status);
    setInteractiveCoreReadiness(
      detectInteractiveCoreReadiness({
        allowDevCdn: allowDevCoreCdnFallback(),
        storage: status,
      }),
    );
    if (status.status !== "available") {
      setLoadedInteractiveCore(undefined);
    }
  }

  async function chooseInteractiveCore() {
    noteAction("Choose a local Genesis core for Play.");

    try {
      const status = await prepareInteractiveCoreImport();
      setProjectActionNotice({
        state: "warning",
        label: "Choose Play core",
        detail: `Accepted: ${status.acceptedExtensions.join(", ")}`,
      });
      appendOpenCodeEvent("core.import.choose", status.importDirectory);
      coreImportInputRef.current?.click();
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Interactive core setup failed";
      setProjectActionNotice({
        state: "missing",
        label: "Play setup failed",
        detail,
      });
      appendOpenCodeEvent("core.import.failed", detail);
      noteAction(`Interactive core setup failed: ${detail}`);
    }
  }

  async function handleInteractiveCoreFilesSelected(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (selectedFiles.length === 0) {
      noteAction("Core setup canceled.");
      return;
    }

    setInteractiveCoreBusy(true);
    noteAction(`Preparing ${selectedFiles.map((file) => file.name).join(", ")} for Play.`);

    try {
      const selectedCoreFiles = await normalizeInteractiveCoreSelection(selectedFiles);
      const result = isTauriRuntime()
        ? await importSelectedInteractiveCoreInTauri(selectedCoreFiles)
        : previewInteractiveCoreImport(selectedCoreFiles);
      const loadedCore = loadedInteractiveCoreFromSelectedFiles(result, selectedCoreFiles);
      setLoadedInteractiveCore(loadedCore);
      applyInteractiveCoreStatus(result);
      setProjectActionNotice({
        state: "ready",
        label: "Play core ready",
        detail: `${shortPath(result.jsPath)} and ${shortPath(result.wasmPath)}`,
      });
      appendOpenCodeEvent("core.imported", result.importDirectory);
      noteAction("User-supplied Genesis core ready for Play.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Interactive core import failed";
      setProjectActionNotice({
        state: "missing",
        label: "Core import failed",
        detail,
      });
      appendOpenCodeEvent("core.import.failed", detail);
      noteAction(`Core import failed: ${detail}`);
    } finally {
      setInteractiveCoreBusy(false);
    }
  }

  async function importSelectedInteractiveCoreInTauri(files: InteractiveCoreSelectedFile[]) {
    const uploadFiles = files.map<InteractiveCoreUploadFile>((file) => ({
      fileName: file.fileName,
      dataBase64: bytesToBase64(file.bytes),
    }));

    return invoke<InteractiveCoreImportResult>("import_interactive_core_files", {
      request: { files: uploadFiles },
    });
  }

  async function exportRom() {
    setExportBusy(true);
    noteAction(`Exporting ${activeRomSource.label}.`);
    const exportSource = activeRomSource;

    if (!isTauriRuntime()) {
      const previewResult = previewExportForRom(exportSource);
      setExportResult(previewResult);
      setProjectActionNotice({
        state: previewResult.status,
        label: "ROM export ready",
        detail: previewResult.exportPath,
      });
      appendOpenCodeEvent("export.preview", previewResult.exportPath);
      noteAction(`Preview export ready at ${previewResult.exportPath}.`);
      setExportBusy(false);
      return;
    }

    try {
      const result =
        exportSource.kind === "starter" && isDefaultStarterRomPath(exportSource.path)
          ? await invoke<RomExportResult>("export_current_rom")
          : await invoke<RomExportResult>("export_rom_path", {
              sourceRomPath: exportSource.path,
            });
      setExportResult(result);
      setProjectActionNotice({
        state: result.status,
        label: "ROM export ready",
        detail: result.exportPath,
      });
      appendOpenCodeEvent("export.ready", result.exportPath);
      noteAction(`ROM exported to ${result.exportPath}.`);
      if (exportSource.kind === "starter" && isDefaultStarterRomPath(exportSource.path)) {
        void loadProjectSummary();
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "ROM export failed";
      setExportResult({
        ...previewExportResult,
        status: "missing",
        detail,
        generatedAt: "error",
        sourceRomPath: exportSource.path,
      });
      setProjectActionNotice({
        state: "missing",
        label: "Export failed",
        detail,
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

      // Hand the BYOK key to the OpenCode agent so chat prompts can build.
      // OpenCode activates the provider on a quick automatic restart.
      if (isTauriRuntime()) {
        try {
          const auth = await setAgentProviderKey("openrouter", trimmedKey);
          appendOpenCodeEvent("agent.auth", auth.detail);
          if (auth.connected) {
            setAgentProviders((current) =>
              current.includes("openrouter") ? current : [...current, "openrouter"],
            );
            setModelConnection({
              state: "ready",
              detail: "OpenRouter key accepted and saved for the agent",
            });
          } else {
            setModelConnection({
              state: "warning",
              detail: `Key accepted, but the agent could not activate OpenRouter: ${auth.detail}`,
            });
          }
          if (auth.restarted) {
            void connectOpenCode();
          }
        } catch (error) {
          const detail = errorDetail(error, "Could not hand the key to the agent");
          appendOpenCodeEvent("agent.auth.failed", detail);
          setModelConnection({
            state: "warning",
            detail: `Key accepted by OpenRouter, but the agent setup failed: ${detail}`,
          });
        }
      }
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
    saveOpenRouterSessionKey(value);
    resetModelConnectionIfChecked("OpenRouter not tested");
  }

  function handleProviderChange(value: ModelProvider) {
    setModelProvider(value);
    // A provider already connected in OpenCode stays ready across switches;
    // only untested providers start from idle.
    if (value === "openrouter" && agentProviders.includes("openrouter")) {
      setModelConnection({ state: "ready", detail: "Using the saved OpenRouter key" });
    } else {
      setModelConnection({
        state: "idle",
        detail: value === "openrouter" ? "OpenRouter not tested" : "Ollama not tested",
      });
    }
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
    const proofPath = isDefaultStarterRomPath(activeRomSource.path)
      ? undefined
      : activeRomSource.path;
    setTransport("running");
    setBuildState("running");
    setSpriteX(52);
    noteAction(`${activeRomSource.label} proof capture requested.`);
    appendOpenCodeEvent(`${activeRomSource.kind}.capture`, activeRomSource.path);
    void launchRom(proofPath, `${activeRomSource.label} proof captured.`);
  }

  function startNewProject() {
    setMessages([
      makeMessage(
        "agent",
        "New starter project ready. Describe what to build, or ask for a sprite you can move with music.",
      ),
    ]);
    setDraft("");
    setExportResult(undefined);
    setSaveResult(undefined);
    setImportResult(undefined);
    setImportReadiness(undefined);
    setV1PromptResult(undefined);
    setV1PromptSource("idle");
    setOpenCodeSessionId(undefined);
    setAgentRom(undefined);
    if (isTauriRuntime()) {
      void resetActiveProject()
        .then((project) => setWorkspacePath(project.projectPath))
        .catch((error) => {
          noteAction(errorDetail(error, "Could not reset the project workspace"));
        });
    }
    setTransport("running");
    setSpriteX(52);
    setProjectSummary(previewProjectSummary);
    setProjectSource(isTauriRuntime() ? "checking" : "preview");
    setProjectActionNotice({
      state: "ready",
      label: "New starter project",
      detail: "Blank starter template loaded",
    });
    noteAction("New project started from the blank starter template.");
    appendOpenCodeEvent("project.new", "Blank starter template loaded");
    void loadProjectSummary();
    void launchRom(undefined, "New starter project ready.");
  }

  async function saveProject() {
    setSaveBusy(true);
    const sourceProjectPath = projectSummary.projectPath;
    noteAction(`Saving project snapshot for ${shortPath(sourceProjectPath)}.`);

    if (!isTauriRuntime()) {
      const previewResult = previewSaveForProject(projectSummary);
      setSaveResult(previewResult);
      setRecentProjects([snapshotFromSaveResult(previewResult)]);
      setProjectActionNotice({
        state: previewResult.status,
        label: "Project saved",
        detail: previewResult.snapshotPath,
      });
      appendOpenCodeEvent("project.save.preview", previewResult.snapshotPath);
      noteAction(`Preview save ready at ${previewResult.snapshotPath}.`);
      setSaveBusy(false);
      return;
    }

    try {
      const result = await invoke<ProjectSaveResult>("save_project_path", {
        sourceProjectPath,
      });
      setSaveResult(result);
      setRecentProjects((current) => [snapshotFromSaveResult(result), ...current].slice(0, 6));
      setProjectActionNotice({
        state: "ready",
        label: "Project saved",
        detail: result.snapshotPath,
      });
      appendOpenCodeEvent("project.saved", result.snapshotPath);
      noteAction(`Project saved to ${result.snapshotPath}.`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Project save failed";
      setSaveResult({
        ...previewSaveResult,
        status: "missing",
        detail,
        generatedAt: "error",
      });
      setProjectActionNotice({
        state: "missing",
        label: "Save failed",
        detail,
      });
      appendOpenCodeEvent("project.save.failed", detail);
      noteAction(`Project save failed: ${detail}`);
    } finally {
      setSaveBusy(false);
    }
  }

  function openProjectSnapshot(snapshot?: ProjectSnapshot) {
    const target = snapshot ?? recentProjects[0];
    if (!target) {
      const detail = "Save a project first so Drive16 has a local snapshot to open.";
      setProjectActionNotice({
        state: "warning",
        label: "No saved projects yet",
        detail,
      });
      appendOpenCodeEvent("project.open.waiting", detail);
      noteAction(detail);
      return;
    }

    setImportResult(undefined);
    setImportReadiness(undefined);
    setV1PromptResult(undefined);
    setV1PromptSource("idle");
    setProjectSummary(projectSummaryFromSnapshot(target));
    setProjectActionNotice({
      state: "ready",
      label: "Project opened",
      detail: target.projectPath,
    });
    appendOpenCodeEvent("project.open.selected", target.projectPath);
    noteAction(`Project opened from ${target.projectPath}.`);
    void launchRom(`${target.projectPath}/out/rom.bin`, "Saved project loaded.");
  }

  async function loadRomImportReadiness() {
    if (!isTauriRuntime()) {
      return previewImportReadiness;
    }

    return invoke<RomImportReadiness>("prepare_rom_import");
  }

  async function importSelectedRomInTauri(file: File, bytes: Uint8Array) {
    const dataBase64 = bytesToBase64(bytes);
    return invoke<RomImportResult>("import_rom_bytes", {
      request: {
        fileName: file.name,
        dataBase64,
      },
    });
  }

  function activateImportedRom(result: RomImportResult) {
    setImportResult(result);
    setImportReadiness({
      generatedAt: result.generatedAt,
      status: result.status,
      detail: result.detail,
      importDirectory:
        result.importPath.split("/").slice(0, -1).join("/") ||
        previewImportReadiness.importDirectory,
      acceptedExtensions: result.acceptedExtensions,
    });
    setProjectSummary(projectSummaryFromImport(result));
    setProjectSource(isTauriRuntime() ? "tauri" : "preview");
    setExportResult(undefined);
    setV1PromptResult(undefined);
    setV1PromptSource("idle");
    setAgentRom(undefined);
    setProjectActionNotice({
      state: result.status,
      label: "Imported ROM active",
      detail: `${result.sourceName} copied to ${result.importPath}`,
    });
    noteAction(`Imported ROM active: ${result.sourceName}.`);
  }

  async function importRom() {
    noteAction("Choose a Genesis ROM to import.");

    try {
      const readiness = await loadRomImportReadiness();
      setImportReadiness(readiness);
      setProjectActionNotice({
        state: "warning",
        label: "Choose ROM file",
        detail: `Accepted: ${readiness.acceptedExtensions.join(", ")}`,
      });
      appendOpenCodeEvent("rom.import.choose", readiness.importDirectory);
      romImportInputRef.current?.click();
    } catch (error) {
      const detail = error instanceof Error ? error.message : "ROM import setup failed";
      setProjectActionNotice({
        state: "missing",
        label: "Import setup failed",
        detail,
      });
      appendOpenCodeEvent("rom.import.failed", detail);
      noteAction(`ROM import setup failed: ${detail}`);
    }
  }

  async function handleRomFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!selectedFile) {
      noteAction("ROM import canceled.");
      return;
    }

    setImportBusy(true);
    noteAction(`Importing ${selectedFile.name}.`);

    try {
      const readiness = await loadRomImportReadiness();
      setImportReadiness(readiness);
      if (!isAcceptedRomFileName(selectedFile.name, readiness.acceptedExtensions)) {
        throw new Error(
          `Unsupported ROM extension. Accepted: ${readiness.acceptedExtensions.join(", ")}`,
        );
      }

      const selectedBytes = new Uint8Array(await selectedFile.arrayBuffer());
      const result = isTauriRuntime()
        ? await importSelectedRomInTauri(selectedFile, selectedBytes)
        : previewImportForFile(selectedFile, readiness);
      activateImportedRom(result);
      setLoadedPlayerRom(playerRomFromBytes(result.importPath, result.sourceName, selectedBytes));
      appendOpenCodeEvent("rom.imported", result.importPath);
      void launchRom(result.importPath, "Imported ROM ready.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "ROM import setup failed";
      setProjectActionNotice({
        state: "missing",
        label: "Import setup failed",
        detail,
      });
      appendOpenCodeEvent("rom.import.failed", detail);
      noteAction(`ROM import setup failed: ${detail}`);
    } finally {
      setImportBusy(false);
    }
  }

  async function importTestRom() {
    setImportBusy(true);
    noteAction("Importing the repo-generated test ROM.");

    try {
      const result = isTauriRuntime()
        ? await invoke<RomImportResult>("import_test_rom")
        : previewTestRomImport();
      activateImportedRom(result);
      appendOpenCodeEvent("rom.imported.test", result.importPath);
      void launchRom(result.importPath, "Test ROM imported and ready.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Test ROM import failed";
      setProjectActionNotice({
        state: "missing",
        label: "Test import failed",
        detail,
      });
      appendOpenCodeEvent("rom.import.test.failed", detail);
      noteAction(`Test ROM import failed: ${detail}`);
    } finally {
      setImportBusy(false);
    }
  }

  function runCurrentProject() {
    const activePath = importResult?.importPath ?? projectSummary.romPath;
    noteAction(importResult ? "Verifying the imported ROM." : "Verifying the current starter ROM.");
    appendOpenCodeEvent("verify.started", activePath);
    void launchRom(
      importResult?.importPath,
      importResult ? "Imported ROM verified." : "Project ROM verified.",
    );
  }

  async function playActiveRom() {
    if (!interactiveCoreReadiness.canPlay) {
      setPlayerState("stopped");
      setPlayerCanvasActive(false);
      const detail = `${interactiveCoreReadiness.detail} ${interactiveCoreReadiness.verifyDetail}`;
      setProjectActionNotice({
        state: "warning",
        label: "Play setup needed",
        detail,
      });
      noteAction(detail);
      appendOpenCodeEvent("player.setup_needed", detail);
      return;
    }

    if (!isTauriRuntime() && loadedPlayerRom?.sourcePath !== activeRomSource.path) {
      const detail =
        "Browser preview cannot read this ROM from disk. Import a ROM in this browser session or use the desktop app to Play the current project.";
      setPlayerState("stopped");
      setPlayerCanvasActive(false);
      setProjectActionNotice({
        state: "warning",
        label: "Desktop app needed for Play",
        detail,
      });
      noteAction(detail);
      appendOpenCodeEvent("player.desktop_needed", detail);
      return;
    }

    setPlayerState("loading");
    setPlayerCanvasActive(true);
    noteAction(`Preparing ${activeRomSource.label} for interactive Play.`);
    appendOpenCodeEvent("player.prepare.started", activeRomSource.path);

    try {
      const payload = await readActiveRomForPlayer(activeRomSource);
      setLoadedPlayerRom(payload);

      const canvas = playerCanvasRef.current;
      if (!canvas) {
        throw new Error("Interactive player canvas was not available.");
      }

      disposeInteractivePlayer();
      const core = await readConfiguredInteractiveCoreForPlayer();
      const runtime = await launchNostalgistMegadrivePlayer({
        canvas,
        core,
        rom: payload,
      });
      playerRuntimeRef.current = runtime;
      setPlayerState("playing");
      void resumeNostalgistAudio(runtime).then(setPlayerAudio);
      setProjectActionNotice({
        state: "ready",
        label: "Interactive player started",
        detail: `${payload.sourceName} is running with ${
          runtime.coreSource === "user" ? "the user core" : "the dev CDN core"
        }.`,
      });
      noteAction(
        `Playing ${payload.sourceName} with ${
          runtime.coreSource === "user" ? "the user core" : "the dev CDN core"
        }.`,
      );
      appendOpenCodeEvent("player.playing", `${payload.sourcePath} via ${runtime.coreSource}`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Interactive Play setup failed";
      const launchFailure = coreLaunchFailureReadiness(detail);
      if (launchFailure) {
        setInteractiveCoreReadiness(launchFailure);
      }
      disposeInteractivePlayer();
      setPlayerCanvasActive(false);
      setPlayerState("error");
      setProjectActionNotice({
        state: launchFailure ? "warning" : "missing",
        label: launchFailure ? "Play setup needed" : "Play setup failed",
        detail: launchFailure ? `${launchFailure.detail} ${launchFailure.verifyDetail}` : detail,
      });
      noteAction(launchFailure ? launchFailure.detail : detail);
      appendOpenCodeEvent("player.failed", detail);
    }
  }

  async function readActiveRomForPlayer(source: ActiveRomSource): Promise<LoadedPlayerRom> {
    // Only reuse in-memory bytes in the browser preview, where there is no
    // disk access. In the desktop app the ROM at this path may have just
    // been rebuilt, so always re-read it.
    if (!isTauriRuntime() && loadedPlayerRom?.sourcePath === source.path) {
      return loadedPlayerRom;
    }

    if (!isTauriRuntime()) {
      throw new Error(
        "Browser preview cannot read that ROM from disk. Import a local ROM in this browser session or use the desktop app.",
      );
    }

    const result = await invoke<RomReadResult>("read_rom_bytes", {
      romPath: source.path,
    });
    return playerRomFromBytes(
      result.romPath,
      result.sourceName,
      base64ToBytes(result.dataBase64),
    );
  }

  async function readConfiguredInteractiveCoreForPlayer() {
    if (
      interactiveCoreReadiness.status !== "available" ||
      interactiveCoreReadiness.policy !== "user-supplied"
    ) {
      return undefined;
    }

    if (loadedInteractiveCore) {
      return loadedInteractiveCore;
    }

    if (!isTauriRuntime()) {
      throw new Error("Set Up Play again before playing; browser preview keeps user cores in memory.");
    }

    const result = await invoke<InteractiveCoreReadResult>("read_interactive_core_files");
    const core = loadedInteractiveCoreFromReadResult(result);
    setLoadedInteractiveCore(core);
    return core;
  }

  function toggleInteractivePlayerPause() {
    const runtime = playerRuntimeRef.current;
    if (!runtime) {
      noteAction("No interactive ROM is running yet.");
      return;
    }

    if (playerState === "paused") {
      setPlayerState("playing");
      setProjectActionNotice({
        state: "ready",
        label: "Interactive player resumed",
        detail: runtime.rom.sourceName,
      });
      noteAction("Interactive ROM resumed.");
      appendOpenCodeEvent("player.resumed", runtime.rom.sourcePath);
      window.setTimeout(() => {
        try {
          resumeNostalgistPlayer(runtime);
        } catch (error) {
          appendOpenCodeEvent(
            "player.resume.warning",
            error instanceof Error ? error.message : "Could not resume player cleanly",
          );
        }
      }, 0);
    } else {
      setPlayerState("paused");
      setProjectActionNotice({
        state: "warning",
        label: "Interactive player paused",
        detail: runtime.rom.sourceName,
      });
      noteAction("Interactive ROM paused.");
      appendOpenCodeEvent("player.paused", runtime.rom.sourcePath);
      window.setTimeout(() => {
        try {
          pauseNostalgistPlayer(runtime);
        } catch (error) {
          appendOpenCodeEvent(
            "player.pause.warning",
            error instanceof Error ? error.message : "Could not pause player cleanly",
          );
        }
      }, 0);
    }
  }

  function resetInteractivePlayer() {
    const runtime = playerRuntimeRef.current;
    if (!runtime) {
      noteAction("No interactive ROM is running yet.");
      return;
    }

    resetNostalgistPlayer(runtime);
    setPlayerState("playing");
    setProjectActionNotice({
      state: "ready",
      label: "Interactive player reset",
      detail: runtime.rom.sourceName,
    });
    noteAction("Interactive ROM reset.");
    appendOpenCodeEvent("player.reset", runtime.rom.sourcePath);
  }

  function stopInteractivePlayer() {
    const runtime = playerRuntimeRef.current;
    disposeInteractivePlayer();
    setPlayerCanvasActive(false);
    setPlayerState("stopped");
    setProjectActionNotice({
      state: "ready",
      label: "Interactive player stopped",
      detail: runtime?.rom.sourceName ?? activeRomSource.label,
    });
    noteAction("Interactive ROM stopped.");
    appendOpenCodeEvent("player.stopped", runtime?.rom.sourcePath ?? activeRomSource.path);
  }

  function disposeInteractivePlayer() {
    const runtime = playerRuntimeRef.current;
    if (!runtime) return;

    try {
      stopNostalgistPlayer(runtime);
    } catch (error) {
      appendOpenCodeEvent(
        "player.dispose.warning",
        error instanceof Error ? error.message : "Could not stop existing player cleanly",
      );
    } finally {
      playerRuntimeRef.current = undefined;
      setPlayerAudio("unavailable");
    }
  }

  function toggleEmulatorFocus() {
    setEmulatorFocused((current) => {
      const next = !current;
      noteAction(next ? "Focused emulator view enabled." : "Focused emulator view closed.");
      appendOpenCodeEvent(next ? "view.focused" : "view.restored", "Emulator view");
      return next;
    });
  }

  function toggleConversationPane() {
    setConversationCollapsed((current) => {
      const next = !current;
      noteAction(next ? "Conversation pane collapsed." : "Conversation pane expanded.");
      appendOpenCodeEvent(next ? "layout.conversation.collapsed" : "layout.conversation.expanded", "Conversation");
      return next;
    });
  }

  function toggleStatusPanels() {
    setStatusCollapsed((current) => {
      const next = !current;
      noteAction(next ? "ROM details collapsed." : "ROM details expanded.");
      appendOpenCodeEvent(next ? "layout.status.collapsed" : "layout.status.expanded", "ROM details");
      return next;
    });
  }

  function toggleControlsPanel() {
    setControlsOpen((current) => {
      const next = !current;
      noteAction(next ? "Controls opened." : "Controls closed.");
      appendOpenCodeEvent(next ? "input.controls.opened" : "input.controls.closed", "ROM controls");
      return next;
    });
  }

  function closeControlsPanel() {
    setControlsOpen(false);
    noteAction("Controls closed.");
    appendOpenCodeEvent("input.controls.closed", "ROM controls");
  }

  function resetControlsProfile() {
    const profile = resetInputProfile();
    setInputProfile(profile);
    setGamepadReadiness(detectGamepadReadiness(profile));
    setLastInputAction("Input defaults restored");
    noteAction("Input profile reset to defaults.");
    appendOpenCodeEvent("input.profile.reset", "Default keyboard and controller profile");
  }

  function focusRomInput() {
    setRomInputFocused(true);
    romViewportRef.current?.focus();
    const runtime = playerRuntimeRef.current;
    if (runtime && playerAudio === "unavailable") {
      void resumeNostalgistAudio(runtime).then(setPlayerAudio);
    }
    noteAction("ROM input focus is on the viewport.");
    appendOpenCodeEvent("input.focused", projectSummary.romPath);
  }

  function toggleInteractivePlayerMute() {
    const runtime = playerRuntimeRef.current;
    if (!runtime) return;
    if (playerAudio === "unavailable") {
      void resumeNostalgistAudio(runtime).then(setPlayerAudio);
      return;
    }
    setPlayerAudio(toggleNostalgistMute(runtime));
  }

  function handleRomKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const action = playerInputActionFromKey(event.key, inputProfile);
    if (!action) return;
    event.preventDefault();
    applyLocalRomInput(action);
  }

  function handleRomKeyUp(event: KeyboardEvent<HTMLDivElement>) {
    const action = playerInputActionFromKey(event.key, inputProfile);
    if (!action) return;
    event.preventDefault();
    releaseLocalRomInput(action);
  }

  function applyLocalRomInput(
    action: PlayerInputAction,
    source: "keyboard" | "controller" = "keyboard",
  ) {
    const spriteDelta = action.spriteDelta ?? 0;
    if (spriteDelta !== 0) {
      setSpriteX((current) => Math.min(88, Math.max(12, current + spriteDelta)));
    }
    const sourceLabel = source === "controller" ? "Controller" : "Keyboard";
    sendInteractivePlayerInput(action, "down");
    setLastPlayerInput(action);
    setLastInputAction(source === "controller" ? `${sourceLabel} ${action.label}` : action.label);
    noteAction(
      playerRuntimeRef.current
        ? `${sourceLabel} ${action.label} sent to the interactive player.`
        : `${sourceLabel} ${action.label} captured by the player input model. Press Play ROM to use it in the emulator.`,
    );
    appendOpenCodeEvent(action.event, `${sourceLabel}: ${action.detail}`);
  }

  function releaseLocalRomInput(action: PlayerInputAction) {
    sendInteractivePlayerInput(action, "up");
  }

  function sendInteractivePlayerInput(action: PlayerInputAction, phase: "down" | "up") {
    const runtime = playerRuntimeRef.current;
    if (!runtime) return;

    try {
      sendNostalgistInput(runtime, action, phase);
    } catch (error) {
      appendOpenCodeEvent(
        "player.input.failed",
        error instanceof Error ? error.message : action.detail,
      );
    }
  }

  async function runScriptedRightInputProof() {
    const prompt = "make a sprite I can move left and right with music";
    setInputProofBusy(true);
    setBuildState("building");
    setV1PromptSource("running");
    setLastInputAction("Right proof verifying");
    noteAction("Verifying scripted Right-input proof.");
    appendOpenCodeEvent("input.proof.started", "Scripted Right input");

    try {
      const promptResult = await runV1Prompt(prompt);
      applyV1PromptResult(promptResult, "core");
      setLastInputAction("Right proof passed");
      setMessages((current) => [
        ...current,
        makeMessage(
          "agent",
          "Scripted Right-input proof passed. The CORE ROM moved the sprite right through the verified Genteel path.",
          "proof",
        ),
      ]);
      noteAction("Scripted Right-input proof completed.");
      appendOpenCodeEvent("input.proof.ready", promptResult.movementDetail);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Right-input proof failed";
      setBuildState("error");
      setV1PromptSource("error");
      setLastInputAction("Right proof failed");
      setMessages((current) => [
        ...current,
        makeMessage("agent", `Scripted Right-input proof failed. ${detail}`, "proof"),
      ]);
      noteAction(`Right-input proof failed: ${detail}`);
      appendOpenCodeEvent("input.proof.failed", detail);
    } finally {
      setInputProofBusy(false);
    }
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

  async function launchRom(romPath?: string, doneMessage = "ROM preview ready.") {
    setStarterBusy(true);
    setStarterSource("checking");
    setBuildState("building");
    noteAction(romPath ? "Loading the ROM preview." : "Loading the starter ROM preview.");

    if (!isTauriRuntime()) {
      setStarterRom(makePreviewStarterRom(romPath));
      setStarterSource("preview");
      setBuildState("running");
      noteAction(`${doneMessage} Browser preview is using simulated frames.`);
      setStarterBusy(false);
      return;
    }

    try {
      const preview = romPath
        ? await invoke<StarterRomPreview>("launch_rom_path", { romPath })
        : await invoke<StarterRomPreview>("launch_starter_rom");
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
    <main
      className={`app-shell ${emulatorFocused ? "emulator-focused" : ""} ${
        conversationCollapsed ? "conversation-collapsed" : ""
      } ${statusCollapsed ? "status-collapsed" : ""}`}
    >
      <input
        ref={romImportInputRef}
        type="file"
        accept={romImportAccept(importReadiness)}
        data-testid="rom-import-input"
        hidden
        onChange={(event) => {
          void handleRomFileSelected(event);
        }}
      />
      <input
        ref={coreImportInputRef}
        type="file"
        accept={interactiveCoreAccept(interactiveCoreStatus)}
        data-testid="core-import-input"
        hidden
        multiple
        onChange={(event) => {
          void handleInteractiveCoreFilesSelected(event);
        }}
      />
      <TopBar
        buildLabel={buildLabel}
        buildState={buildState}
        exportBusy={exportBusy}
        menuOpen={projectMenuOpen}
        projectName={projectSummary.name}
        saveBusy={saveBusy}
        onExport={() => {
          void exportRom();
        }}
        onOpenSettings={() => setSettingsOpen(true)}
        onSave={() => {
          void saveProject();
        }}
        onToggleMenu={() => setProjectMenuOpen((current) => !current)}
      />

      <section className="workspace" aria-label="Drive16 workspace">
        <ChatRail
          activityNote={actionDetail}
          busy={openCodeBusy || buildState === "building"}
          collapsed={conversationCollapsed}
          draft={draft}
          messages={messages}
          messagesRef={messagesRef}
          needsProviderSetup={
            modelConnection.state !== "ready" && !agentProviders.includes("openrouter")
          }
          sendDisabled={openCodeBusy}
          onDraftChange={setDraft}
          onOpenSettings={() => setSettingsOpen(true)}
          onSubmit={submitMessage}
          onToggleCollapse={toggleConversationPane}
        />
        <PlayerPane
          canvasRef={playerCanvasRef}
          controllerBindings={controllerBindingRows}
          controllerConfigured={controllerMappingReady}
          controlsOpen={controlsOpen}
          emulatorFocused={emulatorFocused}
          gamepadReadiness={gamepadReadiness}
          keyboardBindings={keyboardBindingRows}
          keyboardMappings={keyboardMappings}
          lastInputAction={lastInputAction}
          playerAudio={playerAudio}
          playerCanvasActive={playerCanvasActive}
          playerState={playerState}
          profileSource={inputProfile.source}
          romInputFocused={romInputFocused}
          romLabel={activeRomSource.label}
          sessionActive={Boolean(playerRuntimeRef.current)}
          spriteX={spriteX}
          starterBusy={starterBusy}
          starterRom={starterRom}
          stateLabel={playerStateLabel(playerState)}
          transport={transport}
          viewportRef={romViewportRef}
          onCloseControls={closeControlsPanel}
          onPlay={() => {
            void playActiveRom();
          }}
          onResetPlayer={resetInteractivePlayer}
          onResetProfile={resetControlsProfile}
          onScreenBlur={() => setRomInputFocused(false)}
          onScreenClick={focusRomInput}
          onScreenFocus={() => setRomInputFocused(true)}
          onScreenKeyDown={handleRomKeyDown}
          onScreenKeyUp={handleRomKeyUp}
          onStop={stopInteractivePlayer}
          onToggleControls={toggleControlsPanel}
          onToggleFocus={toggleEmulatorFocus}
          onToggleMute={toggleInteractivePlayerMute}
          onTogglePause={toggleInteractivePlayerPause}
        />
      </section>

      <div className="sr-only" aria-live="polite" data-testid="rom-action-feedback">
        {actionFeedback.label}. {actionFeedback.detail}
        {actionFeedback.detail === actionDetail ? "" : ` ${actionDetail}`}
      </div>

      {toastNotice ? (
        <div className={`toast ${toastNotice.state}`} role="status" data-testid="action-toast">
          <div className="toast-body">
            <strong>{toastNotice.label}</strong>
            <span>{toastNotice.detail}</span>
          </div>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setToastNotice(undefined)}
          >
            ×
          </button>
        </div>
      ) : null}

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
          openCode={openCode}
          openCodeEvents={openCodeEvents}
          openCodeSource={openCodeSource}
          openRouterKey={openRouterKey}
          preflightBusy={preflightSource === "checking"}
          preflightChecks={preflightWithInteractivePlay}
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
          onRefreshModels={() => {
            void refreshOpenRouterModels();
          }}
          onRefreshPreflight={() => {
            void refreshPreflight();
          }}
          onShowOpenRouterKeyChange={setShowOpenRouterKey}
          onTestComfyUiConnection={() => {
            void testComfyUiConnection();
          }}
          onTestConnection={() => {
            void testModelConnection();
          }}
        />
      ) : null}

      {projectMenuOpen ? (
        <ProjectMenu
          exportBusy={exportBusy}
          exportResult={exportResult}
          importBusy={importBusy}
          importResult={importResult}
          interactiveCoreBusy={interactiveCoreBusy}
          interactiveCoreStatus={interactiveCoreStatus}
          projectActionNotice={projectActionNotice}
          projectSummary={projectSummary}
          saveBusy={saveBusy}
          saveResult={saveResult}
          verifyBusy={starterBusy || buildState === "building"}
          workspacePath={workspacePath}
          onChooseCore={() => {
            void chooseInteractiveCore();
          }}
          onClose={() => setProjectMenuOpen(false)}
          onExportRom={() => {
            void exportRom();
          }}
          onImportRom={() => {
            void importRom();
          }}
          onImportTestRom={() => {
            void importTestRom();
          }}
          onNewProject={() => {
            startNewProject();
            setProjectMenuOpen(false);
          }}
          onOpenProject={() => openProjectSnapshot()}
          onSaveProject={() => {
            void saveProject();
          }}
          onVerify={() => {
            runCurrentProject();
            setProjectMenuOpen(false);
          }}
        />
      ) : null}
    </main>
  );
}

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

// Streamed-CDN core fallback: allowed in dev and in the local desktop app so
// Play works out of the box. A public release should bundle or require a
// user-supplied core instead (tracked in the overhaul plan).
function allowDevCoreCdnFallback() {
  if (isTauriRuntime()) return true;
  const meta = import.meta as ImportMeta & {
    env?: { DEV?: unknown };
  };
  const dev = meta.env?.DEV;
  return dev === true || String(dev) === "true";
}

// Tauri invoke rejects with plain strings; keep the real reason.
function errorDetail(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
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
      ? "Built the demo with a generated sprite and generated music, checked movement and audio, and loaded it on the right."
      : "Previewed the generated sprite and music demo. The desktop app builds the ROM and checks movement and audio.";
  }
  if (generatedMusic) {
    return isTauriRuntime()
      ? "Built the demo with generated music, checked movement and audio, and loaded it on the right."
      : "Previewed the generated music demo. The desktop app builds the ROM and checks movement and audio.";
  }
  return isTauriRuntime()
    ? "Built the sprite-and-music demo, checked movement and audio, and loaded it on the right."
    : "Previewed the bundled sprite/music demo. The desktop app builds the ROM and checks movement and audio.";
}

function getConversationMode(
  provider: ModelProvider,
  activeModel: string,
  ollamaModel: string,
  connection: ModelConnectionReport,
  openCode: OpenCodeBridgeStatus,
  openRouterKeyPresent: boolean,
): ConversationMode {
  const providerLabel = providerDisplayLabel(provider, activeModel, ollamaModel);

  if (provider === "ollama") {
    return {
      state: "warning",
      label: "Ollama readiness only",
      detail:
        "Ollama can be checked locally, but live Ollama replies are not wired yet.",
    };
  }

  if (connection.state !== "ready") {
    if (!openRouterKeyPresent) {
      return {
        state: "missing",
        label: "OpenRouter key needed",
        detail: "Paste a session key in Settings; it stays in this app window.",
      };
    }

    return {
      state: "warning",
      label: "OpenRouter not tested",
      detail: `${providerLabel} is ${connectionLabel(
        connection.state,
      ).toLowerCase()}. Test the key to enable freeform replies.`,
    };
  }

  if (provider === "openrouter") {
    return {
      state: openCode.state === "ready" ? "ready" : "warning",
      label: "OpenRouter live",
      detail:
        openCode.state === "ready"
          ? "Freeform messages get real OpenRouter replies; ROM-changing prompts still use local proof."
          : `Freeform messages can use OpenRouter, but OpenCode logging is ${stateLabel(
              openCode.state,
            ).toLowerCase()}.`,
    };
  }

  return {
    state: "warning",
    label: "ROM proof only",
    detail: "Freeform replies are not available for the selected provider.",
  };
}

function freeformGateMessage(
  provider: ModelProvider,
  activeModel: string,
  ollamaModel: string,
  connection: ModelConnectionReport,
  openRouterKeyPresent: boolean,
) {
  const providerLabel = providerDisplayLabel(provider, activeModel, ollamaModel);

  if (provider === "ollama") {
    return "Ollama chat replies are not available yet. Switch to OpenRouter and test a key for chat replies; build prompts still run locally.";
  }

  if (!openRouterKeyPresent) {
    return "OpenRouter needs a session key before freeform chat can answer. Paste a BYOK key in Agent Settings and test it; the key stays in this app window and is not committed to the project. ROM-changing prompts still use the verified local build path.";
  }

  if (connection.state !== "ready") {
    return `${providerLabel} is not ready yet (${connectionLabel(
      connection.state,
    ).toLowerCase()}). Open Settings and click Test, then send your message again.`;
  }

  return undefined;
}

function openRouterReplyFailureMessage(detail: string) {
  if (/401|403|key|auth|credit|quota|rate/i.test(detail)) {
    return `OpenRouter could not answer: ${detail}. Check the key, credits, or model access.`;
  }
  if (/network|fetch|failed|timeout|load/i.test(detail)) {
    return `OpenRouter could not answer because the request failed: ${detail}.`;
  }
  return `OpenRouter could not answer: ${detail}.`;
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

function activeRomSourceFor(
  projectSummary: ProjectSummary,
  importResult?: RomImportResult,
  v1PromptResult?: V1PromptResult,
  agentRomPath?: string,
): ActiveRomSource {
  if (agentRomPath) {
    return {
      kind: "generated",
      label: "Your project",
      detail: "ROM built by the Drive16 agent",
      path: agentRomPath,
      storage: "generated-artifact",
      canVerify: true,
    };
  }

  if (importResult) {
    return {
      kind: "imported",
      label: "Imported ROM",
      detail: `${importResult.sourceName} copied into ignored local storage`,
      path: importResult.importPath,
      storage: "ignored-artifact",
      canVerify: true,
    };
  }

  if (v1PromptResult) {
    return {
      kind: "generated",
      label: projectSummary.name,
      detail: "Drive16-generated ROM artifact",
      path: v1PromptResult.romPath,
      storage: "generated-artifact",
      canVerify: true,
    };
  }

  return {
    kind: "starter",
    label: projectSummary.name,
    detail: "Starter project ROM",
    path: projectSummary.romPath,
    storage: "repo",
    canVerify: true,
  };
}

function playerStateLabel(state: PlayerSessionState) {
  if (state === "playing") return "Playing";
  if (state === "paused") return "Paused";
  if (state === "loading") return "Loading";
  if (state === "error") return "Error";
  return "Stopped";
}

function interactiveCoreHealthCheck(readiness: InteractiveCoreReadiness): HealthCheck {
  return {
    name: "Interactive Play",
    state: interactiveCoreHealthState(readiness),
    detail: `${readiness.source}: ${readiness.detail}`,
    hints: [readiness.verifyDetail, readiness.setupAction],
  };
}

function interactiveCoreHealthState(readiness: InteractiveCoreReadiness): HealthState {
  if (readiness.status === "available") return "ready";
  if (readiness.status === "missing" || readiness.status === "unsupported") return "missing";
  return "warning";
}

function romImportAccept(readiness?: RomImportReadiness) {
  return (readiness?.acceptedExtensions ?? previewImportReadiness.acceptedExtensions).join(",");
}

function interactiveCoreAccept(status?: InteractiveCoreStatusResult) {
  return (status?.acceptedExtensions ?? previewInteractiveCoreStatus.acceptedExtensions).join(",");
}

function isAcceptedRomFileName(fileName: string, extensions: string[]) {
  const normalized = fileName.toLowerCase();
  return extensions.some((extension) => normalized.endsWith(extension.toLowerCase()));
}

async function normalizeInteractiveCoreSelection(
  files: File[],
): Promise<InteractiveCoreSelectedFile[]> {
  if (files.length === 1 && files[0].name.toLowerCase().endsWith(".zip")) {
    const archiveBytes = new Uint8Array(await files[0].arrayBuffer());
    let entries: Record<string, Uint8Array>;
    try {
      entries = unzipSync(archiveBytes);
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? `Could not read core ZIP: ${error.message}`
          : "Could not read core ZIP",
      );
    }

    return selectInteractiveCorePair(
      Object.entries(entries)
        .filter(([name, bytes]) => !name.endsWith("/") && bytes.byteLength > 0)
        .map(([name, bytes]) => ({
          fileName: name.split("/").filter(Boolean).pop() ?? name,
          bytes,
        })),
      true,
    );
  }

  return selectInteractiveCorePair(
    await Promise.all(
      files.map(async (file) => ({
        fileName: file.name,
        bytes: new Uint8Array(await file.arrayBuffer()),
      })),
    ),
    false,
  );
}

function selectInteractiveCorePair(
  files: InteractiveCoreSelectedFile[],
  fromArchive: boolean,
): InteractiveCoreSelectedFile[] {
  const unsupported = files.filter((file) => !interactiveCoreStorageExtension(file.fileName));
  if (!fromArchive && unsupported.length > 0) {
    throw new Error("Choose a .zip archive or a .js + .wasm pair.");
  }

  const candidates = fromArchive
    ? files.filter((file) => interactiveCoreStorageExtension(file.fileName))
    : files;
  const jsFile = pickInteractiveCoreFile(candidates, ".js");
  const wasmFile = pickInteractiveCoreFile(candidates, ".wasm");

  if (!jsFile || !wasmFile) {
    throw new Error("Core setup needs one .js loader and one matching .wasm file.");
  }
  if (jsFile.bytes.byteLength === 0 || wasmFile.bytes.byteLength === 0) {
    throw new Error("Core files cannot be empty.");
  }

  return [jsFile, wasmFile];
}

function pickInteractiveCoreFile(files: InteractiveCoreSelectedFile[], extension: ".js" | ".wasm") {
  const candidates = files.filter(
    (file) => interactiveCoreStorageExtension(file.fileName) === extension,
  );
  if (candidates.length === 0) return undefined;

  return (
    candidates.find((file) => {
      const normalized = file.fileName.toLowerCase();
      return normalized.includes("genesis_plus_gx") && normalized.includes("libretro");
    }) ??
    candidates.find((file) => file.fileName.toLowerCase().includes("genesis")) ??
    candidates[0]
  );
}

function interactiveCoreStorageExtension(fileName: string) {
  const normalized = fileName.toLowerCase();
  if (normalized.endsWith(".js")) return ".js";
  if (normalized.endsWith(".wasm")) return ".wasm";
  return undefined;
}

function previewImportForFile(file: File, readiness: RomImportReadiness): RomImportResult {
  const extension = acceptedRomExtensionForName(file.name, readiness.acceptedExtensions) ?? ".bin";
  const stem = file.name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/gi, "-") || "rom";

  return {
    ...previewImportResult,
    sourceName: file.name,
    importPath: `${readiness.importDirectory}/drive16-import-preview-${stem}${extension}`,
    bytes: file.size,
    acceptedExtensions: readiness.acceptedExtensions,
  };
}

function previewInteractiveCoreImport(
  files: InteractiveCoreSelectedFile[],
): InteractiveCoreImportResult {
  const jsFile = files.find((file) => interactiveCoreStorageExtension(file.fileName) === ".js");
  const wasmFile = files.find((file) => interactiveCoreStorageExtension(file.fileName) === ".wasm");
  if (!jsFile || !wasmFile) {
    throw new Error("Core setup needs one .js loader and one matching .wasm file.");
  }

  return {
    ...previewInteractiveCoreStatus,
    generatedAt: new Date().toISOString(),
    status: "available",
    detail: "User-supplied Genesis core loaded for this browser session.",
    source: "User core",
    jsPath: `${previewInteractiveCoreStatus.importDirectory}/genesis_plus_gx_libretro.js`,
    wasmPath: `${previewInteractiveCoreStatus.importDirectory}/genesis_plus_gx_libretro.wasm`,
    jsBytes: jsFile.bytes.byteLength,
    wasmBytes: wasmFile.bytes.byteLength,
  };
}

function previewTestRomImport(): RomImportResult {
  return {
    ...previewImportResult,
    sourceName: "starter-test-rom.bin",
    importPath: "artifacts/phase5/imports/drive16-import-preview-starter-test-rom.bin",
  };
}

function loadedInteractiveCoreFromSelectedFiles(
  result: InteractiveCoreImportResult,
  files: InteractiveCoreSelectedFile[],
): LoadedInteractiveCore {
  const jsFile = files.find((file) => interactiveCoreStorageExtension(file.fileName) === ".js");
  const wasmFile = files.find((file) => interactiveCoreStorageExtension(file.fileName) === ".wasm");
  if (!jsFile || !wasmFile) {
    throw new Error("Core setup needs one .js loader and one matching .wasm file.");
  }

  return loadedInteractiveCoreFromBytes(
    result.coreName,
    result.jsPath,
    result.wasmPath,
    jsFile.bytes,
    wasmFile.bytes,
  );
}

function loadedInteractiveCoreFromReadResult(
  result: InteractiveCoreReadResult,
): LoadedInteractiveCore {
  return loadedInteractiveCoreFromBytes(
    result.coreName,
    result.jsPath,
    result.wasmPath,
    base64ToBytes(result.jsDataBase64),
    base64ToBytes(result.wasmDataBase64),
  );
}

function loadedInteractiveCoreFromBytes(
  coreName: string,
  jsPath: string,
  wasmPath: string,
  jsBytes: Uint8Array,
  wasmBytes: Uint8Array,
): LoadedInteractiveCore {
  return {
    loadedAt: new Date().toISOString(),
    source: "user",
    coreName,
    jsPath,
    wasmPath,
    jsFileName: fileNameFromPath(jsPath),
    wasmFileName: fileNameFromPath(wasmPath),
    jsBlob: blobFromBytes(jsBytes, "text/javascript"),
    wasmBlob: blobFromBytes(wasmBytes, "application/wasm"),
    jsBytes: jsBytes.byteLength,
    wasmBytes: wasmBytes.byteLength,
  };
}

function blobFromBytes(bytes: Uint8Array, type: string) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new Blob([buffer], { type });
}

function fileNameFromPath(path: string) {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

function previewSaveForProject(project: ProjectSummary): ProjectSaveResult {
  const projectName = project.projectPath.split("/").filter(Boolean).pop() ?? "project";
  return {
    ...previewSaveResult,
    sourceProjectPath: project.projectPath,
    snapshotPath: `artifacts/phase3/projects/drive16-${projectName}-preview`,
  };
}

function previewExportForRom(source: ActiveRomSource): RomExportResult {
  const extension = acceptedRomExtensionForName(
    source.path,
    previewImportReadiness.acceptedExtensions,
  ) ?? ".bin";
  if (source.kind === "starter" && isDefaultStarterRomPath(source.path)) {
    return {
      ...previewExportResult,
      sourceRomPath: source.path,
    };
  }

  return {
    ...previewExportResult,
    status: "ready",
    detail: `Preview export for ${source.label}`,
    sourceRomPath: source.path,
    exportPath: `artifacts/phase3/exports/drive16-active-preview${extension}`,
    bytes: 0,
  };
}

function projectSummaryFromImport(result: RomImportResult): ProjectSummary {
  const importDirectory =
    result.importPath.split("/").slice(0, -1).join("/") || previewImportReadiness.importDirectory;

  return {
    generatedAt: result.generatedAt,
    name: "Imported ROM",
    projectPath: importDirectory,
    romPath: result.importPath,
    exportDirectory: previewProjectSummary.exportDirectory,
    romStatus: result.status,
    romDetail: `${formatBytes(result.bytes)} from ${result.sourceName}`,
    files: [
      {
        label: "Imported ROM",
        path: result.importPath,
        state: result.status,
      },
      {
        label: "Import storage",
        path: importDirectory,
        state: "ready",
      },
    ],
  };
}

function projectSummaryFromSnapshot(snapshot: ProjectSnapshot): ProjectSummary {
  const romPath = `${snapshot.projectPath}/out/rom.bin`;
  return {
    generatedAt: snapshot.generatedAt,
    name: snapshot.name,
    projectPath: snapshot.projectPath,
    romPath,
    exportDirectory: previewProjectSummary.exportDirectory,
    romStatus: "ready",
    romDetail: snapshot.detail,
    files: [
      {
        label: "Main C",
        path: `${snapshot.projectPath}/src/main.c`,
        state: "ready",
      },
      {
        label: "Resources",
        path: `${snapshot.projectPath}/res/resources.res`,
        state: "ready",
      },
      {
        label: "ROM",
        path: romPath,
        state: "ready",
      },
    ],
  };
}

function acceptedRomExtensionForName(fileName: string, extensions: string[]) {
  const normalized = fileName.toLowerCase();
  return extensions.find((extension) => normalized.endsWith(extension.toLowerCase()));
}

function isDefaultStarterRomPath(romPath: string) {
  return romPath === previewProjectSummary.romPath;
}

function snapshotFromSaveResult(result: ProjectSaveResult): ProjectSnapshot {
  return {
    generatedAt: result.generatedAt,
    name: result.snapshotPath.split("/").filter(Boolean).pop() ?? "Saved project",
    projectPath: result.snapshotPath,
    detail: `${result.files} files`,
  };
}

function shortIdentifier(value: string) {
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function playerRomFromBytes(
  sourcePath: string,
  sourceName: string,
  bytes: Uint8Array,
): LoadedPlayerRom {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const blob = new Blob([buffer], { type: "application/octet-stream" });
  return {
    loadedAt: new Date().toISOString(),
    sourcePath,
    sourceName,
    objectUrl: URL.createObjectURL(blob),
    bytes: bytes.byteLength,
  };
}

function makePreviewStarterRom(romPath?: string): StarterRomPreview {
  const framebufferFrames = [
    makePreviewFrame(0, 0x3944),
    makePreviewFrame(30, 0x4145),
  ];

  return {
    ...previewStarterRom,
    detail: romPath ? "Imported ROM preview frames" : previewStarterRom.detail,
    projectPath: romPath
      ? romPath.split("/").slice(0, -1).join("/") || previewImportReadiness.importDirectory
      : previewStarterRom.projectPath,
    romPath: romPath ?? previewStarterRom.romPath,
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

function providerDisplayLabel(
  provider: ModelProvider,
  activeModel: string,
  ollamaModel: string,
) {
  if (provider === "openrouter") return shortModelLabel(activeModel);
  return `Ollama ${shortOllamaLabel(ollamaModel)}`;
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

export default App;
