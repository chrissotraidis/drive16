// Prompt intent classification for the build agent.
//
// These are pure functions so scripts/verify-prompt-intent.mjs can unit-test
// the routing that decides whether a prompt preserves or replaces the active
// project — a wrong "new game" call here used to wipe the user's game.

export type AgentIntent = {
  preserveProject: boolean;
  agentName: "drive16-build" | "drive16-repair" | "drive16-iterate";
};

export type AgentIntentContext = {
  // The active project already contains a real game (ROM built or game code
  // beyond the blank starter), so replacing it must be an explicit request.
  projectHasGame: boolean;
  // Lowercase hint for what the current project is (name and/or notes text),
  // used to detect "make a <different genre>" as a new-game request.
  currentGameHint?: string;
};

const GENRES = [
  "snake",
  "pong",
  "breakout",
  "tetris",
  "asteroids",
  "missile command",
  "platformer",
  "shooter",
  "racing",
  "pinball",
  "fighting",
  "rpg",
  "pac",
] as const;

export function looksLikeBuildPrompt(normalized: string) {
  if (
    /^(how|why|what|when|where|who)\b/.test(normalized.trim()) ||
    /^(explain|describe|tell me|show me)\b/.test(normalized.trim())
  ) {
    return false;
  }
  return /\b(make|build|create|add|generate|turn|change|fix|repair)\b/.test(normalized);
}

export function mentionsKnownGameShape(normalized: string) {
  return /\b(snake|sprite|pong|breakout|platformer|shooter|racing|maze|runner|space|asteroids|tetris|missile command|pac|pinball|fighting|rpg)\b/.test(
    normalized,
  );
}

export function looksLikeFollowUpPrompt(normalized: string) {
  return (
    /\b(change|fix|repair|adjust|update|improve|tweak|refine|iterate|continue|remove|replace|add|give|put|insert|include|attach|extend|expand|increase|decrease|reduce|double|halve|swap|move|resize|recolor|rename|retheme|polish)\b/.test(
      normalized,
    ) ||
    /\bmake (it|this|the)\b/.test(normalized) ||
    /\b(faster|slower|bigger|smaller|taller|shorter|wider|narrower|harder|easier|louder|quieter)\b/.test(
      normalized,
    ) ||
    /\bspeed (it|this|the|up)\b/.test(normalized) ||
    /\bslow (it|this|the|down)\b/.test(normalized)
  );
}

function genresIn(text: string): string[] {
  return GENRES.filter((genre) => text.includes(genre));
}

// "new game", "start over", "from scratch" always replace the project.
export function explicitNewGamePhrase(normalized: string) {
  return /\b(new game|another game|different game|start over|start fresh|from scratch|scrap (it|this)|throw (it|this) away)\b/.test(
    normalized,
  );
}

// Naming a different genre than the current game ("make a tetris game" while
// playing Pong) also reads as a new-game request — but only when the prompt
// is not already a follow-up ("add a tetris-style bonus round" preserves).
export function namesDifferentGenre(normalized: string, currentGameHint = "") {
  const hint = currentGameHint.toLowerCase();
  const requested = genresIn(normalized);
  if (!requested.length) return false;
  const current = genresIn(hint);
  if (!current.length) return false;
  return requested.some((genre) => !current.includes(genre));
}

// Repairs are prompts about something being broken — those get the bounded
// repair agent. Feature follow-ups ("add a second ball") get the full build
// agent; framing them as repair passes starved iteration of budget.
export function looksLikeRepairPrompt(normalized: string) {
  return /\b(fix|repair|broken|crash(es|ing|ed)?|bug|glitch|freezes?|frozen|stuck|does ?n[o']t work|not working|fail(s|ed|ing)?|error)\b/.test(
    normalized,
  );
}

export function shouldPreserveActiveProject(text: string) {
  const normalized = text.toLowerCase().trim();
  return (
    looksLikeFollowUpPrompt(normalized) ||
    /^continue\b/.test(normalized) ||
    /\b(current|existing|same|this)\b.{0,48}\b(game|project|rom|build)\b/.test(normalized)
  );
}

export function classifyAgentIntent(text: string, context: AgentIntentContext): AgentIntent {
  const normalized = text.toLowerCase().trim();

  let preserveProject: boolean;
  if (explicitNewGamePhrase(normalized)) {
    preserveProject = false;
  } else if (shouldPreserveActiveProject(normalized)) {
    preserveProject = true;
  } else if (namesDifferentGenre(normalized, context.currentGameHint ?? "")) {
    preserveProject = false;
  } else {
    // When a real game exists, an ambiguous prompt defaults to preserving it.
    // Only a blank/starter project treats ambiguous build prompts as new games.
    preserveProject = context.projectHasGame;
  }

  // Follow-ups on a working game get the fast bounded iterate agent with
  // change-scoped verification; broken-game prompts get the repair agent;
  // new games get the full build agent.
  const agentName: AgentIntent["agentName"] = !preserveProject
    ? "drive16-build"
    : looksLikeRepairPrompt(normalized)
      ? "drive16-repair"
      : "drive16-iterate";
  return { preserveProject, agentName };
}
