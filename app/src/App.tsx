import { invoke } from "@tauri-apps/api/core";
import { unzipSync } from "fflate";
import type { ChangeEvent, KeyboardEvent } from "react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  defaultOpenRouterModel,
  openRouterFreeformMessages,
  sendOllamaFreeformReply,
  sendOpenRouterFreeformReply,
} from "./agent/openrouter";
import {
  classifyAgentIntent,
  looksLikeBuildPrompt,
  mentionsKnownGameShape,
  shouldPreserveActiveProject,
} from "./agent/promptIntent";
import {
  abortAgentSession,
  agentActivityFromEvent,
  agentPromptWithProject,
  buildActiveProject,
  createAgentActivityRepairState,
  ensureActiveProject,
  resetActiveProject,
  seedActiveProjectForPrompt,
  sendAgentPrompt,
  setAgentProviderKey,
  verifyBrowserProject,
  visibleAgentActivityEvents,
  type ActiveProject,
  type BrowserProjectVerification,
} from "./agent/opencodeSession";
import {
  coreLaunchFailureReadiness,
  activeGamepadActionIds,
  clampPlayerVolume,
  detectNostalgistAudioSignal,
  controllerProfileConfigured,
  defaultPlayerVolume,
  detectInteractiveCoreReadiness,
  detectGamepadReadiness,
  firstConnectedGamepad,
  GENESIS_PLUS_GX_CORE,
  launchNostalgistMegadrivePlayer,
  loadInputProfile,
  pauseNostalgistPlayer,
  playerInputActionForId,
  playerInputActionFromKey,
  resetInputProfile,
  restartNostalgistPlayer,
  resumeNostalgistAudio,
  resumeNostalgistPlayer,
  sendNostalgistInput,
  setNostalgistMuted,
  setNostalgistVolume,
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
type ConnectionState = HealthState | "idle" | "testing" | "starting";
type MessageSource = "proof" | "system" | "opencode" | "model";
type AgentPhase = "idle" | "planning" | "editing" | "building" | "testing" | "done" | "failed";

type Message = {
  id: number;
  role: "user" | "agent";
  source?: MessageSource;
  body: string;
  time: string;
};

type PendingAgentRun = {
  sessionId: string;
  startedAt: number;
  previousSession?: string;
  projectName: string;
  providerId?: ModelProvider;
  modelId?: string;
  sawSourceOrResourceEdit?: boolean;
  sawBuildStarted?: boolean;
  sawBuildFinished?: boolean;
  sawBuildFailed?: boolean;
  sawScreenCheck?: boolean;
  sawInputTest?: boolean;
  sawAudioCheck?: boolean;
  requiresAiSprites?: boolean;
  sawAiSpriteFinished?: boolean;
  sawAiSpriteFailed?: boolean;
  musicCompileAttempts?: number;
  waitingTimer?: number;
  stallTimer?: number;
  backgroundErrorTimer?: number;
  projectRefreshTimer?: number;
  hardStopTimer?: number;
  hardLimitMs?: number;
  baselineRomExists?: boolean;
  adoptedFreshRom?: boolean;
};

type PersistedPendingAgentRun = Pick<
  PendingAgentRun,
  "sessionId" | "startedAt" | "projectName"
>;

type ConversationMode = {
  state: HealthState;
  label: string;
  detail: string;
};

type HealthState = "ready" | "warning" | "missing";
type ProjectTrustStage = "prototype" | "built" | "playable" | "reviewed" | "failed";

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
  audioDumpPath?: string;
  inputScriptPath?: string;
  screenshotDataUrl: string;
  frames: number;
  streamEvery: number;
  streamedFrames: number;
  frameWidth: number;
  frameHeight: number;
  framebufferFrames: FramebufferFrame[];
  audioMaxAbs?: number;
  inputChanged?: boolean;
  inputChangeRatio?: number;
};

type ProjectFileEntry = {
  label: string;
  path: string;
  state: HealthState;
};

type ProjectAssetRole = {
  role: string;
  source: string;
  symbol: string;
  status: string;
  notes: string;
  previewDataUrl?: string;
};

type ProjectSummary = {
  generatedAt: string;
  name: string;
  projectPath: string;
  romPath: string;
  exportDirectory: string;
  romStatus: HealthState;
  romDetail: string;
  trustStage: ProjectTrustStage;
  reviewDetail: string;
  restartAction?: PlayerInputActionId | null;
  files: ProjectFileEntry[];
  assetRoles: ProjectAssetRole[];
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

type RomPreviewLoadResult = {
  ok: boolean;
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

type OpenCodeBackgroundError = {
  generatedAt: string;
  detail: string;
};

type ProjectMemoryAuditResult = {
  generatedAt: string;
  status: HealthState;
  detail: string;
  projectPath: string;
  gate: "pass" | "fail" | "unknown" | string;
  files: Array<{
    name: string;
    status: HealthState;
    detail: string;
  }>;
};

type OpenCodeEvent = {
  id: number;
  type: string;
  detail: string;
  time: string;
};

type OpenCodeHeartbeat = {
  active: boolean;
  time: string;
};

type PlayerScreenEvidence =
  | "none"
  | "checking"
  | "captured"
  | "visible"
  | "unverified"
  | "inconclusive";
type PlayerInputEvidence = "none" | "testing" | "tested" | "failed";
type PlayerAudioEvidence = "none" | "checking" | "captured" | "silent" | "failed";

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

type OllamaTagsResponse = {
  models?: Array<{ name?: string; model?: string }>;
};

type DecodedFramebufferFrame = {
  frameIndex: number;
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
};

const openRouterKeyUrl = "https://openrouter.ai/api/v1/key";
const openRouterModelsUrl = "https://openrouter.ai/api/v1/models";
const openRouterKeyStorageKey = "drive16.openrouter.key.v1";
const openRouterAcceptedKeyStorageKey = "drive16.openrouter.acceptedKey.v1";
const legacyOpenRouterSessionKeyStorageKey = "drive16.openrouter.sessionKey.v1";
const activeProjectNameStorageKey = "drive16.activeProject.name.v1";
const pendingAgentRunStorageKey = "drive16.agent.pending.v1";
const defaultOllamaEndpoint = "http://127.0.0.1:11434";
const defaultOllamaModel =
  "rafw007/Qwen3.6-35B-A3B-mlx-claude-coder-abliterated:latest";
const defaultComfyUiEndpoint = "http://127.0.0.1:8188";
const playerSetupTimeoutMs = 20_000;
const openCodeHeartbeatTimeoutMs = 15_000;
// ComfyUI generation plus one source edit/build cycle regularly exceeds three
// minutes even when the bounded model is making progress. Keep a hard stop,
// but do not abort an active implementation before it reaches the build step.
const agentRunHardLimitMs = 5 * 60_000;

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

// Non-secret settings persist across app restarts. The API key has its own
// storage path because it also needs to sync into OpenCode's local auth store.
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

function loadOpenRouterKey() {
  if (typeof window === "undefined") return "";

  try {
    return (
      window.localStorage.getItem(openRouterKeyStorageKey) ??
      window.sessionStorage.getItem(legacyOpenRouterSessionKeyStorageKey) ??
      ""
    );
  } catch {
    return "";
  }
}

function saveOpenRouterKey(value: string) {
  if (typeof window === "undefined") return;

  try {
    const trimmed = value.trim();
    if (trimmed) {
      window.localStorage.setItem(openRouterKeyStorageKey, trimmed);
    } else {
      window.localStorage.removeItem(openRouterKeyStorageKey);
      window.localStorage.removeItem(openRouterAcceptedKeyStorageKey);
    }
    window.sessionStorage.removeItem(legacyOpenRouterSessionKeyStorageKey);
  } catch {
    // Some locked-down WebViews can reject storage; the in-memory key still works.
  }
}

function openRouterKeyMarker(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  let hash = 5381;
  for (let index = 0; index < trimmed.length; index += 1) {
    hash = (hash * 33) ^ trimmed.charCodeAt(index);
  }
  return `${trimmed.length}:${(hash >>> 0).toString(36)}`;
}

function loadOpenRouterAcceptedKeyMarker() {
  if (typeof window === "undefined") return "";

  try {
    return window.localStorage.getItem(openRouterAcceptedKeyStorageKey) ?? "";
  } catch {
    return "";
  }
}

function saveOpenRouterAcceptedKey(value: string) {
  if (typeof window === "undefined") return;

  try {
    const marker = openRouterKeyMarker(value);
    if (marker) {
      window.localStorage.setItem(openRouterAcceptedKeyStorageKey, marker);
    } else {
      window.localStorage.removeItem(openRouterAcceptedKeyStorageKey);
    }
  } catch {
    // If storage is unavailable, the current in-memory connection state still works.
  }
}

function clearOpenRouterAcceptedKey() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(openRouterAcceptedKeyStorageKey);
  } catch {
    // Nothing else to clear.
  }
}

function openRouterKeyWasAccepted(value: string) {
  const marker = openRouterKeyMarker(value);
  return Boolean(marker) && marker === loadOpenRouterAcceptedKeyMarker();
}

function loadActiveProjectName(fallback = "Untitled Project") {
  if (typeof window === "undefined") return fallback;

  try {
    return window.localStorage.getItem(activeProjectNameStorageKey) || fallback;
  } catch {
    return fallback;
  }
}

function saveActiveProjectName(value: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(activeProjectNameStorageKey, value.trim() || "Untitled Project");
  } catch {
    // Storage can be unavailable in locked-down WebViews; the in-memory name still works.
  }
}

function resetActiveProjectName() {
  saveActiveProjectName("Untitled Project");
}

function loadPersistedPendingAgentRun(): PersistedPendingAgentRun | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(pendingAgentRunStorageKey) ?? "null");
    if (
      !parsed ||
      typeof parsed.sessionId !== "string" ||
      typeof parsed.startedAt !== "number" ||
      typeof parsed.projectName !== "string"
    ) {
      return undefined;
    }
    return parsed as PersistedPendingAgentRun;
  } catch {
    return undefined;
  }
}

function persistPendingAgentRun(pending: PersistedPendingAgentRun) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(pendingAgentRunStorageKey, JSON.stringify(pending));
  } catch {
    // The in-memory run still works when browser storage is unavailable.
  }
}

function clearPersistedPendingAgentRun() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(pendingAgentRunStorageKey);
  } catch {
    // Nothing else to clear.
  }
}

const starterMessages: Message[] = [
  {
    id: 1,
    role: "agent",
    source: "system",
    body: "New starter project ready. Describe what to build, or ask for a sprite you can move with music.",
    time: formatMessageTime(),
  },
];
const conversationStorageKey = "drive16.conversation.v2";

