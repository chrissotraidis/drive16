import {
  Activity,
  AlertCircle,
  Box,
  CheckCircle2,
  Circle,
  Code2,
  Download,
  FolderTree,
  Gamepad2,
  KeyRound,
  Maximize2,
  MessageSquareText,
  Pause,
  Play,
  RefreshCcw,
  Send,
  Settings,
  Square,
  TerminalSquare,
  Wrench,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import type { ReactNode } from "react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type BuildState = "idle" | "building" | "running" | "error";
type TransportState = "running" | "paused";

type Message = {
  id: number;
  role: "user" | "agent";
  body: string;
  time: string;
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

type DecodedFramebufferFrame = {
  frameIndex: number;
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
};

const starterMessages: Message[] = [
  {
    id: 1,
    role: "agent",
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
    body: "I will wire the bundled sprite and loop, build, run, then verify the frame.",
    time: "09:42",
  },
];

const projectFiles = [
  "src/main.c",
  "res/resources.res",
  "assets/core/player.png",
  "assets/core/loop.vgm",
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
  const [openCode, setOpenCode] = useState<OpenCodeBridgeStatus>(previewOpenCode);
  const [openCodeSource, setOpenCodeSource] = useState("checking");
  const [openCodeSessionId, setOpenCodeSessionId] = useState<string | undefined>();
  const [openCodeEvents, setOpenCodeEvents] = useState<OpenCodeEvent[]>([]);
  const [openCodeBusy, setOpenCodeBusy] = useState(false);
  const messageIdRef = useRef(starterMessages.length + 1);
  const openCodeEventIdRef = useRef(1);

  useEffect(() => {
    void refreshPreflight();
    void launchStarterRom();
    void connectOpenCode();
  }, []);

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
        label: "Model reply",
        detail: "Enabled after settings key and model selection",
        state: "queued",
      },
    ];
  }, [openCode, openCodeEvents, openCodeSessionId]);

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;

    const userMessage = makeMessage("user", trimmed);
    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setOpenCodeBusy(true);

    try {
      const result = await sendOpenCodeMessage(trimmed);
      setOpenCodeSessionId(result.sessionId);
      const agentMessage = makeMessage(
        "agent",
        `Posted to OpenCode session ${shortIdentifier(result.sessionId)}. Live model replies turn on in the settings step.`,
      );
      setMessages((current) => [...current, agentMessage]);
      appendOpenCodeEvent("message.posted", result.detail);
      setBuildState("running");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "OpenCode message send failed";
      const agentMessage = makeMessage(
        "agent",
        `OpenCode bridge could not send that yet. ${detail}`,
      );
      setMessages((current) => [...current, agentMessage]);
      appendOpenCodeEvent("message.failed", detail);
      setBuildState("error");
    } finally {
      setOpenCodeBusy(false);
    }
  }

  function makeMessage(role: Message["role"], body: string): Message {
    const id = messageIdRef.current;
    messageIdRef.current += 1;
    return {
      id,
      role,
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

  function resetPreview() {
    setTransport("running");
    setBuildState("running");
    setSpriteX(52);
    void launchStarterRom();
  }

  async function refreshPreflight() {
    setPreflightSource("checking");

    if (!isTauriRuntime()) {
      setPreflight(previewPreflight);
      setPreflightSource("preview");
      return;
    }

    try {
      const report = await invoke<PreflightReport>("run_preflight");
      setPreflight(report);
      setPreflightSource("tauri");
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
    }
  }

  async function launchStarterRom() {
    setStarterBusy(true);
    setStarterSource("checking");

    if (!isTauriRuntime()) {
      setStarterRom(makePreviewStarterRom());
      setStarterSource("preview");
      setStarterBusy(false);
      return;
    }

    setBuildState("building");
    try {
      const preview = await invoke<StarterRomPreview>("launch_starter_rom");
      setStarterRom(preview);
      setStarterSource("tauri");
      setBuildState("running");
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
    } finally {
      setStarterBusy(false);
    }
  }

  return (
    <main className="app-shell">
      <TopBar buildLabel={buildLabel} buildState={buildState} />

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
              <button className="icon-button" aria-label="Agent settings">
                <Settings size={18} />
              </button>
            </div>
          </div>

          <div className="messages" aria-label="Message history">
            {messages.map((message) => (
              <article className={`message ${message.role}`} key={message.id}>
                <div className="message-meta">
                  <span>{message.role === "agent" ? "Agent" : "You"}</span>
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
              <ul>
                {projectFiles.map((file) => (
                  <li key={file}>
                    <Code2 size={14} />
                    <span>{file}</span>
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
              <h2>Starter Project</h2>
            </div>
            <div className="toolbar-actions" aria-label="Emulator actions">
              <IconControl
                label={transport === "running" ? "Pause emulator" : "Resume emulator"}
                onClick={() =>
                  setTransport(transport === "running" ? "paused" : "running")
                }
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
              <IconControl label="Fullscreen">
                <Maximize2 size={18} />
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
                <strong title={starterRom.romPath}>{shortPath(starterRom.romPath)}</strong>
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
                <span>{summaryLabel(preflight.summaryState)}</span>
                <small>{sourceLabel(preflightSource)}</small>
              </div>
              <div className="health-list" data-testid="tool-health-list">
                {preflight.checks.map((tool) => (
                  <div className={`health-item ${tool.state}`} key={tool.name}>
                    <span>{tool.name}</span>
                    <strong>{stateLabel(tool.state)}</strong>
                    <small>{tool.detail}</small>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>
      </section>
    </main>
  );
}

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function summaryLabel(state: HealthState) {
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

function TopBar({
  buildLabel,
  buildState,
}: {
  buildLabel: string;
  buildState: BuildState;
}) {
  return (
    <header className="top-bar">
      <div className="brand">
        <Box size={22} />
        <div>
          <strong>Drive16</strong>
          <span>Phase 3 shell</span>
        </div>
      </div>

      <div className="top-center">
        <span className={`status-pill ${buildState}`}>
          <Square size={10} />
          {buildLabel}
        </span>
        <button className="model-select" type="button">
          <KeyRound size={16} />
          OpenRouter Claude Sonnet
        </button>
      </div>

      <nav className="top-actions" aria-label="Project actions">
        <button type="button">
          <Play size={16} />
          Run
        </button>
        <button type="button">
          <Download size={16} />
          Export ROM
        </button>
      </nav>
    </header>
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
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export default App;
