import { ChevronLeft, ChevronRight, Loader2, Send } from "lucide-react";
import type { FormEvent, MutableRefObject } from "react";
import { useEffect, useRef } from "react";

type ChatMessage = {
  id: number;
  role: "user" | "agent";
  source?: string;
  body: string;
  time: string;
};

type BuildLogEvent = {
  id: number;
  type: string;
  detail: string;
  time: string;
};

type HeartbeatStatus = {
  active: boolean;
  time: string;
};

export function ChatRail({
  activityNote,
  agentPhaseLabel,
  buildEvents,
  heartbeat,
  rawBuildEvents,
  busy,
  collapsed,
  draft,
  messages,
  messagesRef,
  composerInputRef,
  providerSetupHint,
  sendDisabled,
  onDraftChange,
  onOpenSettings,
  onSubmit,
  onToggleCollapse,
}: {
  activityNote: string;
  agentPhaseLabel: string;
  buildEvents: BuildLogEvent[];
  heartbeat: HeartbeatStatus;
  rawBuildEvents: BuildLogEvent[];
  busy: boolean;
  collapsed: boolean;
  draft: string;
  messages: ChatMessage[];
  messagesRef: MutableRefObject<HTMLDivElement | null>;
  composerInputRef: MutableRefObject<HTMLInputElement | null>;
  providerSetupHint: string;
  sendDisabled: boolean;
  onDraftChange: (value: string) => void;
  onOpenSettings: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onToggleCollapse: () => void;
}) {
  const visibleBuildEvents = buildEvents
    .filter((event) => !isHeartbeatEvent(event))
    .slice(-12);
  const visibleRawEvents = rawBuildEvents.slice(-24);
  const buildLogItemsRef = useRef<HTMLDivElement | null>(null);
  const latestVisibleBuildEventId = visibleBuildEvents[visibleBuildEvents.length - 1]?.id;

  useEffect(() => {
    const element = buildLogItemsRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
  }, [latestVisibleBuildEventId]);

  if (collapsed) {
    return (
      <aside className="chat-rail collapsed" aria-label="Conversation collapsed">
        <button
          className="rail-toggle"
          type="button"
          aria-label="Show conversation"
          onClick={onToggleCollapse}
        >
          <ChevronRight size={16} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="chat-rail" aria-label="Conversation">
      <div className="chat-rail-header">
        <span className="chat-title">Chat</span>
        <button
          className="rail-toggle"
          type="button"
          aria-label="Hide conversation"
          onClick={onToggleCollapse}
        >
          <ChevronLeft size={16} />
        </button>
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

      <div className="chat-build-log" aria-label="Build activity" data-testid="chat-build-log">
        <div className="chat-build-log-header">
          <span>Build log</span>
          {heartbeat.active ? (
            <small
              className="heartbeat-status"
              data-testid="opencode-heartbeat-status"
              title="OpenCode is still connected and sending heartbeat events"
            >
              <span aria-hidden="true" />
              OpenCode heartbeat active {heartbeat.time}
            </small>
          ) : busy ? (
            <small>Live</small>
          ) : (
            <small>Recent</small>
          )}
        </div>
        {visibleBuildEvents.length > 0 ? (
          <div className="chat-build-log-items" ref={buildLogItemsRef}>
            {visibleBuildEvents.map((event) => (
              <p key={event.id}>
                <time>{event.time}</time>
                <b>{friendlyEventType(event.type)}</b>
                <small>{event.detail}</small>
              </p>
            ))}
          </div>
        ) : null}
        <details className="chat-raw-log" data-testid="chat-raw-log">
          <summary>
            Raw log
            <span>{rawBuildEvents.length}</span>
          </summary>
          {visibleRawEvents.length > 0 ? (
            <div className="chat-raw-log-items">
              {visibleRawEvents.map((event) => (
                <p key={event.id}>
                  <time>{event.time}</time>
                  <b>{event.type}</b>
                  <small>{event.detail}</small>
                </p>
              ))}
            </div>
          ) : null}
        </details>
      </div>

      <div className="composer-dock">
        {busy ? (
          <div className="agent-activity" data-testid="agent-activity">
            <Loader2 size={14} className="spin" aria-hidden="true" />
            {agentPhaseLabel ? <b>{agentPhaseLabel}</b> : null}
            <span>{activityNote}</span>
          </div>
        ) : null}
        {providerSetupHint ? (
          <button className="composer-hint" type="button" onClick={onOpenSettings}>
            {providerSetupHint}
          </button>
        ) : null}
        <form className="composer" onSubmit={onSubmit}>
          <input
            ref={composerInputRef}
            aria-label="Message Drive16"
            placeholder="Describe what to build…"
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
          />
          <button aria-label="Send message" type="submit" disabled={sendDisabled}>
            <Send size={16} />
          </button>
        </form>
      </div>
    </aside>
  );
}

function messageMetaLabel(message: ChatMessage) {
  return message.role === "user" ? "You" : "Drive16";
}

function friendlyEventType(type: string) {
  const labels: Record<string, string> = {
    "agent.activity": "Agent",
    "agent.files.reading": "Files",
    "agent.files.read": "Files",
    "agent.files.editing": "Files",
    "agent.files.edited": "Files",
    "agent.files.edit.failed": "Files",
    "agent.files.search": "Files",
    "agent.build.started": "Build",
    "agent.build.retrying": "Build",
    "agent.build.fixing": "Fix",
    "agent.build.fixed": "Fixed",
    "agent.build.finished": "Build",
    "agent.build.failed": "Build",
    "agent.build.log": "Build",
    "agent.rom.run": "ROM",
    "agent.rom.ran": "ROM",
    "agent.rom.failed": "ROM",
    "agent.input.testing": "Input",
    "agent.input.tested": "Input",
    "agent.input.failed": "Input",
    "agent.screenshot.checking": "Screen",
    "agent.screenshot.checked": "Screen",
    "agent.screenshot.failed": "Screen",
    "agent.audio.checking": "Audio",
    "agent.audio.checked": "Audio",
    "agent.audio.failed": "Audio",
    "agent.assets.sprite.started": "Sprites",
    "agent.assets.sprite.finished": "Sprites",
    "agent.assets.sprite.failed": "Sprites",
    "agent.assets.sprite.validating": "Sprites",
    "agent.assets.sprite.validated": "Sprites",
    "agent.assets.sprite.invalid": "Sprites",
    "agent.assets.music.started": "Music",
    "agent.assets.music.finished": "Music",
    "agent.assets.music.failed": "Music",
    "agent.questions": "Questions",
    "agent.finished": "Testing",
    "agent.verification.passed": "Verified",
    "agent.verification.failed": "Verify",
    "agent.plan": "Plan",
    "agent.started": "Started",
    "agent.workspace": "Project",
    "agent.reply": "Reply",
    "agent.accepted": "Accepted",
    "agent.no_progress": "Waiting",
    "agent.stalled": "Stalled",
    "agent.rom.built": "ROM",
    "agent.rom.ready": "ROM",
    "agent.rom.missing": "ROM",
    "agent.rom.stale": "ROM",
    "agent.failed": "Error",
    "agent.waiting": "Waiting",
    "agent.refresh.failed": "Error",
    "project.active.rom": "Project",
    "project.active.stale": "Project",
    "project.memory.ready": "Memory",
    "project.memory.warning": "Memory",
    "project.memory.missing": "Memory",
    "project.memory.failed": "Memory",
    "sse.open": "Connected",
    "sse.connecting": "Connecting",
    "sse.waiting": "Waiting",
    "server.ready": "Server",
    "server.warning": "Server",
    "session.status": "Status",
    "message.part.updated": "Update",
    "message.model.guarded": "Guarded",
    "comfyui.ready": "Sprites",
    "comfyui.warning": "Sprites",
    "comfyui.missing": "Sprites",
    "comfyui.failed": "Sprites",
    "enhancement.enabled": "Enabled",
    "enhancement.disabled": "Disabled",
    "player.playing": "Player",
    "player.audio": "Audio",
    "player.audio.failed": "Audio",
    "player.audio.needs_gesture": "Audio",
    "player.audio.unavailable": "Audio",
    "player.failed": "Player",
    "player.blank": "Player",
    "player.screen.visible": "Screen",
    "player.screen.inconclusive": "Screen",
    "player.screen.unverified": "Screen",
    "preview.audio.captured": "Audio",
    "preview.audio.silent": "Audio",
  };
  return labels[type] ?? type.split(".").pop() ?? type;
}

function isHeartbeatEvent(event: BuildLogEvent) {
  return (
    event.type.toLowerCase().includes("heartbeat") ||
    event.detail.toLowerCase().includes("heartbeat")
  );
}