function loadConversationMessages(): Message[] {
  if (typeof window === "undefined") return starterMessages;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(conversationStorageKey) ?? "null");
    if (
      !parsed ||
      parsed.projectName !== loadActiveProjectName() ||
      !Array.isArray(parsed.messages) ||
      parsed.messages.length === 0
    ) {
      return starterMessages;
    }
    const storedMessages = parsed.messages as Message[];
    const messages = storedMessages.filter(
      (message): message is Message =>
        message &&
        typeof message.id === "number" &&
        (message.role === "user" || message.role === "agent") &&
        typeof message.body === "string" &&
        typeof message.time === "string" &&
        !message.body.startsWith("Drive16 could not automatically confirm this screen."),
    );
    return messages.length ? messages.slice(-40) : starterMessages;
  } catch {
    return starterMessages;
  }
}

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
  name: "Untitled Project",
  projectPath: "artifacts/phase3/active-project",
  romPath: "artifacts/phase3/active-project/out/rom.bin",
  exportDirectory: "artifacts/phase3/exports",
  romStatus: "missing",
  romDetail: "No ROM built yet",
  trustStage: "prototype",
  reviewDetail: "No ROM has been built or reviewed",
  assetRoles: [
    {
      role: "Game code primitives",
      source: "None yet",
      symbol: "src/main.c",
      status: "Pending",
      notes: "Choose gameplay roles before generating or wiring assets.",
    },
  ],
  files: [
    {
      label: "Main C",
      path: "artifacts/phase3/active-project/src/main.c",
      state: "ready",
    },
    {
      label: "Resources",
      path: "artifacts/phase3/active-project/res/resources.res",
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
  detail: "Create, open, import, or verify here. Save and Export stay in the top bar.",
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
  const [messages, setMessages] = useState<Message[]>(loadConversationMessages);
  const [draft, setDraft] = useState("");
  const [buildState, setBuildState] = useState<BuildState>("running");
  const [transport, setTransport] = useState<TransportState>("running");
  const [spriteX, setSpriteX] = useState(52);
  const [preflight, setPreflight] = useState<PreflightReport>(previewPreflight);
  const [preflightSource, setPreflightSource] = useState("checking");
  const [starterRom, setStarterRom] = useState<StarterRomPreview>(previewStarterRom);
  const [starterSource, setStarterSource] = useState("checking");
  const [starterBusy, setStarterBusy] = useState(false);
  const [projectSummary, setProjectSummary] = useState<ProjectSummary>(() => ({
    ...previewProjectSummary,
    name: loadActiveProjectName(previewProjectSummary.name),
  }));
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
  const [openCodeRawEvents, setOpenCodeRawEvents] = useState<OpenCodeEvent[]>([]);
  const [openCodeHeartbeat, setOpenCodeHeartbeat] = useState<OpenCodeHeartbeat>({
    active: false,
    time: "",
  });
  const [openCodeBusy, setOpenCodeBusy] = useState(false);
  const [agentPhase, setAgentPhase] = useState<AgentPhase>("idle");
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
  const [playerCanvasGeneration, setPlayerCanvasGeneration] = useState(0);
  const [playerAudio, setPlayerAudio] = useState<PlayerAudioState>("unavailable");
  const [playerVolume, setPlayerVolume] = useState(defaultPlayerVolume);
  const [playerScreenEvidence, setPlayerScreenEvidence] =
    useState<PlayerScreenEvidence>("none");
  const [playerInputEvidence, setPlayerInputEvidence] =
    useState<PlayerInputEvidence>("none");
  const [playerAudioEvidence, setPlayerAudioEvidence] =
    useState<PlayerAudioEvidence>("none");
  const [agentRom, setAgentRom] = useState<{ path: string; stamp: number } | undefined>();
  const [agentProviders, setAgentProviders] = useState<string[]>([]);
  const [workspacePath, setWorkspacePath] = useState<string | undefined>();
  const [interactiveCoreReadiness, setInteractiveCoreReadiness] =
    useState<InteractiveCoreReadiness>(() =>
      detectInteractiveCoreReadiness({
        allowDevCdn: allowDevCoreCdnFallback(),
        storage: previewInteractiveCoreStatus,
      }),
    );
  const [inputProofBusy, setInputProofBusy] = useState(false);
  const [actionDetail, setActionDetail] = useState(
    "New starter project ready. Describe what you want to build.",
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
  const [openRouterKey, setOpenRouterKey] = useState(() => loadOpenRouterKey());
  const [showOpenRouterKey, setShowOpenRouterKey] = useState(false);
  const [ollamaEndpoint, setOllamaEndpoint] = useState(
    persisted.ollamaEndpoint ?? defaultOllamaEndpoint,
  );
  const [ollamaModel, setOllamaModel] = useState(persisted.ollamaModel ?? defaultOllamaModel);
  const [ollamaModels, setOllamaModels] = useState<string[]>([ollamaModel]);
  const [ollamaModelsSource, setOllamaModelsSource] = useState("idle");
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
  const [modelConnection, setModelConnection] = useState<ModelConnectionReport>(() =>
    modelProvider === "openrouter" && openRouterKeyWasAccepted(openRouterKey)
      ? { state: "ready", detail: "OpenRouter key accepted" }
      : {
          state: "idle",
          detail: "Not tested",
        },
  );
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const composerInputRef = useRef<HTMLInputElement | null>(null);
  const romViewportRef = useRef<HTMLDivElement | null>(null);
  const playerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const playerRuntimeRef = useRef<NostalgistPlayerRuntime | undefined>();
  const ollamaAutoTestAttemptedRef = useRef(false);
  const romImportInputRef = useRef<HTMLInputElement | null>(null);
  const coreImportInputRef = useRef<HTMLInputElement | null>(null);
  const messageIdRef = useRef(
    messages.reduce((largest, message) => Math.max(largest, message.id), 0) + 1,
  );
  const openCodeEventIdRef = useRef(1);
  const openCodeRawEventIdRef = useRef(1);
  const agentActivityRepairRef = useRef(createAgentActivityRepairState());
  const pendingAgentRunRef = useRef<PendingAgentRun | undefined>();
  const openCodeHeartbeatTimerRef = useRef<number | undefined>();
  const controllerPressedRef = useRef<Set<PlayerInputActionId>>(new Set());
  const comfyUiAutoLaunchAttemptedRef = useRef(false);

  useEffect(() => {
    void refreshPreflight();
    void connectOpenCode();
    void loadRecentProjects();
    void loadInteractiveCoreStatus();
    void recoverPersistedAgentRun()
      .then(() => ensureActiveProject())
      .then((project) => {
        const projectName = loadActiveProjectName(
          project.romExists ? "Active Project" : "Untitled Project",
        );
        setWorkspacePath(project.projectPath);
        setProjectSummary(projectSummaryFromActiveProject(project, projectName));
        setProjectSource(isTauriRuntime() ? "tauri" : "browser-local");
        void loadProjectSummary();
        if (project.romExists) {
          setStarterRom({
            ...previewStarterRom,
            detail: "Active project ROM restored and loading in the player.",
            projectPath: project.projectPath,
            romPath: project.romPath,
          });
          setStarterSource("preview");
          setTransport("paused");
          setAgentRom({ path: project.romPath, stamp: Date.now() });
          appendOpenCodeEvent("project.active.rom.restored", project.romPath);
          noteAction("Restored the active project ROM and loaded it into the player.");
          if (!isTauriRuntime()) {
            // Restoring a project must stay fast and read-only. The 15-second
            // semantic diagnostic runs only after an explicit build/verify,
            // never as a background startup job that can race New Project.
            void auditActiveProjectMemory();
          }
        } else if (project.status === "stale") {
          appendOpenCodeEvent("project.active.stale", project.detail);
        }
      })
      .catch((error) => {
        setProjectSource("error");
        setProjectActionNotice({
          state: "missing",
          label: "Project load failed",
          detail: errorDetail(error, "Could not load the active project"),
        });
      });
  }, []);

  useEffect(() => {
    if (!settingsOpen || modelProvider !== "openrouter") return;
    if (modelsSource !== "fallback") return;

    void refreshOpenRouterModels();
  }, [modelProvider, modelsSource, settingsOpen]);

  useEffect(() => {
    if (!settingsOpen || modelProvider !== "ollama") return;
    if (ollamaModelsSource !== "idle") return;

    void refreshOllamaModels();
  }, [modelProvider, ollamaModelsSource, settingsOpen]);

  useEffect(() => {
    if (modelProvider !== "ollama" || modelConnection.state !== "idle") return;
    if (ollamaAutoTestAttemptedRef.current) return;
    ollamaAutoTestAttemptedRef.current = true;
    void testOllamaConnection();
  }, [modelConnection.state, modelProvider]);

  // The desktop owns local sprite-service startup. Browser preview cannot
  // spawn it, but the Vite bridge can still report whether it is reachable.
  useEffect(() => {
    if (!enhancements.spriteGeneration) {
      comfyUiAutoLaunchAttemptedRef.current = false;
      return;
    }
    if (comfyUiConnection.state !== "idle") return;

    if (isTauriRuntime()) {
      if (comfyUiAutoLaunchAttemptedRef.current) return;
      comfyUiAutoLaunchAttemptedRef.current = true;
      void launchComfyUiConnection();
      return;
    }

    if (comfyUiAutoLaunchAttemptedRef.current) return;
    comfyUiAutoLaunchAttemptedRef.current = true;
    void testComfyUiConnection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enhancements.spriteGeneration, comfyUiConnection.state]);

  // Preflight is a snapshot; re-run it when Settings opens so rows like
  // Docker reflect reality, not app-launch time.
  useEffect(() => {
    if (!settingsOpen) return;
    void refreshPreflight();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsOpen]);

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
      const activity = agentActivityFromEvent(event.data);
      if (activity) {
        const staleDisposition = staleAgentActivityDisposition(activity.sessionId);
        if (staleDisposition === "drop") {
          return;
        }
        if (staleDisposition === "raw") {
          appendOpenCodeRawEvent(
            "agent.ignored.stale",
            `${activity.eventType}: ${activity.sessionId ?? "unknown session"}`,
          );
          return;
        }

        for (const visibleActivity of visibleAgentActivityEvents(
          activity,
          agentActivityRepairRef.current,
        )) {
          const detail = visibleActivity.detail
            ? `${visibleActivity.label}: ${visibleActivity.detail}`
            : visibleActivity.label;
          appendOpenCodeEvent(visibleActivity.eventType, detail);
          applyAgentEvidenceEvent(visibleActivity.eventType);
          noteAction(visibleActivity.label);
          if (visibleActivity.eventType === "agent.finished") {
            void finishPendingAgentRun(visibleActivity.sessionId);
          } else {
            recordPendingAgentMilestone(visibleActivity);
            recordPendingAgentProgress(visibleActivity.sessionId);
          }
        }
        return;
      }
      appendOpenCodeEventFromData(event.data);
    };

    events.onerror = () => {
      clearOpenCodeHeartbeatTimer();
      setOpenCodeHeartbeat((current) => ({ ...current, active: false }));
      appendOpenCodeEvent("sse.waiting", "OpenCode event stream is waiting to reconnect");
    };

    return () => {
      clearOpenCodeHeartbeatTimer();
      events.close();
    };
  }, [openCode.eventUrl, openCode.state]);

  useEffect(() => {
    const element = messagesRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
  }, [messages]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        conversationStorageKey,
        JSON.stringify({
          projectName: projectSummary.name,
          messages: messages.slice(-40),
        }),
      );
    } catch {
      // Keep the current conversation in memory when browser storage is unavailable.
    }
  }, [messages, projectSummary.name]);

  // When the agent finishes a build, capture a preview frame first. Interactive
  // Play is a separate check because missing cores should not leave a black box.
  useEffect(() => {
    if (!agentRom) return;
    setLoadedPlayerRom(undefined);
    void (async () => {
      await launchRom(
        agentRom.path,
        "Agent ROM preview captured. Playability still needs input/audio evidence.",
      );
      void playActiveRom();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentRom?.stamp]);

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

  const activeRomSource = useMemo(
    () => activeRomSourceFor(projectSummary, importResult, v1PromptResult, agentRom?.path),
    [importResult, projectSummary, v1PromptResult, agentRom],
  );
  const romAudioAvailable = useMemo(
    () => projectAudioAvailability(projectSummary.assetRoles, activeRomSource.kind),
    [activeRomSource.kind, projectSummary.assetRoles],
  );
  const activeRomPlayable = useMemo(
    () => canPlayActiveRom(activeRomSource, projectSummary),
    [activeRomSource, projectSummary],
  );
  const playabilityGateState: HealthState =
    projectSummary.trustStage === "reviewed"
      ? "ready"
      : projectSummary.trustStage === "failed"
        ? "missing"
        : "warning";
  const topBarStatus = useMemo(() => {
    if (buildState === "building") {
      return {
        state: "building",
        label: agentPhase === "idle" ? "Working" : agentPhaseLabel(agentPhase),
      };
    }
    if (buildState === "error") return { state: "error", label: "Error" };
    if (projectSummary.trustStage === "failed") {
      return { state: "error", label: "Failed Review" };
    }
    if (playerState === "loading") return { state: "warning", label: "Starting" };
    if (playerState === "playing" || playerState === "paused") {
      return { state: "running", label: playerState === "paused" ? "Paused" : "Running" };
    }
    if (projectSummary.trustStage === "reviewed") {
      return { state: "running", label: "Reviewed" };
    }
    if (projectSummary.trustStage === "playable") {
      return { state: "running", label: "Playable" };
    }
    if (projectSummary.romStatus === "warning") {
      return { state: "error", label: "Build incomplete" };
    }
    if (activeRomPlayable) return { state: "warning", label: "Built" };
    return { state: "warning", label: "Prototype" };
  }, [
    activeRomPlayable,
    agentPhase,
    buildState,
    projectSummary.romStatus,
    projectSummary.trustStage,
    playerState,
  ]);

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
      if (projectActionNotice.label === "Restarting game") {
        return projectActionNotice;
      }
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
        label: openCodeBusy && agentPhase !== "idle" ? agentPhaseLabel(agentPhase) : "Verifying ROM",
        detail: actionDetail,
      };
    }
    if (projectSummary.romStatus === "warning") {
      return {
        state: "missing",
        label: "Build incomplete",
        detail: projectSummary.romDetail,
      };
    }
    if (activeRomPlayable && playabilityGateState === "warning") {
      return {
        state: "warning",
        label:
          projectSummary.trustStage === "playable" ? "Playable; review pending" : "Built; not playable",
        detail: projectSummary.reviewDetail,
      };
    }
    if (activeRomPlayable && playabilityGateState === "missing") {
      return {
        state: "missing",
        label: "Visible review failed",
        detail: projectSummary.reviewDetail,
      };
    }
    return {
      state: "ready",
      label: "Ready",
      detail: actionDetail,
    };
  }, [
    actionDetail,
    activeRomPlayable,
    agentPhase,
    buildState,
    exportBusy,
    importBusy,
    openCodeBusy,
    playabilityGateState,
    playerState,
    projectActionNotice,
    projectSummary.romDetail,
    projectSummary.romStatus,
    projectSummary.reviewDetail,
    projectSummary.trustStage,
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

  const preflightWithInteractivePlay = useMemo(
    () => [interactiveCoreHealthCheck(interactiveCoreReadiness), ...preflight.checks],
    [interactiveCoreReadiness, preflight.checks],
  );
  const firstRunNote = useMemo(() => {
    const docker = preflight.checks.find((check) => check.name.toLowerCase().includes("docker"));
    if (openCodeSource === "checking" || preflightSource === "checking") {
      return "Checking local build tools…";
    }
    if (modelProvider === "ollama") {
      return openCode.state === "ready" &&
        agentProviders.includes("ollama") &&
        modelConnection.state === "ready"
        ? "Local model installed. The first build will verify agent tool calling."
        : "Test an installed Ollama model in Settings before the first build.";
    }
    if (!agentProviders.includes("openrouter") && !openRouterKey.trim()) {
      return "Connect OpenRouter in Settings before the first build.";
    }
    if (openCode.state === "ready" && agentProviders.includes("openrouter")) {
      return "Ready to build locally. AI sprites are optional.";
    }
    if (docker && docker.state !== "ready") {
      return "Docker needs attention before the first ROM build.";
    }
    return "Ready to build locally. AI sprites are optional.";
  }, [
    agentProviders,
    modelProvider,
    modelConnection.state,
    openCode.state,
    openCodeSource,
    openRouterKey,
    preflight.checks,
    preflightSource,
  ]);

  function focusComposer(prompt = "") {
    if (prompt) setDraft(prompt);
    setConversationCollapsed(false);
    window.requestAnimationFrame(() => composerInputRef.current?.focus());
  }
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
      const clarifyingReply = clarifyingReplyForBuildPrompt(trimmed);
      if (clarifyingReply) {
        setMessages((current) => [...current, makeMessage("agent", clarifyingReply, "system")]);
        appendOpenCodeEvent("agent.questions", clarifyingReply);
        noteAction("Waiting for a little more direction before building.");
        setOpenCodeBusy(false);
        return;
      }

      let agentRunPending = false;
      try {
        agentRunPending = await runAgentPrompt(trimmed);
      } finally {
        if (!agentRunPending) {
          setOpenCodeBusy(false);
        }
      }
      return;
    }

    // The local browser preview uses the same OpenCode build agent for
    // ROM-changing requests. Questions and explanations continue through the
    // conversational model so “how did you build this?” is not mistaken for
    // a request to start another game.
    if (looksLikeBuildPrompt(trimmed.toLowerCase())) {
      const clarifyingReply = clarifyingReplyForBuildPrompt(trimmed);
      if (clarifyingReply) {
        setMessages((current) => [...current, makeMessage("agent", clarifyingReply, "system")]);
        appendOpenCodeEvent("agent.questions", clarifyingReply);
        noteAction("Waiting for a little more direction before building.");
        setOpenCodeBusy(false);
        return;
      }

      let agentRunPending = false;
      try {
        agentRunPending = await runAgentPrompt(trimmed);
      } finally {
        if (!agentRunPending) setOpenCodeBusy(false);
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

    const clarifyingReply = clarifyingReplyForBuildPrompt(trimmed);
    if (!shouldRunV1 && clarifyingReply) {
      setMessages((current) => [
        ...current,
        makeMessage("agent", clarifyingReply, "system"),
      ]);
      appendOpenCodeEvent("agent.questions", clarifyingReply);
      noteAction("Waiting for a little more direction before building.");
      setOpenCodeBusy(false);
      return;
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
        const replyMessages = openRouterFreeformMessages(
          messages,
          trimmed,
          [
            `Project: ${projectSummary.name}`,
            `Build state: ${buildState}`,
            `Agent phase: ${agentPhase}`,
            `Build agent: ${openCode.state} - ${openCode.detail}`,
            `Visible result: ${actionDetail}`,
            `ROM: ${projectSummary.romStatus} - ${projectSummary.romDetail}`,
            `Authoritative asset manifest: ${projectAssetSummary(
              projectSummary.assetRoles,
              activeRomSource.kind,
            )}`,
            `Authoritative audio manifest: ${
              projectAudioAvailability(projectSummary.assetRoles, activeRomSource.kind) === false
                ? "no audio is included in this ROM"
                : "audio presence is not yet proven"
            }`,
            `Screen evidence: ${playerScreenEvidence}`,
            `Input evidence: ${playerInputEvidence}`,
            `Audio evidence: ${playerAudioEvidence}`,
            `Recent activity: ${openCodeEvents
              .slice(-5)
              .map((event) => `${event.type}: ${event.detail}`)
              .join(" | ")}`,
          ].join("\n"),
        );
        const reply =
          modelProvider === "ollama"
            ? await sendOllamaFreeformReply({
                endpoint: ollamaEndpoint,
                model: ollamaModel,
                messages: replyMessages,
              })
            : await sendOpenRouterFreeformReply({
                apiKey: openRouterKey,
                model: activeModel,
                messages: replyMessages,
              });
        const guardedReply = guardUnverifiedModelReply(reply.content);
        const agentMessage = makeMessage(
          "agent",
          guardedReply,
          "model",
        );
        setMessages((current) => [...current, agentMessage]);
        if (guardedReply !== reply.content) {
          appendOpenCodeEvent(
            "message.model.guarded",
            "Freeform reply included unverified ROM/audio success claims.",
          );
        }
        appendOpenCodeEvent(
          "message.model",
          `${
            modelProvider === "ollama"
              ? `Ollama ${shortOllamaLabel(reply.model)}`
              : shortModelLabel(reply.model)
          } replied${
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
      const detail = error instanceof Error ? error.message : "Model reply failed";
      const agentMessage = makeMessage(
        "agent",
        shouldRunV1
          ? `The ROM build could not finish. ${detail}`
          : `${modelReplyFailureMessage(modelProvider, detail)} ROM-changing prompts still use the verified local build path.`,
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

  async function recoverPersistedAgentRun() {
    const persistedRun = loadPersistedPendingAgentRun();
    if (!persistedRun) return;

    try {
      const stopped = await abortAgentSession(persistedRun.sessionId);
      if (!stopped) throw new Error("The build agent did not confirm cancellation");
      clearPersistedPendingAgentRun();
      setOpenCodeSessionId(undefined);
      appendOpenCodeEvent(
        "agent.recovered.reload",
        `${persistedRun.sessionId}; project preserved as ${persistedRun.projectName}`,
      );
      setProjectActionNotice({
        state: "warning",
        label: "Previous build stopped",
        detail: "Drive16 preserved the project and stopped the agent run left active by a reload.",
      });
    } catch (error) {
      const detail = errorDetail(error, "Could not stop the build left active by a reload");
      appendOpenCodeEvent("agent.recovery.abort.failed", detail);
      setProjectActionNotice({
        state: "missing",
        label: "Previous build still active",
        detail,
      });
    }
  }

  async function cancelPendingAgentRun(eventType: string) {
    const pending = pendingAgentRunRef.current;
    if (!pending) return true;

    clearPendingAgentRunTimers(pending);
    try {
      const stopped = await abortAgentSession(pending.sessionId);
      if (!stopped) return false;
      if (pendingAgentRunRef.current?.sessionId === pending.sessionId) {
        pendingAgentRunRef.current = undefined;
      }
      clearPersistedPendingAgentRun();
      appendOpenCodeEvent(eventType, pending.sessionId);
      return true;
    } catch (error) {
      appendOpenCodeEvent(
        "agent.abort.failed",
        errorDetail(error, "Could not stop the active build agent"),
      );
      return false;
    }
  }

  async function runAgentPrompt(trimmed: string): Promise<boolean> {
    const startedAt = Date.now();
    const previousSession = openCodeSessionId;
    // ROM-changing work has one explicit route. Ollama remains available for
    // questions and diagnostics, but it can never edit, seed, build, or repair
    // a project.
    const agentProviderId: ModelProvider = "openrouter";
    const agentModelId = defaultOpenRouterModel;
    // A real project only gets replaced on an explicit new-game request;
    // ambiguous prompts default to preserving it. Repair budget is reserved
    // for prompts about something being broken.
    const intent = classifyAgentIntent(trimmed, {
      projectHasGame:
        projectSummary.romStatus === "ready" || projectSummary.trustStage !== "prototype",
      currentGameHint: `${projectSummary.name} ${projectSummary.reviewDetail}`,
    });
    const followUp = intent.preserveProject;
    const agentName = intent.agentName;
    const clarifyingReply = clarifyingReplyForBuildPrompt(trimmed);
    if (clarifyingReply) {
      setMessages((current) => [
        ...current,
        makeMessage("agent", clarifyingReply, "system"),
      ]);
      appendOpenCodeEvent("agent.questions", clarifyingReply);
      noteAction("Waiting for a little more direction before building.");
      setBuildState("running");
      return false;
    }

    // Reconnect on demand: startup connection may have raced the server
    // boot, and the server restarts when a key is saved.
    let bridge = openCode;
    let providers = agentProviders;
    if (bridge.state !== "ready" || !providers.includes(agentProviderId)) {
      appendOpenCodeEvent("agent.reconnect", bridge.detail);
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
      setAgentPhase("failed");
      setBuildState("error");
      return false;
    }

    const savedOpenRouterKey = openRouterKey.trim();
    if (savedOpenRouterKey) {
      try {
        const auth = await setAgentProviderKey(agentProviderId, savedOpenRouterKey);
        if (!auth.connected) {
          throw new Error(auth.detail);
        }
        if (!providers.includes(agentProviderId)) {
          providers = [...providers, agentProviderId];
        }
      } catch (error) {
        const detail = errorDetail(error, "Could not sync the saved OpenRouter key");
        setMessages((current) => [
          ...current,
          makeMessage(
            "agent",
            `Drive16 could not authorize the build agent with the saved OpenRouter key: ${detail}`,
            "system",
          ),
        ]);
        setProjectActionNotice({
          state: "missing",
          label: "OpenRouter authorization failed",
          detail,
        });
        setAgentPhase("failed");
        setBuildState("error");
        return false;
      }
    }

    if (!providers.includes(agentProviderId)) {
      const setupDetail =
        "Builds use DeepSeek V3.1 through OpenRouter. Open Settings, paste your OpenRouter API key, and click Test OpenRouter — Ollama is available for questions only.";
      setMessages((current) => [
        ...current,
        makeMessage("agent", setupDetail, "system"),
      ]);
      return false;
    }

    if (pendingAgentRunRef.current) {
      const replaced = await cancelPendingAgentRun("agent.replaced");
      if (!replaced) {
        setMessages((current) => [
          ...current,
          makeMessage(
            "agent",
            "I could not confirm that the previous build stopped, so I did not start another one. Try again after the build agent reconnects.",
            "system",
          ),
        ]);
        setAgentPhase("failed");
        setBuildState("error");
        return false;
      }
    }

    setBuildState("building");
    setAgentPhase("planning");
    setPlayerScreenEvidence("none");
    setPlayerInputEvidence("none");
    setPlayerAudioEvidence("none");
    setLastInputAction("No local input yet");
    agentActivityRepairRef.current = createAgentActivityRepairState();
    const visiblePlan = defaultPlanForBuildPrompt(trimmed, enhancements);
    noteAction("The agent is working on your request.");
    if (visiblePlan) {
      setMessages((current) => [...current, makeMessage("agent", visiblePlan, "system")]);
      appendOpenCodeEvent("agent.plan", visiblePlan);
    } else {
      appendOpenCodeEvent(
        "agent.plan",
        "Reading project notes, editing the active project, building the ROM, then checking screen/input/audio evidence.",
      );
    }
    appendOpenCodeEvent(
      "agent.started",
      `session: new; model: ${providerDisplayLabel(agentProviderId, activeModel, agentModelId)}`,
    );
    const waitNotice = window.setTimeout(() => {
      appendOpenCodeEvent(
        "agent.waiting",
        `Still waiting after ${formatDurationMs(Date.now() - startedAt)}; check the activity feed for tool progress.`,
      );
    }, 20_000);
    try {
      const project = followUp ? await ensureActiveProject() : await resetActiveProject();
      let baselineRomExists = project.romExists;
      let seededPrototypeBuilt = false;
      const projectName = followUp
        ? projectSummary.name || loadActiveProjectName("Untitled Project")
        : projectNameFromPrompt(trimmed);
      saveActiveProjectName(projectName);
      setWorkspacePath(project.projectPath);
      setProjectSummary(projectSummaryFromActiveProject(project, projectName));
      setProjectSource(isTauriRuntime() ? "tauri" : "browser-local");
      const agentProjectPath = project.agentProjectPath || project.projectPath;
      appendOpenCodeEvent("agent.workspace", agentProjectPath);
      try {
        const seed = await seedActiveProjectForPrompt(trimmed);
        if (seed.applied) {
          appendOpenCodeEvent("agent.seeded", seed.source || seed.detail);
          noteAction("Loaded simple starter code before the agent began building.");
          setProjectSummary((current) => ({
            ...current,
            romStatus: "missing",
            romDetail: "Starter code seeded; no ROM built yet",
          }));
          try {
            const baseline = await buildActiveProject();
            baselineRomExists = baseline.romExists;
            if (baseline.romExists) {
              setWorkspacePath(baseline.projectPath);
              seededPrototypeBuilt = true;
              setProjectSummary(projectSummaryFromActiveProject(baseline, projectName));
              setProjectSource(isTauriRuntime() ? "tauri" : "browser-local");
              resetActiveRomSession();
              setAgentRom({ path: baseline.romPath, stamp: Date.now() });
              setPlayerScreenEvidence("checking");
              setPlayerInputEvidence("none");
              setPlayerAudioEvidence("checking");
              setProjectActionNotice({
                state: "warning",
                label: "Prototype built",
                detail: "The seeded scaffold is available for diagnostics, but it is not Playable or Reviewed.",
              });
              appendOpenCodeEvent("agent.seed.built", baseline.romPath);
              noteAction("Prototype ROM built and loaded for diagnostics.");
              void loadProjectSummary();
              if (!isTauriRuntime()) {
                try {
                  const evidence = await verifyBrowserProject();
                  applyBrowserProjectEvidence(evidence);
                  void loadProjectSummary();
                  void auditActiveProjectMemory();
                } catch (error) {
                  setPlayerScreenEvidence("unverified");
                  setPlayerInputEvidence("failed");
                  setPlayerAudioEvidence("failed");
                  appendOpenCodeEvent(
                    "baseline.verify.failed",
                    errorDetail(error, "Browser-local verification failed"),
                  );
                }
              }
            }
          } catch (error) {
            appendOpenCodeEvent(
              "agent.seed.build_failed",
              errorDetail(error, "The seeded starter did not build; the agent will attempt a repair"),
            );
          }
        }
      } catch (error) {
        appendOpenCodeEvent(
          "agent.seed.failed",
          errorDetail(error, "Starter seed failed; continuing with the blank project"),
        );
      }
      const result = await sendAgentPrompt({
        // OpenCode session reuse currently makes later turns repeat the first
        // instruction. Keep continuity in the project workspace instead.
        sessionId: undefined,
        text: agentPromptWithProject(agentProjectPath, trimmed, {
          spriteGeneration: enhancements.spriteGeneration,
          musicGeneration: enhancements.musicGeneration,
          seededPrototypeBuilt,
          repairMode: agentName === "drive16-repair",
          comfyUiEndpoint,
          comfyUiCheckpoint,
          comfyUiLora,
          comfyUiState: comfyUiConnection.state,
          comfyUiDetail: comfyUiConnection.detail,
        }),
        providerId: agentProviderId,
        modelId: agentModelId,
        agentName,
        background: true,
        comfyUiEndpoint,
        comfyUiCheckpoint,
        comfyUiLora,
      });
      setOpenCodeSessionId(result.sessionId);
      startPendingAgentRun(
        result.sessionId,
        startedAt,
        previousSession,
        projectName,
        baselineRomExists,
        enhancements.spriteGeneration,
        agentRunHardLimitMs,
        agentProviderId,
        agentModelId,
      );
      appendOpenCodeEvent(
        "agent.accepted",
        `session: ${result.sessionId}; previous: ${previousSession ?? "none"}`,
      );
      noteAction("The agent accepted the request. Watching the live build log.");
      return true;
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
      appendOpenCodeEvent(
        "agent.failed",
        `${detail}; after ${formatDurationMs(Date.now() - startedAt)}`,
      );
      setAgentPhase("failed");
      setBuildState("error");
      return false;
    } finally {
      window.clearTimeout(waitNotice);
    }
  }

  function startPendingAgentRun(
    sessionId: string,
    startedAt: number,
    previousSession: string | undefined,
    projectName: string,
    baselineRomExists: boolean,
    requiresAiSprites: boolean,
    hardLimitMs = agentRunHardLimitMs,
    providerId?: ModelProvider,
    modelId?: string,
  ) {
    clearPendingAgentRunTimers(pendingAgentRunRef.current);
    const pending: PendingAgentRun = {
      sessionId,
      startedAt,
      previousSession,
      projectName,
      baselineRomExists,
      requiresAiSprites,
      hardLimitMs,
      providerId,
      modelId,
    };
    pending.waitingTimer = window.setTimeout(() => {
      appendOpenCodeEvent(
        "agent.no_progress",
        `No build activity yet after ${formatDurationMs(Date.now() - startedAt)}.`,
      );
      noteAction("The agent request was accepted, but no build activity has started yet.");
    }, 45_000);
    pending.stallTimer = window.setTimeout(() => {
      void failPendingAgentRun(
        sessionId,
        pendingAgentStallDetail(pending),
      );
    }, 90_000);
    pending.hardStopTimer = window.setTimeout(() => {
      void failPendingAgentRun(
        sessionId,
        `Drive16 stopped the build after ${formatDurationMs(hardLimitMs)} to prevent a runaway model loop.`,
      );
    }, hardLimitMs);
    pending.backgroundErrorTimer = window.setInterval(() => {
      void drainOpenCodeBackgroundErrors(sessionId);
    }, 3_000);
    pending.projectRefreshTimer = window.setInterval(() => {
      void reconcilePendingAgentRom(sessionId);
    }, 1_500);
    pendingAgentRunRef.current = pending;
    persistPendingAgentRun({ sessionId, startedAt, projectName });
  }

  async function reconcilePendingAgentRom(sessionId: string) {
    const pending = pendingAgentRunRef.current;
    if (!pending || pending.sessionId !== sessionId || pending.adoptedFreshRom) return;

    try {
      const project = await ensureActiveProject();
      const canBeFresh = pendingAgentProducedFreshRom(pending);
      if (!project.romExists || !canBeFresh) return;
      adoptFreshAgentRom(project, pending, "ROM built and loaded while checks continue.");
    } catch (error) {
      appendOpenCodeRawEvent(
        "agent.rom.reconcile.failed",
        errorDetail(error, "Could not refresh the active ROM state"),
      );
    }
  }

  function adoptFreshAgentRom(
    project: ActiveProject,
    pending: PendingAgentRun,
    detail: string,
  ) {
    if (pending.adoptedFreshRom) return;
    pending.adoptedFreshRom = true;
    saveActiveProjectName(pending.projectName);
    setWorkspacePath(project.projectPath);
    setProjectSummary(projectSummaryFromActiveProject(project, pending.projectName));
    setProjectSource(isTauriRuntime() ? "tauri" : "browser-local");
    resetActiveRomSession();
    setAgentRom({ path: project.romPath, stamp: Date.now() });
    setPlayerScreenEvidence("checking");
    setProjectActionNotice({
      state: "warning",
      label: "ROM built, checking",
      detail,
    });
    appendOpenCodeEvent("agent.rom.adopted", project.romPath);
    noteAction("ROM built and loaded. Remaining checks are still running.");
  }

  async function drainOpenCodeBackgroundErrors(sessionId: string) {
    const pending = pendingAgentRunRef.current;
    if (!pending || pending.sessionId !== sessionId || !isTauriRuntime()) return;

    try {
      const errors = await invoke<OpenCodeBackgroundError[]>("drain_opencode_background_errors");
      const latest = errors[errors.length - 1];
      if (!latest) return;
      await failPendingAgentRun(
        sessionId,
        `OpenCode stopped the background request: ${latest.detail}`,
      );
    } catch (error) {
      appendOpenCodeEvent(
        "agent.background_error_check.failed",
        errorDetail(error, "Could not read background agent errors"),
      );
    }
  }

  function recordPendingAgentProgress(sessionId: string | undefined) {
    const pending = pendingAgentRunRef.current;
    if (!pending) return;
    if (sessionId && pending.sessionId !== sessionId) return;

    if (pending.waitingTimer) {
      window.clearTimeout(pending.waitingTimer);
      pending.waitingTimer = undefined;
    }
    if (pending.stallTimer) {
      window.clearTimeout(pending.stallTimer);
    }
    pending.stallTimer = window.setTimeout(() => {
      void failPendingAgentRun(
        pending.sessionId,
        pendingAgentStallDetail(pending),
      );
    }, 90_000);
  }

  function recordPendingAgentMilestone(activity: {
    eventType: string;
    detail: string;
    sessionId?: string;
  }) {
    const pending = pendingAgentRunRef.current;
    if (!pending) return;
    if (activity.sessionId && pending.sessionId !== activity.sessionId) return;

    if (
      activity.eventType === "agent.files.edited" &&
      sourceOrResourcePathWasEdited(activity.detail)
    ) {
      pending.sawSourceOrResourceEdit = true;
    }
    if (
      activity.eventType === "agent.build.started" ||
      activity.eventType === "agent.build.retrying" ||
      activity.eventType === "agent.build.fixing"
    ) {
      pending.sawBuildStarted = true;
    }
    if (
      activity.eventType === "agent.build.finished" ||
      activity.eventType === "agent.build.fixed"
    ) {
      pending.sawBuildStarted = true;
      pending.sawBuildFinished = true;
    }
    if (activity.eventType === "agent.build.failed") {
      pending.sawBuildStarted = true;
      pending.sawBuildFailed = true;
    }
    if (activity.eventType === "agent.screenshot.checked") {
      pending.sawScreenCheck = true;
    }
    if (activity.eventType === "agent.input.tested") {
      pending.sawInputTest = true;
    }
    if (activity.eventType === "agent.assets.music.started") {
      pending.musicCompileAttempts = (pending.musicCompileAttempts ?? 0) + 1;
      if (pending.musicCompileAttempts > 2) {
        void failPendingAgentRun(
          pending.sessionId,
          "Drive16 stopped the build because the agent exceeded the two-attempt music compile limit.",
        );
        return;
      }
    }
    if (
      activity.eventType === "agent.audio.checked" ||
      activity.eventType === "agent.audio.failed"
    ) {
      pending.sawAudioCheck = true;
    }
    if (activity.eventType === "agent.assets.sprite.finished") {
      pending.sawAiSpriteFinished = true;
    }
    if (
      activity.eventType === "agent.assets.sprite.failed" ||
      activity.eventType === "agent.assets.sprite.invalid"
    ) {
      pending.sawAiSpriteFailed = true;
    }
  }

  function pendingAgentStallDetail(pending: PendingAgentRun) {
    if (pending.sawSourceOrResourceEdit && !pending.sawBuildStarted) {
      return "The agent edited game source/resources but did not rebuild the ROM afterward.";
    }
    if (pending.sawBuildFailed && !pending.sawBuildFinished) {
      return "The agent hit a build failure and did not complete the repair/rebuild loop.";
    }
    if (pending.sawBuildStarted && !pending.sawBuildFinished) {
      return "The agent started a ROM build but did not finish it.";
    }
    if (pending.sawBuildFinished && !pending.sawScreenCheck) {
      return "The agent built a ROM but did not capture a screen check afterward.";
    }
    if (pending.sawScreenCheck && !pending.sawInputTest) {
      return "The agent checked the screen but did not run an input test afterward.";
    }
    if (pending.sawInputTest && !pending.sawAudioCheck) {
      return "The agent tested input but did not verify audio or record why audio was skipped.";
    }
    return "The agent request was accepted, but OpenCode did not start or continue build activity.";
  }

  function sourceOrResourcePathWasEdited(detail: string) {
    return /(?:^|[/:])(src|res)\/.+\.(c|h|s|res|png|vgm|wav|bin)\b/i.test(detail);
  }

  function pendingAgentProducedFreshRom(pending: PendingAgentRun) {
    // A model result is new only when it changed game inputs and completed the
    // build afterward. Either event alone can still point at the seeded or
    // previously built ROM.
    return Boolean(pending.sawSourceOrResourceEdit && pending.sawBuildFinished);
  }

  async function buildEditedProjectIfNeeded(
    project: ActiveProject,
    pending: PendingAgentRun,
  ): Promise<ActiveProject> {
    if (
      project.status !== "stale" ||
      !pending.sawSourceOrResourceEdit ||
      pending.sawBuildFinished
    ) {
      return project;
    }

    setAgentPhase("building");
    pending.sawBuildStarted = true;
    appendOpenCodeEvent(
      "agent.autobuild.started",
      "Source/resources changed without a final ROM build; Drive16 is building deterministically.",
    );
    try {
      const built = await buildActiveProject();
      pending.sawBuildFinished = built.romExists;
      appendOpenCodeEvent(
        "agent.autobuild.finished",
        built.romPath,
      );
      return built;
    } catch (error) {
      pending.sawBuildFailed = true;
      appendOpenCodeEvent(
        "agent.autobuild.failed",
        errorDetail(error, "Drive16 could not build the edited project"),
      );
      return project;
    }
  }

  async function failPendingAgentRun(sessionId: string, detail: string) {
    const pending = pendingAgentRunRef.current;
    if (!pending || pending.sessionId !== sessionId) return;

    clearPendingAgentRunTimers(pending);
    pendingAgentRunRef.current = undefined;
    clearPersistedPendingAgentRun();
    setOpenCodeBusy(false);
    setAgentPhase("failed");

    try {
      await abortAgentSession(sessionId);
      appendOpenCodeEvent("agent.aborted", sessionId);
    } catch (error) {
      appendOpenCodeEvent(
        "agent.abort.failed",
        errorDetail(error, "Could not stop the stalled OpenCode session"),
      );
    }

    try {
      let after = await ensureActiveProject();
      after = await buildEditedProjectIfNeeded(after, pending);
      saveActiveProjectName(pending.projectName);
      setWorkspacePath(after.projectPath);
      setProjectSummary(projectSummaryFromActiveProject(after, pending.projectName));
      setProjectSource(isTauriRuntime() ? "tauri" : "browser-local");
      if (after.romExists) {
        const producedFreshRom = pendingAgentProducedFreshRom(pending);
        if (!producedFreshRom) {
          if (pending.providerId === "ollama") {
            setModelConnection({
              state: "warning",
              detail: `${shortOllamaLabel(
                pending.modelId ?? "selected model",
              )} can answer local chat, but it did not start Drive16 build tools in this run`,
              model: pending.modelId,
            });
          }
          void loadProjectSummary();
          setMessages((current) => [
            ...current,
            makeMessage(
              "agent",
              `${detail} The agent made no game-source or build progress, so the previous ROM remains available as an unchanged preview.`,
              "system",
            ),
          ]);
          setProjectActionNotice({
            state: "missing",
            label: "No fresh ROM produced",
            detail: "The previous ROM is still playable, but this agent run made no game changes.",
          });
          appendOpenCodeEvent(
            "agent.stalled.no_changes",
            `${after.romPath}; after ${formatDurationMs(Date.now() - pending.startedAt)}`,
          );
          noteAction("The agent stopped without changing the game; the previous ROM was preserved.");
          setBuildState("error");
          return;
        }

        adoptFreshAgentRom(after, pending, "Fresh ROM recovered after the agent stopped.");
        void loadProjectSummary();
        setPlayerScreenEvidence("checking");
        setPlayerInputEvidence("none");
        setPlayerAudioEvidence("checking");
        setMessages((current) => [
          ...current,
          makeMessage(
            "agent",
            `${detail} I stopped the runaway session and recovered its latest built ROM. Verification may still be incomplete.`,
            "system",
          ),
        ]);
        setProjectActionNotice({
          state: "warning",
          label: "ROM recovered",
          detail: "The build produced a ROM before the agent stopped; remaining checks are incomplete.",
        });
        appendOpenCodeEvent(
          "agent.stalled.rom_recovered",
          `${after.romPath}; after ${formatDurationMs(Date.now() - pending.startedAt)}`,
        );
        noteAction("Recovered the latest ROM after stopping a stalled agent run.");
        setBuildState("running");
        return;
      }
    } catch (error) {
      appendOpenCodeEvent(
        "agent.recovery.failed",
        errorDetail(error, "Could not inspect the active project after the agent stopped"),
      );
    }

    setMessages((current) => [
      ...current,
      makeMessage(
        "agent",
        `${detail} No current ROM was produced. Try again after checking the build log.`,
        "system",
      ),
    ]);
    setProjectActionNotice({
      state: "missing",
      label: "Agent stopped",
      detail,
    });
    appendOpenCodeEvent(
      "agent.stalled",
      `${detail}; after ${formatDurationMs(Date.now() - pending.startedAt)}`,
    );
    noteAction("The agent stopped without producing a current ROM.");
    setBuildState("error");
  }

  function clearPendingAgentRunTimers(pending: PendingAgentRun | undefined) {
    if (!pending) return;
    if (pending.waitingTimer) {
      window.clearTimeout(pending.waitingTimer);
    }
    if (pending.stallTimer) {
      window.clearTimeout(pending.stallTimer);
    }
    if (pending.backgroundErrorTimer) {
      window.clearInterval(pending.backgroundErrorTimer);
    }
    if (pending.projectRefreshTimer) {
      window.clearInterval(pending.projectRefreshTimer);
    }
    if (pending.hardStopTimer) {
      window.clearTimeout(pending.hardStopTimer);
    }
  }

  function staleAgentActivityDisposition(
    sessionId: string | undefined,
  ): "accept" | "raw" | "drop" {
    const pending = pendingAgentRunRef.current;
    if (!sessionId) {
      // While a build is pending, only session-scoped OpenCode activity can
      // advance or finish it. Unscoped events remain available in the raw log.
      return pending ? "raw" : "accept";
    }

    if (!pending) {
      // Session-scoped activity after a reset or finished build belongs to old
      // OpenCode state. Do not let it leak into the current project surface.
      return "drop";
    }

    return pending.sessionId === sessionId ? "accept" : "raw";
  }

  async function finishPendingAgentRun(sessionId?: string) {
    const pending = pendingAgentRunRef.current;
    if (!pending) return;
    if (sessionId && pending.sessionId !== sessionId) return;

    clearPendingAgentRunTimers(pending);
    pendingAgentRunRef.current = undefined;
    clearPersistedPendingAgentRun();
    try {
      let after = await ensureActiveProject();
      after = await buildEditedProjectIfNeeded(after, pending);
      saveActiveProjectName(pending.projectName);
      setWorkspacePath(after.projectPath);
      setProjectSummary(projectSummaryFromActiveProject(after, pending.projectName));
      setProjectSource(isTauriRuntime() ? "tauri" : "browser-local");

      if (after.romExists) {
        const producedFreshRom = pendingAgentProducedFreshRom(pending);
        if (!producedFreshRom) {
          void loadProjectSummary();
          setMessages((current) => [
            ...current,
            makeMessage(
              "agent",
              "The agent stopped without editing or rebuilding the project. The seeded ROM is still available as an unchanged prototype.",
              "system",
            ),
          ]);
          setProjectActionNotice({
            state: "missing",
            label: "No fresh ROM produced",
            detail: "The agent run made no source or build progress; Drive16 kept the unchanged prototype.",
          });
          appendOpenCodeEvent(
            "agent.finished.no_changes",
            `${after.romPath}; after ${formatDurationMs(Date.now() - pending.startedAt)}`,
          );
          noteAction("The agent stopped without changing the game; the prototype was preserved.");
          setBuildState("error");
          return;
        }
        adoptFreshAgentRom(after, pending, "ROM built; final project checks are running.");
        void loadProjectSummary();
        setPlayerScreenEvidence("checking");
        setPlayerInputEvidence("none");
        setPlayerAudioEvidence((current) =>
          current === "captured" || current === "failed" ? current : "checking",
        );
        setMessages((current) => [
          ...current,
          makeMessage(
            "agent",
            "The agent produced a ROM file. I’m loading it now, but it is not marked playable until Drive16 has screen, input, and audio evidence.",
            "opencode",
          ),
        ]);
        setProjectActionNotice({
          state: "warning",
          label: "ROM built, checking",
          detail: "Loading the player before marking the game playable.",
        });
        noteAction("ROM file built. Loading the player for verification.");
        appendOpenCodeEvent(
          "agent.rom.built",
          `${after.romPath}; ${formatDurationMs(Date.now() - pending.startedAt)}`,
        );
        const memoryAudit = await auditActiveProjectMemory();
        if (pending.requiresAiSprites && !pending.sawAiSpriteFinished) {
          const detail = pending.sawAiSpriteFailed
            ? "ComfyUI sprite generation failed; the playable ROM remains a primitive-art fallback."
            : "AI sprites were enabled, but the agent never generated and wired them into this ROM.";
          setProjectActionNotice({
            state: "missing",
            label: "AI sprites not completed",
            detail,
          });
          appendOpenCodeEvent("agent.assets.sprite.missing", detail);
          noteAction(detail);
        } else {
          surfaceAgentCompletionAudit(memoryAudit);
        }
        setBuildState("running");
      } else {
        const stale = after.status === "stale";
        const detail = `${after.detail}: ${after.romPath}`;
        setMessages((current) => [
          ...current,
          makeMessage(
            "agent",
            stale
              ? `The agent changed the project, but it did not produce a fresh ROM. ${after.detail}.`
              : `The agent stopped before producing a ROM. ${after.detail}.`,
            "system",
          ),
        ]);
        setProjectActionNotice({
          state: stale ? "warning" : "missing",
          label: stale ? "Build did not finish" : "ROM missing",
          detail,
        });
        noteAction(stale ? "The source changed, but the ROM was not rebuilt." : "No ROM was built.");
        appendOpenCodeEvent(stale ? "agent.rom.stale" : "agent.rom.missing", detail);
        setBuildState("error");
      }
    } catch (error) {
      const detail = errorDetail(error, "Could not refresh the active project after the agent finished");
      setMessages((current) => [
        ...current,
        makeMessage("agent", `The agent finished, but I could not refresh the ROM: ${detail}`, "system"),
      ]);
      setProjectActionNotice({
        state: "missing",
        label: "Project refresh failed",
        detail,
      });
      appendOpenCodeEvent("agent.refresh.failed", detail);
      setBuildState("error");
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
      time: formatMessageTime(),
    };
  }

  function appendOpenCodeEvent(type: string, detail: string) {
    appendOpenCodeRawEvent(type, detail);

    if (isHeartbeatEvent(type, detail)) {
      markOpenCodeHeartbeat();
      return;
    }

    if (
      detail === "OpenCode event received" &&
      (type === "event" || type.toLowerCase().includes("connected"))
    ) {
      return;
    }

    applyAgentPhaseEvent(type);

    const id = openCodeEventIdRef.current;
    openCodeEventIdRef.current += 1;
    setOpenCodeEvents((current) => {
      const recentDuplicate = current
        .slice(-8)
        .some((event) => event.type === type && event.detail === detail);
      if (recentDuplicate) {
        return current;
      }

      return [
        ...current,
        {
          id,
          type,
          detail,
          time: formatLogTime(),
        },
      ].slice(-60);
    });
  }

  function appendOpenCodeRawEvent(type: string, detail: string) {
    const id = openCodeRawEventIdRef.current;
    openCodeRawEventIdRef.current += 1;
    setOpenCodeRawEvents((current) =>
      [
        ...current,
        {
          id,
          type,
          detail,
          time: formatLogTime(),
        },
      ].slice(-200),
    );
  }

  function applyAgentEvidenceEvent(eventType: string) {
    if (
      eventType === "agent.screenshot.checking" ||
      eventType === "agent.screenshot.capturing"
    ) {
      setPlayerScreenEvidence("checking");
      return;
    }
    if (eventType === "agent.screenshot.captured") {
      setPlayerScreenEvidence("captured");
      return;
    }
    if (eventType === "agent.screenshot.checked") {
      setPlayerScreenEvidence((current) => (current === "visible" ? "visible" : "captured"));
      return;
    }
    if (eventType === "agent.screenshot.failed") {
      setPlayerScreenEvidence("unverified");
      return;
    }
    if (eventType === "agent.input.testing") {
      setPlayerInputEvidence("testing");
      return;
    }
    if (eventType === "agent.input.tested") {
      setPlayerInputEvidence("tested");
      return;
    }
    if (eventType === "agent.input.failed") {
      setPlayerInputEvidence("failed");
      return;
    }
    if (eventType === "agent.audio.checking") {
      setPlayerAudioEvidence("checking");
      return;
    }
    if (eventType === "agent.audio.checked") {
      setPlayerAudioEvidence("captured");
      return;
    }
    if (eventType === "agent.audio.failed") {
      setPlayerAudioEvidence("failed");
    }
  }

  async function auditActiveProjectMemory() {
    try {
      const audit = isTauriRuntime()
        ? await invoke<ProjectMemoryAuditResult>("audit_active_project_memory")
        : await fetch("/__drive16_project/audit").then(async (response) => {
            if (!response.ok) {
              throw new Error(`Project audit failed with HTTP ${response.status}`);
            }
            return response.json() as Promise<ProjectMemoryAuditResult>;
          });
      const eventType =
        audit.status === "ready"
          ? "project.memory.ready"
          : audit.status === "missing"
            ? "project.memory.missing"
            : "project.memory.warning";
      appendOpenCodeEvent(eventType, `${audit.gate.toUpperCase()}: ${audit.detail}`);
      return audit;
    } catch (error) {
      appendOpenCodeEvent(
        "project.memory.failed",
        errorDetail(error, "Project memory audit failed"),
      );
      return undefined;
    }
  }

  function surfaceAgentCompletionAudit(
    audit: ProjectMemoryAuditResult | undefined,
    previewResult?: RomPreviewLoadResult,
  ) {
    if (previewResult && !previewResult.ok) {
      const detail = `ROM preview failed: ${previewResult.detail}`;
      setMessages((current) => [
        ...current,
        makeMessage(
          "agent",
          `The ROM exists, but I’m not marking this game done. ${detail}`,
          "system",
        ),
      ]);
      setProjectActionNotice({
        state: "missing",
        label: "Preview failed",
        detail,
      });
      appendOpenCodeEvent("agent.verification.failed", detail);
      return;
    }

    if (!audit) {
      const detail =
        "Drive16 could not read GAME.md, ASSETS.md, and PLAYTEST.md after the ROM build.";
      setMessages((current) => [
        ...current,
        makeMessage(
          "agent",
          `${detail} Treat the generated game as needing repair until the project-memory audit runs.`,
          "system",
        ),
      ]);
      setProjectActionNotice({
        state: "warning",
        label: "Playability unverified",
        detail,
      });
      appendOpenCodeEvent("agent.verification.failed", detail);
      return;
    }

    if (audit.status === "ready" && audit.gate === "pass") {
      const detail =
        "The builder wrote Playability gate: PASS, but builder-authored project memory cannot award Playable or Reviewed. The ROM remains Built until independent semantic and human review.";
      setMessages((current) => [...current, makeMessage("agent", detail, "opencode")]);
      setProjectActionNotice({
        state: "warning",
        label: "Review still required",
        detail,
      });
      appendOpenCodeEvent("agent.verification.claim_rejected", audit.detail);
      return;
    }

    const gateLabel =
      audit.gate === "fail"
        ? "Playability gate: FAIL"
        : audit.gate === "unknown"
          ? "Playability gate missing"
          : `Playability gate: ${audit.gate.toUpperCase()}`;
    const detail = `${gateLabel}. ${audit.detail}`;
    setMessages((current) => [
      ...current,
      makeMessage(
        "agent",
        `The ROM exists, but I’m not marking this game done. ${detail}`,
        "system",
      ),
    ]);
    setProjectActionNotice({
      state: audit.status === "missing" ? "missing" : "warning",
      label: audit.gate === "fail" ? "Game needs repair" : "Playability unverified",
      detail,
    });
    appendOpenCodeEvent("agent.verification.failed", detail);
  }

  function markOpenCodeHeartbeat() {
    clearOpenCodeHeartbeatTimer();
    setOpenCodeHeartbeat({ active: true, time: formatLogTime() });
    openCodeHeartbeatTimerRef.current = window.setTimeout(() => {
      setOpenCodeHeartbeat((current) => ({ ...current, active: false }));
      openCodeHeartbeatTimerRef.current = undefined;
    }, openCodeHeartbeatTimeoutMs);
  }

  function clearOpenCodeHeartbeatTimer() {
    if (!openCodeHeartbeatTimerRef.current) return;
    window.clearTimeout(openCodeHeartbeatTimerRef.current);
    openCodeHeartbeatTimerRef.current = undefined;
  }

  function resetBuildActivityLog() {
    clearOpenCodeHeartbeatTimer();
    setOpenCodeEvents([]);
    setOpenCodeRawEvents([]);
    setOpenCodeHeartbeat({ active: false, time: "" });
    setAgentPhase("idle");
  }

  function noteAction(detail: string) {
    setActionDetail(detail);
  }

  function applyBrowserProjectEvidence(evidence: BrowserProjectVerification) {
    setPlayerScreenEvidence(evidence.screenVisible ? "visible" : "unverified");
    setPlayerInputEvidence(evidence.inputChanged ? "tested" : "failed");
    setPlayerAudioEvidence(evidence.audioMaxAbs > 0 ? "captured" : "silent");
    setLastInputAction(
      evidence.inputChanged
        ? "Scripted aim and fire input changed the frame"
        : "Scripted input did not change the frame",
    );
    appendOpenCodeEvent(
      "baseline.diagnostics",
      `screen=${evidence.screenVisible}; input=${evidence.inputChanged}; idle15=${evidence.idleSurvives15Seconds}; restart=${evidence.restartMatched}; restartPath=${evidence.restartPath}; audioMaxAbs=${evidence.audioMaxAbs}`,
    );
    noteAction("Low-level ROM diagnostics completed; semantic review is still required.");
  }

  function applyAgentPhaseEvent(eventType: string) {
    const nextPhase = agentPhaseFromEvent(eventType);
    if (!nextPhase) return;
    setAgentPhase(nextPhase);
  }

  function appendOpenCodeEventFromData(data: string) {
    try {
      const parsed = JSON.parse(data) as {
        type?: string;
        payload?: {
          type?: string;
          properties?: {
            type?: string;
            sessionID?: string;
            messageID?: string;
            info?: { id?: string; role?: string };
            part?: { type?: string; messageID?: string };
          };
        };
        properties?: {
          type?: string;
          sessionID?: string;
          messageID?: string;
          info?: { id?: string; role?: string };
          part?: { type?: string; messageID?: string };
        };
      };
      const properties = parsed.payload?.properties ?? parsed.properties;
      const type = properties?.type ?? parsed.payload?.type ?? parsed.type ?? "event";
      if (type === "heartbeat") {
        appendOpenCodeRawEvent("heartbeat", "OpenCode event received");
        markOpenCodeHeartbeat();
        return;
      }
      if (!properties && (type === "event" || type.toLowerCase().includes("connected"))) {
        return;
      }
      const detail =
        properties?.sessionID ??
        properties?.messageID ??
        properties?.info?.id ??
        properties?.part?.messageID ??
        "OpenCode event received";
      if (detail === "OpenCode event received" && type.toLowerCase().endsWith("updated")) return;
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
      const [healthResponse, providerResponse] = await Promise.all([
        fetch("/__drive16_opencode/global/health"),
        fetch("/__drive16_opencode/provider"),
      ]);
      if (!healthResponse.ok || !providerResponse.ok) {
        throw new Error(`Build agent returned HTTP ${healthResponse.status}/${providerResponse.status}`);
      }
      const health = (await healthResponse.json()) as { healthy?: boolean; version?: string };
      const providers = (await providerResponse.json()) as { connected?: string[] };
      const report: OpenCodeBridgeStatus = {
        generatedAt: new Date().toISOString(),
        state: health.healthy ? "ready" : "warning",
        detail: health.healthy
          ? "Local browser build agent connected"
          : "Local browser build agent reported unhealthy",
        baseUrl: "/__drive16_opencode",
        healthUrl: "/__drive16_opencode/global/health",
        eventUrl: "/__drive16_opencode/global/event",
        version: health.version,
        launched: false,
        connectedProviders: providers.connected ?? [],
      };
      setOpenCode(report);
      setOpenCodeSource("browser-local");
      setAgentProviders(report.connectedProviders ?? []);
      return report;
    } catch (error) {
      const report: OpenCodeBridgeStatus = {
        ...previewOpenCode,
        state: "warning",
        detail: errorDetail(error, "Local browser build agent is unavailable"),
      };
      setOpenCode(report);
      setOpenCodeSource("preview");
      return report;
    }
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
    resetActiveRomSession();
    setImportResult(undefined);
    setV1PromptResult(result);
    setV1PromptSource(isTauriRuntime() ? "tauri" : "preview");
    setBuildState("running");
    setStarterSource(isTauriRuntime() ? "tauri" : "preview");
    setStarterBusy(false);
    setTransport("running");
    setPlayerInputEvidence("none");
    setPlayerAudioEvidence(result.audioMaxAbs > 0 ? "captured" : "silent");
    setLastInputAction("No local input yet");
    setStarterRom({
      status: result.status,
      detail: result.detail,
      generatedAt: result.generatedAt,
      projectPath: result.projectPath,
      romPath: result.romPath,
      screenshotPath: result.neutralScreenshotPath,
      frameStreamPath: result.frameStreamPath,
      audioDumpPath: result.audioDumpPath,
      screenshotDataUrl: result.screenshotDataUrl,
      frames: result.frames,
      streamEvery: result.streamEvery,
      streamedFrames: result.streamedFrames,
      frameWidth: result.frameWidth,
      frameHeight: result.frameHeight,
      framebufferFrames: result.framebufferFrames,
      audioMaxAbs: result.audioMaxAbs,
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
      trustStage: "built",
      reviewDetail: "Demo output has not passed the semantic quality review",
      assetRoles: [
        {
          role: "Player sprite",
          source: assetMode === "generatedAssets" ? "ComfyUI sprite" : "Bundled asset",
          symbol:
            assetMode === "generatedAssets"
              ? "artifacts/phase4/live-comfyui-sprite"
              : "assets/core/player.png",
          status: "Used",
          notes:
            assetMode === "generatedAssets"
              ? "Generated sprite preview; prompt/crop details are recorded by the native build."
              : "Core starter sprite used for preview.",
        },
        {
          role: "Music loop",
          source: assetMode !== "core" ? "MML music" : "Bundled asset",
          symbol:
            assetMode !== "core"
              ? "artifacts/phase4/generated-music-prompt/project/res/generated_music.vgm"
              : "assets/core/loop.vgm",
          status: result.audioMaxAbs > 0 ? "Captured" : "Silent",
          notes: `audio evidence: ${result.audioMaxAbs > 0 ? "captured" : "silent"}`,
        },
      ],
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
      try {
        const response = await fetch("/__drive16_project/summary", { cache: "no-store" });
        if (!response.ok) throw new Error(`Project summary failed with HTTP ${response.status}`);
        const summary = (await response.json()) as ProjectSummary;
        setProjectSummary({
          ...summary,
          name: loadActiveProjectName(summary.name),
        });
        setWorkspacePath(summary.projectPath);
        setProjectSource("browser-local");
      } catch (error) {
        setProjectSummary({
          ...previewProjectSummary,
          romStatus: "warning",
          romDetail: errorDetail(error, "Local browser project is unavailable"),
        });
        setProjectSource("preview");
      }
      return;
    }

    try {
      const summary = await invoke<ProjectSummary>("load_project_summary");
      const storedName = loadActiveProjectName(summary.name);
      setProjectSummary({
        ...summary,
        name:
          summary.name === "Starter Project" || summary.name === "Active Project"
            ? storedName
            : summary.name,
      });
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
          const nextActiveModel = nextOptions[0].id;
          setActiveModel(nextActiveModel);
          savePersistedSettings({
            modelProvider,
            activeModel: nextActiveModel,
            ollamaEndpoint,
            ollamaModel,
            enhancements,
            comfyUiEndpoint,
            comfyUiCheckpoint,
            comfyUiLora,
          });
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

      appendOpenCodeEvent("model.ready", shortModelLabel(activeModel));

      // Hand the BYOK key to the OpenCode agent so chat prompts can build.
      // OpenCode activates the provider on a quick automatic restart.
      try {
        const auth = await setAgentProviderKey("openrouter", trimmedKey);
        appendOpenCodeEvent("agent.auth", auth.detail);
        if (auth.connected) {
          setAgentProviders((current) =>
            current.includes("openrouter") ? current : [...current, "openrouter"],
          );
          saveOpenRouterAcceptedKey(trimmedKey);
          setModelConnection({
            state: "ready",
            detail: "OpenRouter key accepted and saved for the agent",
          });
        } else {
          clearOpenRouterAcceptedKey();
          setModelConnection({
            state: "warning",
            detail: `Key accepted, but the agent could not activate OpenRouter: ${auth.detail}`,
          });
        }
        if (auth.restarted) void connectOpenCode();
      } catch (error) {
        const detail = errorDetail(error, "Could not hand the key to the agent");
        appendOpenCodeEvent("agent.auth.failed", detail);
        clearOpenRouterAcceptedKey();
        setModelConnection({
          state: "warning",
          detail: `Key accepted by OpenRouter, but the agent setup failed: ${detail}`,
        });
      }
    } catch (error) {
      clearOpenRouterAcceptedKey();
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
      const result = await loadOllamaModels(endpoint, model);

      const state = result.state;
      const detail =
        state === "ready"
          ? `${shortOllamaLabel(model)} is ready for questions and diagnostics. Builds use DeepSeek V3.1 through OpenRouter.`
          : result.detail;
      setOllamaModels(result.models.length ? result.models : [model]);
      setOllamaModelsSource(result.models.length ? "ready" : "empty");
      setModelConnection({
        state,
        detail,
        baseUrl: result.baseUrl,
        model: result.model,
        models: result.models,
      });
      appendOpenCodeEvent(
        state === "ready" ? "model.ready" : "model.warning",
        state === "ready"
          ? `${shortOllamaLabel(result.model)} is ready in Ollama.`
          : "Ollama needs attention. Open Advanced Ollama setup for details.",
      );
    } catch (error) {
      const detail =
        error instanceof Error ? `Ollama check failed: ${error.message}` : "Ollama check failed";
      setOllamaModels((current) => (current.includes(model) ? current : [model]));
      setOllamaModelsSource("error");
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

  async function refreshOllamaModels() {
    const endpoint = ollamaEndpoint.trim();
    if (!endpoint) {
      setOllamaModelsSource("error");
      return;
    }

    setOllamaModelsSource("loading");
    try {
      const result = await loadOllamaModels(endpoint, ollamaModel.trim());
      const models = result.models;
      if (!models.length) {
        setOllamaModels([ollamaModel]);
        setOllamaModelsSource("empty");
        setModelConnection({
          state: "warning",
          detail: "Ollama is reachable, but no installed models were found",
          baseUrl: result.baseUrl,
          model: ollamaModel,
          models,
        });
        return;
      }

      setOllamaModels(models);
      setOllamaModelsSource("ready");
      if (!models.includes(ollamaModel)) {
        handleOllamaModelChange(models[0]);
      }
    } catch (error) {
      const detail = errorDetail(error, "Could not load Ollama models");
      setOllamaModels((current) => (current.includes(ollamaModel) ? current : [ollamaModel]));
      setOllamaModelsSource("error");
      setModelConnection({
        state: "missing",
        detail,
        baseUrl: endpoint,
        model: ollamaModel,
        models: [],
      });
    }
  }

  async function loadOllamaModels(
    endpoint: string,
    model: string,
  ): Promise<OllamaEndpointStatus> {
    if (isTauriRuntime()) {
      return invoke<OllamaEndpointStatus>("check_ollama_endpoint", {
        request: { endpoint, model },
      });
    }

    const baseUrl = normalizeLocalEndpoint(endpoint, "11434");
    const response = await fetch(`${baseUrl}/api/tags`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Ollama returned HTTP ${response.status}`);
    }
    const payload = (await response.json()) as OllamaTagsResponse;
    const models = Array.from(
      new Set(
        (payload.models ?? [])
          .map((item) => (item.name ?? item.model ?? "").trim())
          .filter(Boolean),
      ),
    );
    const available = models.includes(model);
    return {
      generatedAt: String(Date.now()),
      state: available ? "ready" : "warning",
      detail: available
        ? "Ollama model available"
        : models.length
          ? `Ollama reachable, but ${model} is not installed`
          : "Ollama API reachable, but no local models were reported",
      baseUrl,
      tagsUrl: `${baseUrl}/api/tags`,
      model,
      models,
    };
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
        : await browserComfyUiEndpointStatus(endpoint);

      setComfyUiConnection(result);
      appendOpenCodeEvent(
        result.state === "ready"
          ? "comfyui.ready"
          : result.state === "warning"
            ? "comfyui.warning"
            : "comfyui.missing",
        comfyUiActivityDetail(result),
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
      appendOpenCodeEvent(
        "comfyui.failed",
        "Sprite tools check failed. Open Advanced sprite setup for details.",
      );
    }
  }

  async function launchComfyUiConnection() {
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
      state: "starting",
      detail: "Launching ComfyUI",
      checks: [
        {
          name: "API",
          state: "warning",
          detail: "Starting local ComfyUI process",
        },
      ],
    }));
    appendOpenCodeEvent("comfyui.starting", "Starting local sprite tools.");

    try {
      const result = isTauriRuntime()
        ? await invoke<ComfyUiEndpointStatus>("launch_comfyui_endpoint", {
            request: { endpoint, checkpoint, lora },
          })
        : await browserComfyUiEndpointStatus(endpoint);

      setComfyUiConnection(result);
      appendOpenCodeEvent(
        result.state === "ready"
          ? "comfyui.ready"
          : result.state === "starting"
            ? "comfyui.starting"
            : result.state === "warning"
              ? "comfyui.warning"
              : "comfyui.missing",
        comfyUiActivityDetail(result),
      );
    } catch (error) {
      const detail =
        error instanceof Error ? `ComfyUI launch failed: ${error.message}` : "ComfyUI launch failed";
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
      appendOpenCodeEvent(
        "comfyui.failed",
        "Sprite tools could not start. Open Advanced sprite setup for details.",
      );
    }
  }

  function handleOpenRouterKeyChange(value: string) {
    setOpenRouterKey(value);
    saveOpenRouterKey(value);
    clearOpenRouterAcceptedKey();
    resetModelConnectionIfChecked("OpenRouter not tested");
  }

  useEffect(() => {
    saveOpenRouterKey(openRouterKey);
  }, [openRouterKey]);

  function handleProviderChange(value: ModelProvider) {
    setModelProvider(value);
    savePersistedSettings({
      modelProvider: value,
      activeModel,
      ollamaEndpoint,
      ollamaModel,
      enhancements,
      comfyUiEndpoint,
      comfyUiCheckpoint,
      comfyUiLora,
    });
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
      setOllamaModelsSource("idle");
    }
    noteAction(
      value === "openrouter"
        ? "Model provider switched to OpenRouter."
        : "Model provider switched to Ollama.",
    );
  }

  function handleOpenRouterModelChange(value: string) {
    setActiveModel(value);
    savePersistedSettings({
      modelProvider,
      activeModel: value,
      ollamaEndpoint,
      ollamaModel,
      enhancements,
      comfyUiEndpoint,
      comfyUiCheckpoint,
      comfyUiLora,
    });
    resetModelConnectionIfChecked("OpenRouter not tested");
  }

  function handleOllamaEndpointChange(value: string) {
    setOllamaEndpoint(value);
    setOllamaModelsSource("stale");
    savePersistedSettings({
      modelProvider,
      activeModel,
      ollamaEndpoint: value,
      ollamaModel,
      enhancements,
      comfyUiEndpoint,
      comfyUiCheckpoint,
      comfyUiLora,
    });
    resetModelConnectionIfChecked("Ollama not tested");
  }

  function handleOllamaModelChange(value: string) {
    setOllamaModel(value);
    savePersistedSettings({
      modelProvider,
      activeModel,
      ollamaEndpoint,
      ollamaModel: value,
      enhancements,
      comfyUiEndpoint,
      comfyUiCheckpoint,
      comfyUiLora,
    });
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
    savePersistedSettings({
      modelProvider,
      activeModel,
      ollamaEndpoint,
      ollamaModel,
      enhancements,
      comfyUiEndpoint: value,
      comfyUiCheckpoint,
      comfyUiLora,
    });
    resetComfyUiConnectionIfChecked();
  }

  function handleComfyUiCheckpointChange(value: string) {
    setComfyUiCheckpoint(value);
    savePersistedSettings({
      modelProvider,
      activeModel,
      ollamaEndpoint,
      ollamaModel,
      enhancements,
      comfyUiEndpoint,
      comfyUiCheckpoint: value,
      comfyUiLora,
    });
    resetComfyUiConnectionIfChecked();
  }

  function handleComfyUiLoraChange(value: string) {
    setComfyUiLora(value);
    savePersistedSettings({
      modelProvider,
      activeModel,
      ollamaEndpoint,
      ollamaModel,
      enhancements,
      comfyUiEndpoint,
      comfyUiCheckpoint,
      comfyUiLora: value,
    });
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
    setEnhancements((current) => {
      const next = {
        ...current,
        [key]: enabled,
      };
      savePersistedSettings({
        modelProvider,
        activeModel,
        ollamaEndpoint,
        ollamaModel,
        enhancements: next,
        comfyUiEndpoint,
        comfyUiCheckpoint,
        comfyUiLora,
      });
      return next;
    });

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

  async function startNewProject() {
    if (!(await cancelPendingAgentRun("agent.canceled.new_project"))) {
      setProjectActionNotice({
        state: "missing",
        label: "Could not start a new project",
        detail: "The current build agent did not confirm cancellation. The workspace was left untouched.",
      });
      return;
    }

    disposeInteractivePlayer();
    setPlayerCanvasActive(false);
    setPlayerState("stopped");
    setPlayerAudio("unavailable");
    setPlayerScreenEvidence("none");
    setPlayerInputEvidence("none");
    setPlayerAudioEvidence("none");
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
    agentActivityRepairRef.current = createAgentActivityRepairState();
    setLoadedPlayerRom(undefined);
    setLastPlayerInput(undefined);
    setLastInputAction("No local input yet");
    resetBuildActivityLog();
    resetActiveProjectName();
    clearPersistedPendingAgentRun();
    setOpenCodeBusy(false);
    await resetActiveProject()
      .then((project) => {
        setWorkspacePath(project.projectPath);
        setProjectSummary(projectSummaryFromActiveProject(project, "Untitled Project"));
        setProjectSource(isTauriRuntime() ? "tauri" : "browser-local");
      })
      .catch((error) => {
        const detail = errorDetail(error, "Could not reset the project workspace");
        setProjectActionNotice({
          state: "missing",
          label: "Project reset failed",
          detail,
        });
        appendOpenCodeEvent("project.reset.failed", detail);
        noteAction(detail);
      });
    setTransport("paused");
    setSpriteX(52);
    setStarterRom({
      ...previewStarterRom,
      detail: "Blank project ready. Build a ROM to preview it.",
      projectPath: "artifacts/phase3/active-project",
      romPath: "artifacts/phase3/active-project/out/rom.bin",
    });
    setStarterSource("preview");
    setStarterBusy(false);
    setBuildState("running");
    setProjectSummary({
      ...previewProjectSummary,
      name: "Untitled Project",
      projectPath: "artifacts/phase3/active-project",
      romPath: "artifacts/phase3/active-project/out/rom.bin",
          romStatus: "missing",
          romDetail: "No ROM built yet",
          trustStage: "prototype",
          reviewDetail: "No ROM has been built or reviewed",
    });
    setProjectSource("checking");
    setProjectActionNotice({
      state: "ready",
      label: "New starter project",
      detail: "Blank starter template loaded",
    });
    noteAction("New project started from the blank starter template.");
    appendOpenCodeEvent("project.new", "Blank starter template loaded");
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

    resetActiveRomSession();
    setImportResult(undefined);
    setImportReadiness(undefined);
    setV1PromptResult(undefined);
    setV1PromptSource("idle");
    setAgentRom(undefined);
    setOpenCodeSessionId(undefined);
    setPlayerInputEvidence("none");
    setPlayerAudioEvidence("none");
    setLastInputAction("No local input yet");
    saveActiveProjectName(target.name);
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
    resetActiveRomSession();
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
    setPlayerInputEvidence("none");
    setPlayerAudioEvidence("none");
    setLastInputAction("No local input yet");
    setProjectActionNotice({
      state: result.status,
      label: "Imported ROM active",
      detail: `${result.sourceName} copied to ${result.importPath}`,
    });
    noteAction(`Imported ROM active: ${result.sourceName}.`);
  }

  function resetActiveRomSession() {
    disposeInteractivePlayer();
    setPlayerCanvasGeneration((current) => current + 1);
    setPlayerCanvasActive(false);
    setPlayerState("stopped");
    setPlayerAudio("unavailable");
    setPlayerScreenEvidence("none");
    setPlayerInputEvidence("none");
    setPlayerAudioEvidence("none");
    setLoadedPlayerRom(undefined);
    setLastPlayerInput(undefined);
    setLastInputAction("No local input yet");
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
      void launchRom(result.importPath, "Imported ROM preview captured.");
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
      let browserTestRomBytes: Uint8Array | undefined;
      if (!isTauriRuntime()) {
        const response = await fetch("/__drive16_test_rom.bin");
        if (!response.ok) {
          throw new Error(`Browser test ROM could not be loaded (HTTP ${response.status}).`);
        }
        browserTestRomBytes = new Uint8Array(await response.arrayBuffer());
      }
      activateImportedRom(result);
      if (browserTestRomBytes) {
        setLoadedPlayerRom(
          playerRomFromBytes(result.importPath, result.sourceName, browserTestRomBytes),
        );
      }
      appendOpenCodeEvent("rom.imported.test", result.importPath);
      void launchRom(result.importPath, "Test ROM preview captured.");
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
    if (!importResult && projectSummary.romStatus !== "ready") {
      const detail = projectSummary.romDetail || "Build a ROM before verifying this project.";
      setProjectActionNotice({
        state: "missing",
        label: "No ROM to verify",
        detail,
      });
      noteAction("No ROM is available to verify yet.");
      appendOpenCodeEvent("verify.no_rom", detail);
      return;
    }

    noteAction(importResult ? "Verifying the imported ROM." : "Verifying the active project ROM.");
    appendOpenCodeEvent("verify.started", activePath);
    void launchRom(
      activePath,
      importResult
        ? "Imported ROM preview captured."
        : "Active project ROM preview captured.",
    );
  }

  async function playActiveRom() {
    if (!interactiveCoreReadiness.canPlay) {
      setPlayerState("stopped");
      setPlayerCanvasActive(false);
      setPlayerScreenEvidence((current) =>
        current === "captured" ? "captured" : "unverified",
      );
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

    setPlayerState("loading");
    setPlayerCanvasActive(true);
    setPlayerAudio("muted");
    setPlayerScreenEvidence("checking");
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
      const runtime = await withTimeout(
        launchNostalgistMegadrivePlayer({
          canvas,
          core,
          rom: payload,
        }),
        playerSetupTimeoutMs,
        `Interactive Play setup timed out after ${formatDurationMs(playerSetupTimeoutMs)}.`,
      );
      playerRuntimeRef.current = runtime;
      setPlayerState("playing");
      setPlayerAudio("muted");
      schedulePlayerVisibilityCheck(payload.sourcePath);
      setProjectActionNotice({
        state: "warning",
        label: "Player ready — muted",
        detail: `${payload.sourceName} started with ${
          runtime.coreSource === "user" ? "the local core" : "the streamed core"
        }. Sound starts muted as a safety precaution. Click the sound control when you are ready to listen.`,
      });
      noteAction(
        `Player started for ${payload.sourceName} with ${
          runtime.coreSource === "user" ? "the local core" : "the streamed core"
        }; sound muted until the user enables it.`,
      );
      appendOpenCodeEvent("player.playing", `${payload.sourcePath} via ${runtime.coreSource}`);
    } catch (error) {
      const detail = interactivePlayerErrorDetail(error);
      const launchFailure = coreLaunchFailureReadiness(detail);
      if (launchFailure) {
        setInteractiveCoreReadiness(launchFailure);
      }
      disposeInteractivePlayer();
      setPlayerCanvasActive(false);
      setPlayerState("error");
      setPlayerScreenEvidence((current) =>
        current === "captured" ? "captured" : "unverified",
      );
      setProjectActionNotice({
        state: launchFailure ? "warning" : "missing",
        label: launchFailure ? "Play setup needed" : "Play setup failed",
        detail: launchFailure ? `${launchFailure.detail} ${launchFailure.verifyDetail}` : detail,
      });
      noteAction(launchFailure ? launchFailure.detail : detail);
      appendOpenCodeEvent("player.failed", detail);
    }
  }

  function schedulePlayerVisibilityCheck(sourcePath: string) {
    const sampleDelays = [900, 1_800, 3_200, 6_000];
    const samples: Array<"visible" | "blank" | "unknown"> = [];
    let reported = false;

    sampleDelays.forEach((delay) => {
      window.setTimeout(async () => {
        const runtime = playerRuntimeRef.current;
        if (!runtime || runtime.rom.sourcePath !== sourcePath || reported) return;

        const visibility = readCanvasVisibility(playerCanvasRef.current);
        samples.push(visibility);
        if (visibility === "visible") {
          reported = true;
          setPlayerScreenEvidence("visible");
          const detail = "The game screen is visible and updating.";
          setProjectActionNotice({
            state: "ready",
            label: "Screen visible",
            detail,
          });
          noteAction(detail);
          appendOpenCodeEvent("player.screen.visible", sourcePath);
          return;
        }
        if (samples.length < sampleDelays.length) return;

        const runtimeCapture = await readRuntimeScreenshotVisibility(runtime);
        if (runtimeCapture === "visible") {
          reported = true;
          setPlayerScreenEvidence("visible");
          const detail = "The game screen is visible and updating.";
          setProjectActionNotice({
            state: "ready",
            label: "Screen visible",
            detail,
          });
          noteAction(detail);
          appendOpenCodeEvent("player.screen.visible", `${sourcePath}; RetroArch screenshot`);
          return;
        }

        reported = true;
        const unknownCount = samples.filter((sample) => sample === "unknown").length;
        const mostlyUnknown = unknownCount >= Math.ceil(samples.length / 2);
        setPlayerScreenEvidence((current) =>
          current === "visible" || current === "captured"
            ? current
            : mostlyUnknown
              ? "inconclusive"
              : "unverified",
        );

        const runtimeLog = runtime?.logs
          .filter((line) => /\[error\]|\[warn/i.test(line))
          .filter(
            (line) =>
              !/Cannot push NULL or empty core path into the playlist/i.test(line) &&
              !/Could not get screen dimensions/i.test(line),
          )
          .slice(-4)
          .join(" | ");
        const detail = mostlyUnknown
          ? "The live canvas sampler was unavailable. Drive16 retained any completed emulator screen proof while the ROM kept running."
          : "Drive16 could not confirm visible game output. The ROM may be blank or stalled.";
        setProjectActionNotice({
          state: "warning",
          label: mostlyUnknown ? "Live screen check unavailable" : "Screen not verified",
          detail,
        });
        noteAction(detail);
        appendOpenCodeEvent(
          mostlyUnknown ? "player.screen.inconclusive" : "player.screen.unverified",
          runtimeLog ? `${sourcePath}; ${runtimeLog}` : sourcePath,
        );
      }, delay);
    });
  }

  async function readRuntimeScreenshotVisibility(
    runtime: NostalgistPlayerRuntime,
  ): Promise<"visible" | "blank" | "unknown"> {
    try {
      const screenshot = await withTimeout(
        runtime.instance.screenshot(),
        4_000,
        "Interactive player screenshot timed out.",
      );
      const bitmap = await createImageBitmap(screenshot);
      const sample = document.createElement("canvas");
      sample.width = Math.min(96, bitmap.width);
      sample.height = Math.min(72, bitmap.height);
      const context = sample.getContext("2d", { willReadFrequently: true });
      if (!context) return "unknown";
      context.drawImage(bitmap, 0, 0, sample.width, sample.height);
      bitmap.close();
      return pixelBufferVisibility(
        context.getImageData(0, 0, sample.width, sample.height).data,
      );
    } catch {
      return "unknown";
    }
  }

  function readCanvasVisibility(canvas: HTMLCanvasElement | null): "visible" | "blank" | "unknown" {
    if (!canvas || canvas.width <= 0 || canvas.height <= 0) return "unknown";

    try {
      const webgl =
        (canvas.getContext("webgl2") as WebGL2RenderingContext | null) ??
        (canvas.getContext("webgl") as WebGLRenderingContext | null);
      if (webgl) {
        const pixels = new Uint8Array(canvas.width * canvas.height * 4);
        webgl.readPixels(
          0,
          0,
          canvas.width,
          canvas.height,
          webgl.RGBA,
          webgl.UNSIGNED_BYTE,
          pixels,
        );
        return pixelBufferVisibility(pixels);
      }

      const width = Math.min(96, canvas.width);
      const height = Math.min(72, canvas.height);
      const sample = document.createElement("canvas");
      sample.width = width;
      sample.height = height;
      const context = sample.getContext("2d", { willReadFrequently: true });
      if (!context) return "unknown";
      context.drawImage(canvas, 0, 0, width, height);
      const pixels = context.getImageData(0, 0, width, height).data;
      return pixelBufferVisibility(pixels);
    } catch {
      return "unknown";
    }
  }

  async function readActiveRomForPlayer(source: ActiveRomSource): Promise<LoadedPlayerRom> {
    // Only reuse in-memory bytes in the browser preview, where there is no
    // disk access. In the desktop app the ROM at this path may have just
    // been rebuilt, so always re-read it.
    if (
      !isTauriRuntime() &&
      source.kind === "imported" &&
      loadedPlayerRom?.sourcePath === source.path
    ) {
      return loadedPlayerRom;
    }

    if (!isTauriRuntime()) {
      const response = await fetch("/__drive16_project/rom", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Browser could not load the active ROM (HTTP ${response.status}).`);
      }
      return playerRomFromBytes(
        source.path,
        source.path.split(/[\\/]/).pop() || "rom.bin",
        new Uint8Array(await response.arrayBuffer()),
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
    if (loadedInteractiveCore) {
      return loadedInteractiveCore;
    }

    if (interactiveCoreReadiness.policy === "dev-cdn") {
      const core = await withTimeout(
        downloadStreamedInteractiveCore(),
        playerSetupTimeoutMs,
        `Interactive Play core download timed out after ${formatDurationMs(playerSetupTimeoutMs)}.`,
      );
      setLoadedInteractiveCore(core);
      return core;
    }

    if (
      interactiveCoreReadiness.status !== "available" ||
      interactiveCoreReadiness.policy !== "user-supplied"
    ) {
      return undefined;
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

  async function resetInteractivePlayer() {
    const runtime = playerRuntimeRef.current;
    if (!runtime) {
      noteAction("No interactive ROM is running yet.");
      return;
    }

    const sourceName = runtime.rom.sourceName;
    const sourcePath = runtime.rom.sourcePath;
    const restartAction = projectSummary.restartAction
      ? playerInputActionForId(projectSummary.restartAction, "controller", "Restart")
      : undefined;
    if (!restartAction) {
      const detail = `${sourceName} does not document a game recovery control. Drive16 will not substitute an emulator reset.`;
      setProjectActionNotice({ state: "missing", label: "Restart unavailable", detail });
      noteAction(detail);
      appendOpenCodeEvent("player.restart.unavailable", sourcePath);
      return;
    }

    try {
      if (playerState === "paused") resumeNostalgistPlayer(runtime);
      await restartNostalgistPlayer(runtime, restartAction);
      setPlayerCanvasActive(true);
      setPlayerState("playing");
      setProjectActionNotice({
        state: "ready",
        label: "Game restarted",
        detail: `${sourceName} received its documented ${restartAction.label} recovery control.`,
      });
      noteAction(`Restarted ${sourceName} using its ${restartAction.label} control.`);
      appendOpenCodeEvent(
        "player.restarted",
        `${sourcePath}; path=${restartAction.id}`,
      );
    } catch (error) {
      const detail = errorDetail(error, "The game's recovery control failed");
      setProjectActionNotice({ state: "missing", label: "Restart failed", detail });
      noteAction(detail);
      appendOpenCodeEvent("player.restart.failed", detail);
    }
  }

  function stopInteractivePlayer() {
    const runtime = playerRuntimeRef.current;
    disposeInteractivePlayer();
    setPlayerCanvasGeneration((current) => current + 1);
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
    noteAction("ROM input focus is on the viewport.");
    appendOpenCodeEvent("input.focused", projectSummary.romPath);
  }

  function setInteractivePlayerVolume(value: number) {
    if (romAudioAvailable === false) {
      setProjectActionNotice({
        state: "missing",
        label: "No sound in this ROM",
        detail: "The project manifest records music and sound effects as planned, not included.",
      });
      return;
    }
    const nextVolume = clampPlayerVolume(value);
    setPlayerVolume(nextVolume);
    const runtime = playerRuntimeRef.current;
    if (!runtime) {
      setPlayerAudio(nextVolume > 0 ? "needs-gesture" : "unavailable");
      return;
    }

    void setNostalgistVolume(runtime, nextVolume).then((state) => {
      setPlayerAudio(nextVolume === 0 ? "muted" : state);
      appendOpenCodeEvent("player.audio.volume", `${nextVolume}%`);
      if (nextVolume === 0) {
        setProjectActionNotice({
          state: "warning",
          label: "Volume muted",
          detail: "App volume is 0%. Raise the slider manually if you want sound.",
        });
        noteAction("App volume is muted.");
      } else if (state === "needs-gesture") {
        const detail =
          "Sound is waiting for the browser audio context. Adjust the volume again after clicking the game screen.";
        setProjectActionNotice({
          state: "warning",
          label: "Sound needs a click",
          detail,
        });
        noteAction(detail);
      } else if (state === "enabled" || state === "signal") {
        detectInteractivePlayerAudio(runtime);
      }
    });
  }

  function detectInteractivePlayerAudio(runtime: NostalgistPlayerRuntime) {
    void detectNostalgistAudioSignal(runtime).then((signalDetected) => {
      if (playerRuntimeRef.current !== runtime) return;
      if (signalDetected) {
        setPlayerAudio("signal");
        setPlayerAudioEvidence("captured");
        appendOpenCodeEvent("player.audio.signal", runtime.rom.sourcePath);
        noteAction("Game audio signal reached the browser output graph.");
        return;
      }
      setPlayerAudioEvidence("silent");
      setProjectActionNotice({
        state: "missing",
        label: "No sound detected",
        detail: "The player is enabled, but this ROM produced no audio signal.",
      });
      appendOpenCodeEvent("player.audio.silent", runtime.rom.sourcePath);
      noteAction("The player is enabled, but the ROM produced no audio signal.");
    });
  }

  function toggleInteractivePlayerMute() {
    if (romAudioAvailable === false) {
      setPlayerAudioEvidence("silent");
      setProjectActionNotice({
        state: "missing",
        label: "No sound in this ROM",
        detail: "The current build did not include its planned music or sound effects.",
      });
      noteAction("This ROM has no included audio to enable.");
      return;
    }
    const runtime = playerRuntimeRef.current;
    if (!runtime) {
      const detail = "Start a ROM before changing audio.";
      setProjectActionNotice({
        state: "warning",
        label: "Audio unavailable",
        detail,
      });
      noteAction(detail);
      appendOpenCodeEvent("player.audio.unavailable", "No interactive ROM is running");
      return;
    }
    if (playerVolume === 0 || playerAudio === "muted") {
      const nextVolume = playerVolume > 0 ? playerVolume : defaultPlayerVolume;
      void setNostalgistVolume(runtime, nextVolume).then((state) => {
        setPlayerVolume(nextVolume);
        setPlayerAudio(state);
        const detail =
          state === "enabled" || state === "signal"
            ? `Sound is enabled at ${nextVolume}%.`
            : "The browser has not made this player session audible yet.";
        setProjectActionNotice({
          state: state === "enabled" || state === "signal" ? "ready" : "warning",
          label:
            state === "signal"
              ? "Sound signal detected"
              : state === "enabled"
                ? "Sound enabled"
                : "Sound unavailable",
          detail,
        });
        noteAction(detail);
        appendOpenCodeEvent("player.audio.volume", `${nextVolume}%`);
        if (state === "enabled" || state === "signal") {
          detectInteractivePlayerAudio(runtime);
        }
      });
      return;
    }
    if (playerAudio === "unavailable" || playerAudio === "needs-gesture") {
      void setNostalgistVolume(runtime, playerVolume).then((state) => {
        setPlayerAudio(state);
        if (state === "unavailable") {
          const detail =
            "Audio is not available in this player session yet. The ROM may have no audio output, or the web audio context is unavailable for this core session.";
          setProjectActionNotice({
            state: "warning",
            label: "Audio unavailable",
            detail,
          });
          noteAction(detail);
          appendOpenCodeEvent("player.audio.unavailable", runtime.rom.sourcePath);
        } else if (state === "needs-gesture") {
          const detail =
            "Sound is still waiting for the browser audio context. Click the game screen, then try Enable sound again.";
          setProjectActionNotice({
            state: "warning",
            label: "Sound needs a click",
            detail,
          });
          noteAction(detail);
          appendOpenCodeEvent("player.audio.needs_gesture", runtime.rom.sourcePath);
        } else {
          noteAction(
            state === "signal"
              ? "Sound signal detected."
              : state === "enabled"
                ? "Sound is enabled."
                : "Sound is muted.",
          );
          appendOpenCodeEvent("player.audio", state);
          detectInteractivePlayerAudio(runtime);
        }
      });
      return;
    }
    void setNostalgistMuted(runtime, true).then(() => {
      setPlayerAudio("muted");
      setProjectActionNotice({
        state: "warning",
        label: "Muted",
        detail: `Sound is muted. The saved level remains ${playerVolume}%.`,
      });
      noteAction("Sound muted without changing the saved level.");
      appendOpenCodeEvent("player.audio.muted", `${playerVolume}% saved`);
    });
  }

  function prepareInteractivePlayerAudio() {
    const runtime = playerRuntimeRef.current;
    if (!runtime) return;
    // Pointer-down may unlock WebAudio, but the following click owns the
    // visible Muted/On transition. Do not let a missing probe race the click
    // and overwrite a successful unmute with "Unavailable".
    void resumeNostalgistAudio(runtime);
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
    setPlayerInputEvidence("testing");
    noteAction("Verifying scripted Right-input proof.");
    appendOpenCodeEvent("input.proof.started", "Scripted Right input");

    try {
      const promptResult = await runV1Prompt(prompt);
      applyV1PromptResult(promptResult, "core");
      setLastInputAction("Right proof passed");
      setPlayerInputEvidence("tested");
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
      setPlayerInputEvidence("failed");
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

  async function launchRom(
    romPath?: string,
    doneMessage = "ROM preview ready.",
  ): Promise<RomPreviewLoadResult> {
    setStarterBusy(true);
    setStarterSource("checking");
    setBuildState("building");
    noteAction(romPath ? "Loading the ROM preview." : "Loading the starter ROM preview.");

    if (!isTauriRuntime()) {
      setStarterRom(makePreviewStarterRom(romPath));
      setStarterSource("preview");
      if (romPath) {
        setPlayerScreenEvidence((current) =>
          current === "visible" ? "visible" : "captured",
        );
      }
      setBuildState("running");
      noteAction(`${doneMessage} Browser preview is using simulated frames.`);
      setStarterBusy(false);
      return {
        ok: true,
        detail: `${doneMessage} Browser preview is using simulated frames.`,
      };
    }

    try {
      const preview = romPath
        ? await invoke<StarterRomPreview>("launch_rom_path", { romPath })
        : await invoke<StarterRomPreview>("launch_starter_rom");
      setStarterRom(preview);
      setStarterSource("tauri");
      if (romPath) {
        setPlayerScreenEvidence((current) =>
          current === "visible" ? "visible" : "captured",
        );
        setPlayerAudioEvidence(
          typeof preview.audioMaxAbs === "number"
            ? preview.audioMaxAbs > 0
              ? "captured"
              : "silent"
            : "none",
        );
        setPlayerInputEvidence(preview.inputChanged ? "tested" : "failed");
        setLastInputAction(
          preview.inputChanged
            ? "Scripted Right input changed the frame"
            : "Scripted Right input did not change the frame",
        );
        appendOpenCodeEvent(
          preview.inputChanged ? "preview.input.tested" : "preview.input.failed",
          `${preview.inputScriptPath ?? "input script"}; changed=${(
            (preview.inputChangeRatio ?? 0) * 100
          ).toFixed(3)}%`,
        );
        appendOpenCodeEvent(
          preview.audioMaxAbs && preview.audioMaxAbs > 0
            ? "preview.audio.captured"
            : "preview.audio.silent",
          `${preview.audioDumpPath ?? "audio dump"}; maxAbs=${preview.audioMaxAbs ?? 0}`,
        );
      }
      setBuildState("running");
      noteAction(doneMessage);
      return {
        ok: true,
        detail: doneMessage,
      };
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : "Starter ROM launch was not available";
      setStarterRom({
        ...previewStarterRom,
        status: "warning",
        detail,
        generatedAt: "error",
      });
      setStarterSource("error");
      setBuildState("error");
      setPlayerScreenEvidence((current) =>
        current === "visible" || current === "captured" ? current : "unverified",
      );
      setPlayerAudioEvidence((current) =>
        current === "captured" || current === "silent" ? current : "failed",
      );
      appendOpenCodeEvent("preview.failed", detail);
      noteAction(`ROM preview failed: ${detail}`);
      return {
        ok: false,
        detail,
      };
    } finally {
      setStarterBusy(false);
    }
  }

  const providerSetupHint =
    modelProvider === "ollama"
      ? modelConnection.state === "ready"
        ? ""
        : "Test an installed Ollama model in Settings"
      : modelConnection.state === "ready" || agentProviders.includes("openrouter")
        ? ""
        : openRouterKey.trim()
          ? "Open Settings to verify your saved key"
          : "Add a model key in Settings to start building";

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
        actionDetail={actionFeedback.detail}
        actionLabel={actionFeedback.label}
        actionState={actionFeedback.state}
        buildLabel={topBarStatus.label}
        buildState={topBarStatus.state}
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
          agentPhaseLabel={agentPhase === "idle" ? "" : agentPhaseLabel(agentPhase)}
          buildEvents={openCodeEvents}
          heartbeat={openCodeHeartbeat}
          rawBuildEvents={openCodeRawEvents}
          busy={openCodeBusy || buildState === "building"}
          collapsed={conversationCollapsed}
          draft={draft}
          messages={messages}
          messagesRef={messagesRef}
          composerInputRef={composerInputRef}
          providerSetupHint={providerSetupHint}
          sendDisabled={openCodeBusy}
          onDraftChange={setDraft}
          onOpenSettings={() => setSettingsOpen(true)}
          onSubmit={submitMessage}
          onToggleCollapse={toggleConversationPane}
        />
        <PlayerPane
          assetSummary={projectAssetSummary(projectSummary.assetRoles, activeRomSource.kind)}
          canvasGeneration={playerCanvasGeneration}
          canvasRef={playerCanvasRef}
          controllerBindings={controllerBindingRows}
          controllerConfigured={controllerMappingReady}
          controlsOpen={controlsOpen}
          emulatorFocused={emulatorFocused}
          gamepadReadiness={gamepadReadiness}
          keyboardBindings={keyboardBindingRows}
          keyboardMappings={keyboardMappings}
          lastInputAction={lastInputAction}
          playerInputEvidence={playerInputEvidence}
          playerAudio={playerAudio}
          playerAudioEvidence={playerAudioEvidence}
          playerVolume={playerVolume}
          playerCanvasActive={playerCanvasActive}
          playerScreenEvidence={playerScreenEvidence}
          playerState={playerState}
          playDisabled={starterBusy || buildState === "building" || !activeRomPlayable}
          profileSource={inputProfile.source}
          romUnavailable={!activeRomPlayable}
          romAudioAvailable={romAudioAvailable}
          trustStage={projectSummary.trustStage}
          romInputFocused={romInputFocused}
          romLabel={activeRomSource.label}
          sessionActive={Boolean(playerRuntimeRef.current)}
          spriteX={spriteX}
          starterBusy={starterBusy}
          starterRom={starterRom}
          stateLabel={playerStateLabel(playerState)}
          transport={transport}
          viewportRef={romViewportRef}
          buildInProgress={openCodeBusy || buildState === "building"}
          firstRunNote={firstRunNote}
          onCloseControls={closeControlsPanel}
          onOpenProject={() => setProjectMenuOpen(true)}
          onPlay={() => {
            void playActiveRom();
          }}
          onPrepareAudio={prepareInteractivePlayerAudio}
          onResetPlayer={resetInteractivePlayer}
          onResetProfile={resetControlsProfile}
          onScreenBlur={() => setRomInputFocused(false)}
          onScreenClick={focusRomInput}
          onScreenFocus={() => setRomInputFocused(true)}
          onScreenKeyDown={handleRomKeyDown}
          onScreenKeyUp={handleRomKeyUp}
          onStop={stopInteractivePlayer}
          onStartPrompt={focusComposer}
          onToggleControls={toggleControlsPanel}
          onToggleFocus={toggleEmulatorFocus}
          onToggleMute={toggleInteractivePlayerMute}
          onTogglePause={toggleInteractivePlayerPause}
          onVolumeChange={setInteractivePlayerVolume}
        />
      </section>

      <div className="sr-only" aria-live="polite" data-testid="rom-action-feedback">
        {actionFeedback.label}. {actionFeedback.detail}
        {actionFeedback.detail === actionDetail ? "" : ` ${actionDetail}`}
      </div>

      {settingsOpen ? (
        <SettingsPanel
          activeModel={activeModel}
          comfyUiCheckpoint={comfyUiCheckpoint}
          comfyUiConnection={comfyUiConnection}
          comfyUiEndpoint={comfyUiEndpoint}
          comfyUiLora={comfyUiLora}
          connection={modelConnection}
          desktopRuntime={isTauriRuntime()}
          enhancements={enhancements}
          modelOptions={modelOptions}
          modelProvider={modelProvider}
          modelsSource={modelsSource}
          ollamaEndpoint={ollamaEndpoint}
          ollamaModel={ollamaModel}
          ollamaModelOptions={ollamaModels.map((model) => ({
            id: model,
            name: shortOllamaLabel(model),
          }))}
          ollamaModelsSource={ollamaModelsSource}
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
          onLaunchComfyUi={() => {
            void launchComfyUiConnection();
          }}
          onModelChange={handleOpenRouterModelChange}
          onOllamaEndpointChange={handleOllamaEndpointChange}
          onOllamaModelChange={handleOllamaModelChange}
          onOpenRouterKeyChange={handleOpenRouterKeyChange}
          onProviderChange={handleProviderChange}
          onRefreshOllamaModels={() => {
            void refreshOllamaModels();
          }}
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
          exportResult={exportResult}
          importBusy={importBusy}
          importResult={importResult}
          interactiveCoreBusy={interactiveCoreBusy}
          interactiveCoreReadiness={interactiveCoreReadiness}
          interactiveCoreStatus={interactiveCoreStatus}
          projectActionNotice={projectActionNotice}
          projectSummary={projectSummary}
          saveResult={saveResult}
          verifyBusy={starterBusy || buildState === "building"}
          workspacePath={workspacePath}
          onChooseCore={() => {
            void chooseInteractiveCore();
          }}
          onClose={() => setProjectMenuOpen(false)}
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

function comfyUiActivityDetail(connection: ComfyUiEndpointStatus) {
  if (connection.state === "ready") return "Local sprite tools are ready.";
  if (connection.state === "starting") return "Starting local sprite tools.";

  const missingChecks = connection.checks
    .filter((check) => check.state !== "ready")
    .map((check) => check.name);
  if (missingChecks.includes("API")) {
    return "Sprite tools are not running. AI sprites remain optional.";
  }
  if (missingChecks.includes("Checkpoint") || missingChecks.includes("LoRA")) {
    return "Sprite tools need model setup. Open Advanced sprite setup.";
  }
  return "Sprite tools need attention. Open Advanced sprite setup for details.";
}

// Direct-download packages may stream the interactive core at Play time. The
// core is not bundled; user-supplied local cores remain supported.
function allowDevCoreCdnFallback() {
  const dev = import.meta.env.DEV;
  const streamedCore = import.meta.env.VITE_DRIVE16_ALLOW_STREAMED_CORE;
  return (
    dev === true ||
    String(dev) === "true" ||
    streamedCore === true ||
    String(streamedCore) === "true" ||
    String(streamedCore) === "1"
  );
}

// Tauri invoke rejects with plain strings; keep the real reason.
function errorDetail(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

function interactivePlayerErrorDetail(error: unknown): string {
  if (!(error instanceof Error)) return errorDetail(error, "Interactive Play setup failed");
  const cause = "cause" in error ? error.cause : undefined;
  const causeDetail =
    cause instanceof Error
      ? cause.message
      : typeof cause === "string"
        ? cause
        : cause
          ? JSON.stringify(cause)
          : "";
  const stackLine = error.stack
    ?.split("\n")
    .slice(1, 3)
    .map((line) => line.trim())
    .join(" | ");
  return [error.message, causeDetail, stackLine].filter(Boolean).join(" — ");
}

function pixelBufferVisibility(
  pixels: Uint8Array | Uint8ClampedArray,
): "visible" | "blank" | "unknown" {
  let opaquePixels = 0;
  let nonBlackPixels = 0;
  let minBrightness = 255;
  let maxBrightness = 0;
  for (let index = 0; index < pixels.length; index += 16) {
    const alpha = pixels[index + 3];
    const brightness = Math.max(pixels[index], pixels[index + 1], pixels[index + 2]);
    if (alpha > 0) {
      opaquePixels += 1;
      minBrightness = Math.min(minBrightness, brightness);
      maxBrightness = Math.max(maxBrightness, brightness);
      if (brightness > 8) nonBlackPixels += 1;
    }
  }
  if (opaquePixels < 20) return "unknown";
  if (nonBlackPixels > 12 || maxBrightness - minBrightness > 8) return "visible";
  return "blank";
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function formatDurationMs(durationMs: number) {
  if (durationMs < 1000) return `${durationMs}ms`;
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function formatMessageTime(date = new Date()) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatLogTime(date = new Date()) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function isHeartbeatEvent(type: string, detail: string) {
  return type.toLowerCase().includes("heartbeat") || detail.toLowerCase().includes("heartbeat");
}

function agentPhaseLabel(phase: AgentPhase) {
  const labels: Record<AgentPhase, string> = {
    idle: "Ready",
    planning: "Planning",
    editing: "Editing",
    building: "Building",
    testing: "Testing",
    done: "Done",
    failed: "Failed",
  };
  return labels[phase];
}

function agentPhaseFromEvent(eventType: string): AgentPhase | undefined {
  if (
    eventType === "agent.failed" ||
    eventType === "agent.stalled" ||
    eventType === "agent.refresh.failed" ||
    eventType === "project.memory.failed" ||
    (eventType.startsWith("agent.") &&
      (eventType.endsWith(".failed") ||
        eventType.endsWith(".missing") ||
        eventType.endsWith(".invalid")))
  ) {
    return "failed";
  }

  if (eventType === "agent.verification.passed") return "done";
  if (eventType === "agent.finished") return "testing";

  if (
    eventType === "agent.plan" ||
    eventType === "agent.started" ||
    eventType === "agent.accepted" ||
    eventType === "agent.workspace" ||
    eventType === "agent.waiting" ||
    eventType === "agent.no_progress" ||
    eventType === "agent.questions"
  ) {
    return "planning";
  }

  if (
    eventType.startsWith("agent.files.") ||
    eventType.startsWith("agent.assets.") ||
    eventType === "agent.reference" ||
    eventType === "agent.tool.started" ||
    eventType === "agent.tool.finished"
  ) {
    return "editing";
  }

  if (
    eventType === "agent.build.started" ||
    eventType === "agent.build.retrying" ||
    eventType === "agent.build.fixing" ||
    eventType === "agent.build.fixed" ||
    eventType === "agent.build.finished" ||
    eventType === "agent.build.log"
  ) {
    return "building";
  }

  if (
    eventType.startsWith("agent.rom.") ||
    eventType.startsWith("agent.screenshot.") ||
    eventType.startsWith("agent.input.") ||
    eventType.startsWith("agent.audio.") ||
    eventType.startsWith("project.memory.") ||
    eventType.startsWith("preview.audio.")
  ) {
    return "testing";
  }

  return undefined;
}

function isV1Prompt(text: string) {
  const normalized = text.toLowerCase();
  return (
    normalized.includes("sprite") &&
    normalized.includes("music") &&
    (normalized.includes("move") || normalized.includes("left") || normalized.includes("right"))
  );
}

function clarifyingReplyForBuildPrompt(text: string) {
  const normalized = text.toLowerCase().trim();
  if (!looksLikeBuildPrompt(normalized)) return undefined;
  if (shouldPreserveActiveProject(normalized)) return undefined;
  if (/just build|don't ask|do not ask|no questions|simple|basic/.test(normalized)) {
    return undefined;
  }
  if (mentionsKnownGameShape(normalized)) return undefined;
  if (!/\b(game|rom)\b/.test(normalized)) return undefined;

  return [
    "Before I build, give me a little direction:",
    "1. What genre or reference should it follow?",
    "2. What should the player control?",
    "3. Should I use primitive tiles first, or try generated sprites/music?",
  ].join("\n");
}

function defaultPlanForBuildPrompt(text: string, enabledEnhancements: EnhancementSettings) {
  const normalized = text.toLowerCase();
  if (shouldPreserveActiveProject(normalized)) {
    return "I’ll treat this as a follow-up on the current project: read the game notes, make the requested change in the active folder, rebuild, and check the screen/input/audio evidence before saying it worked.";
  }
  if (!looksLikeBuildPrompt(normalized)) return undefined;

  const assetPlan = [
    enabledEnhancements.spriteGeneration
      ? "ComfyUI sprites for the main game objects if the local generator is reachable"
      : "primitive or bundled sprites",
    enabledEnhancements.musicGeneration
      ? "a developed multi-part MML arrangement unless you asked for no music"
      : "no generated music unless enabled",
  ].join(", ");

  return `I’m starting the build with Drive16’s standard first-pass checklist: visible start state, working controls, score/state sanity, ${assetPlan}, build, screenshot check, input check, and audio check when sound is expected. Actual tool activity will appear in the build log.`;
}

// looksLikeBuildPrompt, mentionsKnownGameShape, shouldPreserveActiveProject,
// and classifyAgentIntent live in ./agent/promptIntent so the project-wipe
// routing stays unit-testable (scripts/verify-prompt-intent.mjs).

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
    if (connection.state === "ready") {
      return {
        state: openCode.state === "ready" ? "ready" : "warning",
        label: "Ollama local chat",
        detail:
          openCode.state === "ready"
            ? "Project questions use the selected local model. Build-tool compatibility is verified during each run."
            : "The local model is ready, but the build agent is reconnecting.",
      };
    }
    return {
      state: "warning",
      label: "Ollama not tested",
      detail: `${providerLabel} is ${connectionLabel(connection.state).toLowerCase()}. Test it in Settings.`,
    };
  }

  if (connection.state !== "ready") {
    if (!openRouterKeyPresent) {
      return {
        state: "missing",
        label: "OpenRouter key needed",
        detail: "Paste an API key in Settings; it stays on this machine.",
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
    return connection.state === "ready"
      ? undefined
      : `${providerLabel} is not ready yet (${connectionLabel(
          connection.state,
        ).toLowerCase()}). Open Settings and click Test Ollama, then send your message again.`;
  }

  if (!openRouterKeyPresent) {
    return "OpenRouter needs an API key before freeform chat can answer. Paste a BYOK key in Agent Settings and test it; the key stays on this machine and is not committed to the project. ROM-changing prompts still use the verified local build path.";
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

function modelReplyFailureMessage(provider: ModelProvider, detail: string) {
  if (provider === "openrouter") return openRouterReplyFailureMessage(detail);
  if (/model.*not found|not installed|404/i.test(detail)) {
    return `Ollama could not answer: ${detail}. Refresh the installed-model list in Settings.`;
  }
  if (/network|fetch|failed|timeout|load/i.test(detail)) {
    return `Ollama could not answer because the local request failed: ${detail}.`;
  }
  return `Ollama could not answer: ${detail}.`;
}

function guardUnverifiedModelReply(content: string) {
  if (!freeformReplyClaimsLocalProof(content)) return content;

  return [
    "I can’t treat that as verified because this was a freeform model reply, not a local Drive16 build.",
    "To prove a ROM works, Drive16 needs build, screen, input, and audio evidence from the local tools.",
    `Model draft: ${content}`,
  ].join("\n\n");
}

function freeformReplyClaimsLocalProof(content: string) {
  return content
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !/\b(no|not|never|failed|without|didn't|did not|couldn't|could not)\b/i.test(sentence))
    .some(
      (sentence) =>
        /\b(i|we|drive16|the agent)\b.*\b(built|compiled|verified|tested|exported|generated)\b/i.test(
          sentence,
        ) ||
        /\b(rom|build)\b.*\b(built|compiled)\b.*\bsuccessfully\b/i.test(sentence) ||
        /\b(build|rom|audio|screen|input)\b.*\b(successfully built|passed all|fully verified|ready to ship)\b/i.test(
          sentence,
        ),
    );
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
      label: projectSummary.name,
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

function canPlayActiveRom(activeRomSource: ActiveRomSource, projectSummary: ProjectSummary) {
  if (activeRomSource.kind === "imported") return true;
  if (activeRomSource.kind === "generated" && activeRomSource.path !== projectSummary.romPath) {
    return true;
  }
  return projectSummary.romStatus === "ready";
}

function projectAssetSummary(
  roles: ProjectAssetRole[],
  romKind: ActiveRomSource["kind"],
) {
  if (romKind === "imported") return "Assets: external ROM";

  const usedRoles = roles.filter(
    (role) =>
      /used|wired|captured|ready|included|complete|pass/i.test(role.status) &&
      !/planned|missing|failed|not used/i.test(role.status),
  );
  const sourceText = usedRoles
    .map((role) => `${role.role} ${role.source} ${role.notes}`)
    .join(" ")
    .toLowerCase();
  if (/comfyui|generated sprite|ai sprite/.test(sourceText)) return "Assets: ComfyUI art";
  if (/role-specific tile|custom tile|presentation_tiles/.test(sourceText)) {
    return "Assets: custom tile art";
  }
  if (/primitive|sgdk text|generic tile/.test(sourceText)) return "Assets: primitive art";
  if (/bundled|core pack/.test(sourceText)) return "Assets: bundled art";
  return "Assets: unknown";
}

function projectAudioAvailability(
  roles: ProjectAssetRole[],
  romKind: ActiveRomSource["kind"],
): boolean | undefined {
  if (romKind === "imported") return undefined;
  const audioRoles = roles.filter((role) =>
    /music|audio|sound|sfx|vgm|mml/i.test(
      `${role.role} ${role.source} ${role.symbol} ${role.notes}`,
    ),
  );
  if (audioRoles.length === 0) return false;
  return audioRoles.some((role) =>
    /used|wired|captured|ready|included|complete|pass/i.test(role.status),
  );
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

const streamedInteractiveCoreUrl =
  "https://cdn.jsdelivr.net/gh/arianrhodsandlot/retroarch-emscripten-build@v1.22.2/retroarch/genesis_plus_gx_libretro.zip";

async function downloadStreamedInteractiveCore(): Promise<LoadedInteractiveCore> {
  const response = await fetch(streamedInteractiveCoreUrl);
  if (!response.ok) {
    throw new Error(`Could not download the Play core (HTTP ${response.status}).`);
  }

  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(await response.arrayBuffer()));
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Could not unpack the Play core: ${error.message}`
        : "Could not unpack the Play core.",
    );
  }

  const files = selectInteractiveCorePair(
    Object.entries(entries)
      .filter(([name, bytes]) => !name.endsWith("/") && bytes.byteLength > 0)
      .map(([name, bytes]) => ({
        fileName: name.split("/").filter(Boolean).pop() ?? name,
        bytes,
      })),
    true,
  );
  const jsFile = files.find((file) => interactiveCoreStorageExtension(file.fileName) === ".js");
  const wasmFile = files.find(
    (file) => interactiveCoreStorageExtension(file.fileName) === ".wasm",
  );
  if (!jsFile || !wasmFile) {
    throw new Error("The downloaded Play core did not contain a JS/WASM pair.");
  }

  return loadedInteractiveCoreFromBytes(
    GENESIS_PLUS_GX_CORE,
    `streamed/${jsFile.fileName}`,
    `streamed/${wasmFile.fileName}`,
    jsFile.bytes,
    wasmFile.bytes,
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
    trustStage: "built",
    reviewDetail: "Imported ROM behavior has not been reviewed by Drive16",
    assetRoles: [
      {
        role: "Imported ROM",
        source: "External file",
        symbol: result.importPath,
        status: "Unknown",
        notes: "Asset and sound sources are inside the imported ROM and are not audited by Drive16.",
      },
    ],
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

function projectSummaryFromActiveProject(
  project: ActiveProject,
  name = "Untitled Project",
): ProjectSummary {
  const romStatus: HealthState = project.romExists
    ? "ready"
    : project.status === "stale"
      ? "warning"
      : "missing";
  return {
    generatedAt: project.generatedAt,
    name,
    projectPath: project.projectPath,
    romPath: project.romPath,
    exportDirectory: previewProjectSummary.exportDirectory,
    romStatus,
    romDetail: project.detail,
    trustStage: project.romExists ? "built" : "prototype",
    reviewDetail: project.romExists
      ? "ROM built; semantic playability and visible quality review are pending"
      : "No ROM has been built or reviewed",
    assetRoles: [
      {
        role: "Project assets",
        source: "ASSETS.md",
        symbol: `${project.projectPath}/ASSETS.md`,
        status: "Needs refresh",
        notes: "Native summary will parse the role ledger after the project is loaded.",
      },
    ],
    files: [
      {
        label: "Main C",
        path: `${project.projectPath}/src/main.c`,
        state: "ready",
      },
      {
        label: "Resources",
        path: `${project.projectPath}/res/resources.res`,
        state: "ready",
      },
      {
        label: "ROM",
        path: project.romPath,
        state: romStatus,
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
    trustStage: "built",
    reviewDetail: "Saved project review state must be refreshed after opening",
    assetRoles: [
      {
        role: "Saved project assets",
        source: "ASSETS.md",
        symbol: `${snapshot.projectPath}/ASSETS.md`,
        status: "Needs refresh",
        notes: "Open the saved project to parse its current role ledger.",
      },
    ],
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

function projectNameFromPrompt(prompt: string) {
  const lower = prompt.toLowerCase();
  const knownGames: Array<[string, string]> = [
    ["missile command", "Missile Command"],
    ["snake", "Snake"],
    ["asteroids", "Asteroids"],
    ["asteroid", "Asteroids"],
    ["pong", "Pong"],
    ["breakout", "Breakout"],
    ["tetris", "Tetris"],
    ["space invaders", "Space Invaders"],
    ["platformer", "Platformer"],
  ];
  const match = knownGames.find(([needle]) => lower.includes(needle));
  if (match) return match[1];

  const cleaned = prompt
    .replace(/^(please\s+)?(make|create|build|write|generate)\s+(a|an|the)?\s*/i, "")
    .replace(/\b(simple|basic|version|game|of|for|the|sega|genesis)\b/gi, " ")
    .replace(/[^a-z0-9\s-]/gi, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .join(" ");
  if (!cleaned) return "Untitled Project";
  return cleaned.replace(/\b\w/g, (letter) => letter.toUpperCase());
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
    blob,
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

async function browserComfyUiEndpointStatus(endpoint: string): Promise<ComfyUiEndpointStatus> {
  const baseUrl = normalizeComfyUiEndpoint(endpoint);
  const systemStatsUrl = `${baseUrl}/system_stats`;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch("/__drive16_comfyui/system_stats", {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = (await response.json()) as { devices?: unknown[] };
    const devices = Array.isArray(payload.devices) ? payload.devices.length : 0;
    return {
      generatedAt: Date.now().toString(),
      state: "ready",
      detail: "ComfyUI API is reachable from the browser build workflow.",
      baseUrl,
      systemStatsUrl,
      devices,
      checks: [
        {
          name: "API",
          state: "ready",
          detail: `ComfyUI responded${devices ? ` with ${devices} device${devices === 1 ? "" : "s"}` : ""}.`,
        },
      ],
    };
  } catch (error) {
    const detail =
      error instanceof DOMException && error.name === "AbortError"
        ? "ComfyUI did not respond within 5 seconds."
        : `ComfyUI could not be reached: ${error instanceof Error ? error.message : "unknown error"}`;
    return {
      generatedAt: Date.now().toString(),
      state: "missing",
      detail,
      baseUrl,
      systemStatsUrl,
      devices: 0,
      checks: [{ name: "API", state: "missing", detail }],
    };
  } finally {
    window.clearTimeout(timeout);
  }
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
