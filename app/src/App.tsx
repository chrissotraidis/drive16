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
import { FormEvent, useEffect, useMemo, useState } from "react";

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

const initialSteps: ToolStep[] = [
  {
    label: "Query docs",
    detail: "SGDK sprite and XGM patterns",
    state: "done",
  },
  {
    label: "Write C",
    detail: "player movement and music loop",
    state: "done",
  },
  {
    label: "Build ROM",
    detail: "docker-sgdk through MCP",
    state: "active",
  },
  {
    label: "Run emulator",
    detail: "Genteel sidecar frame stream",
    state: "queued",
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

function App() {
  const [messages, setMessages] = useState<Message[]>(starterMessages);
  const [draft, setDraft] = useState("");
  const [buildState, setBuildState] = useState<BuildState>("running");
  const [transport, setTransport] = useState<TransportState>("running");
  const [spriteX, setSpriteX] = useState(52);
  const [preflight, setPreflight] = useState<PreflightReport>(previewPreflight);
  const [preflightSource, setPreflightSource] = useState("checking");

  useEffect(() => {
    void refreshPreflight();
  }, []);

  const buildLabel = useMemo(() => {
    if (buildState === "building") return "Building";
    if (buildState === "running") return "Running";
    if (buildState === "error") return "Error";
    return "Idle";
  }, [buildState]);

  function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;

    const nextId = messages.length + 1;
    setMessages([
      ...messages,
      {
        id: nextId,
        role: "user",
        body: trimmed,
        time: "Now",
      },
      {
        id: nextId + 1,
        role: "agent",
        body: "Queued. I will build and verify this through the core tool loop.",
        time: "Now",
      },
    ]);
    setDraft("");
    setBuildState("building");
  }

  function resetPreview() {
    setTransport("running");
    setBuildState("running");
    setSpriteX(52);
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
            <button className="icon-button" aria-label="Agent settings">
              <Settings size={18} />
            </button>
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
                {initialSteps.map((step) => (
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
            <button aria-label="Send message" type="submit">
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
              <IconControl label="Reset" onClick={resetPreview}>
                <RefreshCcw size={18} />
              </IconControl>
              <IconControl label="Fullscreen">
                <Maximize2 size={18} />
              </IconControl>
            </div>
          </div>

          <div className="emulator-frame">
            <div className="screen-bezel">
              <div className={`genesis-screen ${transport}`}>
                <div className="scanlines" />
                <span className="screen-title">DRIVE16 BLANK ROM</span>
                <span className="screen-status">
                  {transport === "running" ? "RUNNING" : "PAUSED"}
                </span>
                <span
                  className="sprite-cursor"
                  style={{ left: `${spriteX}%` }}
                  aria-hidden="true"
                />
              </div>
            </div>
          </div>

          <div className="status-grid">
            <section className="runtime-panel" aria-label="Runtime status">
              <SectionTitle icon={<Gamepad2 size={16} />} title="Controls" />
              <div className="control-row">
                <button
                  aria-label="Move left"
                  onClick={() => setSpriteX((value) => Math.max(12, value - 8))}
                >
                  Left
                </button>
                <button
                  aria-label="Move right"
                  onClick={() => setSpriteX((value) => Math.min(88, value + 8))}
                >
                  Right
                </button>
                <span>60 fps</span>
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

function sourceLabel(source: string) {
  if (source === "tauri") return "Native preflight";
  if (source === "checking") return "Checking";
  if (source === "error") return "Command unavailable";
  return "Preview mode";
}

function healthIcon(state: HealthState) {
  if (state === "ready") return <CheckCircle2 size={15} />;
  if (state === "missing") return <AlertCircle size={15} />;
  return <Activity size={15} />;
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
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button className="icon-button" type="button" aria-label={label} onClick={onClick}>
      {children}
    </button>
  );
}

export default App;
