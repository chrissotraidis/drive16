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

export type OllamaFreeformReplyRequest = {
  endpoint: string;
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
  "Help the user reason about the current ROM/project and the latest Drive16 result in plain language.",
  "Drive16 can build through its local build agent, but this conversational route only answers questions and explains the current state.",
  "Use the supplied runtime context as fact. Do not claim the local tools are inactive when the context says they are connected.",
  "Do not mistake a question about the current project for a request to build something else.",
  "You cannot personally change, verify, export, run, or play ROMs from this conversational route.",
  "You may report facts explicitly supplied in the runtime context, but never claim you personally performed them and never infer success from a service merely being connected.",
  "Treat the latest runtime context as authoritative: never infer ComfyUI use from AI sprites being enabled, and never infer audio from a ROM merely playing.",
  "When a build failed, explain the recorded failure directly and suggest one relevant next action instead of asking what to build next.",
].join(" ");

export function openRouterFreeformMessages(
  priorMessages: Array<{ role: "user" | "agent"; body: string }>,
  nextUserMessage: string,
  runtimeContext?: string,
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
    ...(runtimeContext
      ? [
          {
            role: "system" as const,
            content: `Latest authoritative Drive16 runtime context (this overrides older chat claims):\n${runtimeContext}`,
          },
        ]
      : []),
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

export async function sendOllamaFreeformReply({
  endpoint,
  model,
  messages,
}: OllamaFreeformReplyRequest): Promise<OpenRouterFreeformReply> {
  const baseUrl = endpoint.trim().replace(/\/+$/, "");
  const trimmedModel = model.trim();
  if (!baseUrl) throw new Error("Ollama endpoint required");
  if (!trimmedModel) throw new Error("Ollama model required");

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: trimmedModel,
      messages,
      stream: false,
      think: false,
      options: {
        temperature: 0.35,
        num_predict: 600,
      },
    }),
  });
  if (!response.ok) {
    throw new Error(`Ollama request failed with HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    model?: string;
    message?: { content?: string };
    prompt_eval_count?: number;
    eval_count?: number;
  };
  const content = payload.message?.content?.trim();
  if (!content) throw new Error("Ollama returned an empty reply");

  const promptTokens = payload.prompt_eval_count;
  const completionTokens = payload.eval_count;
  return {
    model: payload.model ?? trimmedModel,
    content,
    promptTokens,
    completionTokens,
    totalTokens:
      promptTokens === undefined && completionTokens === undefined
        ? undefined
        : (promptTokens ?? 0) + (completionTokens ?? 0),
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
