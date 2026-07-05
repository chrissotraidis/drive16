export const openRouterChatCompletionsUrl = "https://openrouter.ai/api/v1/chat/completions";
export const defaultOpenRouterModel = "deepseek/deepseek-chat-v3.1";

export type OpenRouterConversationMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OpenRouterFreeformReplyRequest = {
  apiKey: string;
  model: string;
  messages: OpenRouterConversationMessage[];
};

export type OpenRouterFreeformReply = {
  model: string;
  content: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

type OpenRouterErrorPayload = {
  error?: {
    message?: string;
    code?: string | number;
  };
  message?: string;
};

type OpenRouterCompletionPayload = {
  model?: string;
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

const freeformSystemPrompt = [
  "You are Drive16 Agent, a concise Sega Genesis / Mega Drive game-building assistant.",
  "Help the user reason about their ROM/project request in plain language.",
  "You are only a chat assistant. You cannot change, build, verify, export, run, or play ROMs.",
  "Never say that a ROM was built, compiled, verified, exported, played, or made ready.",
  "If the user is testing chat, say chat is live and explain that builds require Drive16's local proof controls.",
  "If the user asks to create the bundled sprite/music demo, the app will route that separately through local proof tooling.",
].join(" ");

export function openRouterFreeformMessages(
  priorMessages: Array<{ role: "user" | "agent"; body: string }>,
  nextUserMessage: string,
): OpenRouterConversationMessage[] {
  const recentMessages: OpenRouterConversationMessage[] = priorMessages.slice(-8).map((message) => {
    const role: OpenRouterConversationMessage["role"] =
      message.role === "user" ? "user" : "assistant";
    return {
      role,
      content: message.body,
    };
  });

  return [
    {
      role: "system",
      content: freeformSystemPrompt,
    },
    ...recentMessages,
    {
      role: "user",
      content: nextUserMessage,
    },
  ];
}

export async function sendOpenRouterFreeformReply({
  apiKey,
  model,
  messages,
}: OpenRouterFreeformReplyRequest): Promise<OpenRouterFreeformReply> {
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    throw new Error("OpenRouter key required");
  }

  const response = await fetch(openRouterChatCompletionsUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${trimmedKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": window.location.origin,
      "X-Title": "Drive16",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.35,
      max_tokens: 600,
    }),
  });

  if (!response.ok) {
    throw new Error(await openRouterErrorDetail(response));
  }

  const payload = (await response.json()) as OpenRouterCompletionPayload;
  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("OpenRouter returned an empty reply");
  }

  return {
    model: payload.model ?? model,
    content,
    promptTokens: payload.usage?.prompt_tokens,
    completionTokens: payload.usage?.completion_tokens,
    totalTokens: payload.usage?.total_tokens,
  };
}

async function openRouterErrorDetail(response: Response) {
  const fallback = `OpenRouter request failed with HTTP ${response.status}`;

  try {
    const payload = (await response.json()) as OpenRouterErrorPayload;
    return payload.error?.message ?? payload.message ?? fallback;
  } catch {
    return fallback;
  }
}
