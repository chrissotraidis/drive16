#!/usr/bin/env node
// Unit test for the prompt-intent routing that decides whether a chat prompt
// preserves or replaces the active project, and which agent budget it gets.
// Run: node --experimental-strip-types scripts/verify-prompt-intent.mjs
import path from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const modulePath = path.join(scriptDir, "..", "app", "src", "agent", "promptIntent.ts");
const { classifyAgentIntent } = await import(pathToFileURL(modulePath).href);

const pongProject = {
  projectHasGame: true,
  currentGameHint: "Pong beat the cpu paddles and ball",
};
const blankProject = { projectHasGame: false, currentGameHint: "Untitled Project" };

const cases = [
  // Follow-ups on a real project must preserve it (the audit's wipe bug).
  { text: "add a second ball", context: pongProject, preserve: true, agent: "drive16-build" },
  { text: "add sound", context: pongProject, preserve: true, agent: "drive16-build" },
  { text: "give the ship a sprite", context: pongProject, preserve: true, agent: "drive16-build" },
  { text: "make it faster", context: pongProject, preserve: true, agent: "drive16-build" },
  { text: "make the paddles twice as tall", context: pongProject, preserve: true, agent: "drive16-build" },
  { text: "add a tetris-style bonus round", context: pongProject, preserve: true, agent: "drive16-build" },
  // Ambiguous prompts default to preserving a real project.
  { text: "cooler explosions please", context: pongProject, preserve: true, agent: "drive16-build" },
  // Broken-game prompts get the bounded repair agent.
  { text: "fix the crash when the ball hits the wall", context: pongProject, preserve: true, agent: "drive16-repair" },
  { text: "the controls are broken, repair them", context: pongProject, preserve: true, agent: "drive16-repair" },
  // Explicit new-game requests replace the project.
  { text: "make a tetris game", context: pongProject, preserve: false, agent: "drive16-build" },
  { text: "new game: snake", context: pongProject, preserve: false, agent: "drive16-build" },
  { text: "start over", context: pongProject, preserve: false, agent: "drive16-build" },
  { text: "build a platformer from scratch", context: pongProject, preserve: false, agent: "drive16-build" },
  // On a blank project, a fresh build prompt is a new game.
  { text: "make a simple pong game", context: blankProject, preserve: false, agent: "drive16-build" },
];

let failures = 0;
for (const testCase of cases) {
  const intent = classifyAgentIntent(testCase.text, testCase.context);
  const ok = intent.preserveProject === testCase.preserve && intent.agentName === testCase.agent;
  if (!ok) {
    failures += 1;
    console.error(
      `FAIL: "${testCase.text}" -> preserve=${intent.preserveProject} agent=${intent.agentName}` +
        ` (expected preserve=${testCase.preserve} agent=${testCase.agent})`,
    );
  }
}

if (failures) {
  console.error(`${failures}/${cases.length} prompt-intent cases failed.`);
  process.exit(1);
}
console.log(`Prompt intent ok: ${cases.length} cases passed.`);
