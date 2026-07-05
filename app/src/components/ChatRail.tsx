import { ChevronLeft, ChevronRight, Loader2, Send } from "lucide-react";
import type { FormEvent, MutableRefObject } from "react";

type ChatMessage = {
  id: number;
  role: "user" | "agent";
  source?: string;
  body: string;
  time: string;
};

export function ChatRail({
  activityNote,
  busy,
  collapsed,
  draft,
  messages,
  messagesRef,
  needsProviderSetup,
  sendDisabled,
  onDraftChange,
  onOpenSettings,
  onSubmit,
  onToggleCollapse,
}: {
  activityNote: string;
  busy: boolean;
  collapsed: boolean;
  draft: string;
  messages: ChatMessage[];
  messagesRef: MutableRefObject<HTMLDivElement | null>;
  needsProviderSetup: boolean;
  sendDisabled: boolean;
  onDraftChange: (value: string) => void;
  onOpenSettings: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onToggleCollapse: () => void;
}) {
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

      <div className="composer-dock">
        {busy ? (
          <div className="agent-activity" data-testid="agent-activity">
            <Loader2 size={14} className="spin" aria-hidden="true" />
            <span>{activityNote}</span>
          </div>
        ) : null}
        {needsProviderSetup ? (
          <button className="composer-hint" type="button" onClick={onOpenSettings}>
            Add a model key in Settings to start building
          </button>
        ) : null}
        <form className="composer" onSubmit={onSubmit}>
          <input
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
