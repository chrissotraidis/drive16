import {
  Eye,
  EyeOff,
  KeyRound,
  RefreshCcw,
  Settings,
  ShieldCheck,
  TerminalSquare,
  Wrench,
  X,
} from "lucide-react";
import {
  connectionIcon,
  connectionLabel,
  defaultComfyUiCheckpoint,
  defaultComfyUiLora,
  healthIcon,
  SectionTitle,
  shortOllamaLabel,
  type ConnectionState,
  type HealthState,
} from "./ui";

type ModelProvider = "openrouter" | "ollama";

type ModelOption = { id: string; name: string };

type ModelConnectionReport = {
  state: ConnectionState;
  detail: string;
  baseUrl?: string;
  model?: string;
  models?: string[];
};

type HealthCheckItem = {
  name: string;
  state: HealthState;
  detail: string;
  hints?: string[];
};

type ComfyUiStatus = {
  state: ConnectionState;
  detail: string;
  version?: string;
  devices: number;
  checks: HealthCheckItem[];
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
};

type OpenCodeStatus = {
  state: HealthState;
  detail: string;
  baseUrl: string;
  version?: string;
};

type OpenCodeEventItem = {
  id: number;
  type: string;
  detail: string;
  time: string;
};

export function SettingsPanel({
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
  openCode,
  openCodeEvents,
  openCodeSource,
  openRouterKey,
  preflightBusy,
  preflightChecks,
  showOpenRouterKey,
  onClose,
  onComfyUiCheckpointChange,
  onComfyUiEndpointChange,
  onComfyUiLoraChange,
  onEnhancementChange,
  onLaunchComfyUi,
  onModelChange,
  onOllamaEndpointChange,
  onOllamaModelChange,
  onOpenRouterKeyChange,
  onProviderChange,
  onRefreshModels,
  onRefreshPreflight,
  onShowOpenRouterKeyChange,
  onTestComfyUiConnection,
  onTestConnection,
}: {
  activeModel: string;
  comfyUiCheckpoint: string;
  comfyUiConnection: ComfyUiStatus;
  comfyUiEndpoint: string;
  comfyUiLora: string;
  connection: ModelConnectionReport;
  enhancements: EnhancementSettings;
  modelOptions: ModelOption[];
  modelProvider: ModelProvider;
  modelsSource: string;
  ollamaEndpoint: string;
  ollamaModel: string;
  openCode: OpenCodeStatus;
  openCodeEvents: OpenCodeEventItem[];
  openCodeSource: string;
  openRouterKey: string;
  preflightBusy: boolean;
  preflightChecks: HealthCheckItem[];
  showOpenRouterKey: boolean;
  onClose: () => void;
  onComfyUiCheckpointChange: (value: string) => void;
  onComfyUiEndpointChange: (value: string) => void;
  onComfyUiLoraChange: (value: string) => void;
  onEnhancementChange: (key: keyof EnhancementSettings, enabled: boolean) => void;
  onLaunchComfyUi: () => void;
  onModelChange: (value: string) => void;
  onOllamaEndpointChange: (value: string) => void;
  onOllamaModelChange: (value: string) => void;
  onOpenRouterKeyChange: (value: string) => void;
  onProviderChange: (value: ModelProvider) => void;
  onRefreshModels: () => void;
  onRefreshPreflight: () => void;
  onShowOpenRouterKeyChange: (value: boolean) => void;
  onTestComfyUiConnection: () => void;
  onTestConnection: () => void;
}) {
  const testing = connection.state === "testing";
  const busyComfyUi =
    comfyUiConnection.state === "testing" || comfyUiConnection.state === "starting";
  const spriteReadiness = spriteEnhancementReadiness(
    enhancements.spriteGeneration,
    comfyUiConnection,
    comfyUiCheckpoint,
    comfyUiLora,
  );
  const musicReadiness = musicEnhancementReadiness(enhancements.musicGeneration);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        aria-label="Settings"
        aria-modal="true"
        className="settings-panel"
        data-testid="settings-panel"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="settings-header">
          <h2>Settings</h2>
          <button
            className="icon-button"
            type="button"
            aria-label="Close settings"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <div className="settings-body">
          <section className="settings-section" aria-label="Model">
            <SectionTitle icon={<Settings size={16} />} title="Model" />
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

            {modelProvider === "openrouter" ? (
              <div
                className="provider-fields"
                aria-label="OpenRouter settings"
                data-testid="openrouter-settings"
              >
                <label className="field-row">
                  <span>Model</span>
                  <div className="field-with-action">
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
                    <button
                      className="icon-button"
                      type="button"
                      aria-label="Refresh OpenRouter models"
                      onClick={onRefreshModels}
                      disabled={modelsSource === "loading"}
                    >
                      <RefreshCcw size={14} />
                    </button>
                  </div>
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
              </div>
            ) : (
              <div
                className="provider-fields"
                aria-label="Ollama settings"
                data-testid="ollama-settings"
              >
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
                {connection.models?.length ? (
                  <div className="provider-model-list" data-testid="ollama-models">
                    <span>Installed models</span>
                    <strong title={connection.models.join(", ")}>
                      {connection.models.slice(0, 3).map(shortOllamaLabel).join(", ")}
                    </strong>
                  </div>
                ) : null}
              </div>
            )}
          </section>

          <section className="settings-section" aria-label="Build options">
            <SectionTitle icon={<Wrench size={16} />} title="Build options" />
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
                  <small>Generated pixel art (optional)</small>
                </span>
                <span className={`toggle-status ${spriteReadiness.state}`}>
                  {spriteReadiness.label}
                </span>
              </label>
              <p className="enhancement-line" data-testid="sprite-readiness">
                {spriteReadiness.detail}
              </p>

              {enhancements.spriteGeneration ? (
                <>
                  <div className="enhancement-actions" data-testid="comfyui-config">
                    <button
                      aria-label="Launch ComfyUI"
                      data-testid="launch-comfyui"
                      disabled={busyComfyUi}
                      onClick={onLaunchComfyUi}
                      type="button"
                    >
                      <TerminalSquare size={15} />
                      {comfyUiConnection.state === "starting" ? "Starting" : "Launch sprite tools"}
                    </button>
                    <button
                      aria-label="Test ComfyUI"
                      data-testid="test-comfyui"
                      disabled={busyComfyUi}
                      onClick={onTestComfyUiConnection}
                      type="button"
                    >
                      <ShieldCheck size={15} />
                      {comfyUiConnection.state === "testing" ? "Checking" : "Test"}
                    </button>
                  </div>
                  <details className="settings-disclosure" data-testid="advanced-sprite-setup">
                    <summary>
                      <Settings size={16} />
                      <span>
                        <strong>Advanced sprite setup</strong>
                        <small>Endpoint, model, and LoRA</small>
                      </span>
                    </summary>
                <div className="comfyui-config">
                  <label className="field-row">
                    <span>ComfyUI endpoint</span>
                    <input
                      aria-label="ComfyUI endpoint"
                      autoComplete="off"
                      data-testid="comfyui-endpoint-input"
                      onChange={(event) => onComfyUiEndpointChange(event.target.value)}
                      spellCheck={false}
                      type="url"
                      value={comfyUiEndpoint}
                    />
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
                </div>
                  </details>
                </>
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
                  <strong>Original music</strong>
                  <small>Generated locally with MML</small>
                </span>
                <span className={`toggle-status ${musicReadiness.state}`}>
                  {musicReadiness.label}
                </span>
              </label>
              <p className="enhancement-line" data-testid="music-readiness">
                {musicReadiness.detail}
              </p>
            </div>
          </section>

          <details className="settings-disclosure settings-advanced" data-testid="advanced-settings">
            <summary>
              <Settings size={16} />
              <span>
                <strong>Advanced</strong>
                <small>Local tools, paths, and diagnostics</small>
              </span>
            </summary>
            <div className="settings-advanced-body">
          <section className="settings-section" aria-label="Setup">
            <div className="settings-section-title">
              <SectionTitle icon={<Wrench size={16} />} title="Setup" />
              <button
                className="icon-button"
                type="button"
                aria-label="Refresh setup checks"
                data-testid="refresh-health"
                onClick={onRefreshPreflight}
                disabled={preflightBusy}
              >
                <RefreshCcw size={14} />
              </button>
            </div>
            <div className="setup-list" data-testid="tool-health-list">
              {preflightChecks.map((tool) => (
                <div className={`setup-item ${tool.state}`} key={tool.name}>
                  {healthIcon(tool.state)}
                  <span>
                    <strong>{tool.name}</strong>
                    <small>{tool.detail}</small>
                  </span>
                </div>
              ))}
            </div>
          </section>

          <details className="settings-disclosure" data-testid="diagnostics">
            <summary>
              <TerminalSquare size={16} />
              <span>
                <strong>Diagnostics</strong>
                <small>Bridge status and recent events</small>
              </span>
            </summary>
            <section className="settings-section settings-section-inner" aria-label="Diagnostics">
              <div
                className={`connection-summary ${openCode.state}`}
                data-testid="opencode-bridge-status"
              >
                {healthIcon(openCode.state)}
                <span>OpenCode {openCode.state === "ready" ? "connected" : "not connected"}</span>
                <small>{openCode.detail}</small>
              </div>
              <div className="settings-meta">
                <span>{openCode.baseUrl}</span>
                <strong>{openCode.version ?? openCodeSource}</strong>
              </div>
              <div className="event-feed" data-testid="opencode-event-feed">
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
                    <span>{openCodeSource}</span>
                    <b>{openCode.state === "ready" ? "ready" : "waiting"}</b>
                    <small>{openCode.detail}</small>
                  </p>
                )}
              </div>
            </section>
          </details>
            </div>
          </details>
        </div>

        <div className="settings-footer">
          <span className="settings-footer-note">Settings apply immediately.</span>
          <button type="button" onClick={onClose}>
            Done
          </button>
          <button
            className="primary-action"
            type="button"
            onClick={onTestConnection}
            disabled={testing}
          >
            <KeyRound size={15} />
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

function spriteEnhancementReadiness(
  enabled: boolean,
  connection: ComfyUiStatus,
  checkpoint: string,
  lora: string,
): EnhancementReadiness {
  if (!enabled) {
    return {
      state: "disabled",
      label: "Off",
      detail: "Enable to generate sprites with a local ComfyUI.",
    };
  }

  if (connection.state === "testing") {
    return {
      state: "running",
      label: "Checking",
      detail: "Checking the ComfyUI endpoint, checkpoint, and LoRA.",
    };
  }

  if (connection.state === "starting") {
    return {
      state: "running",
      label: "Starting",
      detail: connection.detail,
    };
  }

  if (connection.state === "ready") {
    return {
      state: "ready",
      label: "Ready",
      detail: `${checkpoint || defaultComfyUiCheckpoint} with ${lora || defaultComfyUiLora}`,
    };
  }

  const missingChecks = missingComfyUiChecks(connection);
  const missingModel = missingChecks.includes("Checkpoint");
  const missingLora = missingChecks.includes("LoRA");
  const apiDown =
    missingChecks.includes("API") || /not running|failed to fetch|connection refused/i.test(connection.detail);

  if (connection.state === "missing") {
    if (apiDown) {
      return {
        state: "failed",
        label: "Not running",
        detail: connection.detail,
      };
    }

    return {
      state: "failed",
      label: "Failed",
      detail: connection.detail,
    };
  }

  if (missingModel || missingLora) {
    const label =
      missingModel && missingLora
        ? "Missing model + LoRA"
        : missingModel
          ? "Missing model"
          : "Missing LoRA";
    const detail = missingChecks
      .filter((name) => name === "Checkpoint" || name === "LoRA")
      .map((name) => {
        const check = connection.checks.find((item) => item.name === name);
        return check ? `${name}: ${check.detail}` : name;
      })
      .join("; ");

    return {
      state: "needsSetup",
      label,
      detail: detail || connection.detail,
    };
  }

  return {
    state: "needsSetup",
    label: "Needs setup",
    detail:
      connection.detail === "Not tested"
        ? "Set the endpoint, then run Test."
        : connection.detail,
  };
}

function missingComfyUiChecks(connection: ComfyUiStatus) {
  return connection.checks
    .filter((check) => check.state !== "ready")
    .map((check) => check.name);
}

function musicEnhancementReadiness(enabled: boolean): EnhancementReadiness {
  if (!enabled) {
    return {
      state: "disabled",
      label: "Off",
      detail: "Enable to compose music from MML prompts.",
    };
  }

  return {
    state: "ready",
    label: "Enabled",
    detail: "Local MML music is enabled for chat builds.",
  };
}
