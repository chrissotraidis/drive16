import { Nostalgist } from "nostalgist";
import type {
  LoadedInteractiveCore,
  LoadedPlayerRom,
  PlayerAudioState,
  PlayerInputAction,
  PlayerInputActionId,
  PlayerProvider,
} from "./types";

export const GENESIS_PLUS_GX_CORE = "genesis_plus_gx";

export const nostalgistProviderReady: PlayerProvider = {
  kind: "nostalgist-retroarch",
  state: "dev-only",
  label: "Play ready",
  detail:
    "Nostalgist/RetroArch streams Genesis Plus GX at play time; Drive16 does not vendor the core.",
};

export type NostalgistPlayerRuntime = {
  instance: Awaited<ReturnType<typeof Nostalgist.launch>>;
  core: typeof GENESIS_PLUS_GX_CORE;
  coreSource: "dev-cdn" | "user";
  rom: LoadedPlayerRom;
  startedAt: string;
  muted: boolean;
  volume: number;
  volumeSteps: number;
  logs: string[];
};

type NostalgistLaunchOptions = Parameters<typeof Nostalgist.launch>[0];

export const defaultPlayerVolume = 40;
const retroarchAttenuationSteps = 40;

const inputButtonMap: Record<PlayerInputActionId, string> = {
  "dpad.left": "left",
  "dpad.right": "right",
  "dpad.up": "up",
  "dpad.down": "down",
  "button.a": "a",
  "button.b": "b",
  "button.c": "x",
  "button.start": "start",
};

export async function launchNostalgistMegadrivePlayer({
  canvas,
  core,
  rom,
}: {
  canvas: HTMLCanvasElement;
  core?: LoadedInteractiveCore;
  rom: LoadedPlayerRom;
}): Promise<NostalgistPlayerRuntime> {
  canvas.dataset.playerCore = GENESIS_PLUS_GX_CORE;
  canvas.dataset.playerCoreSource = core ? "user" : "dev-cdn";
  canvas.dataset.romSource = rom.sourcePath;

  const fileContent = rom.blob;
  const logs: string[] = [];
  const recordLog = (...args: unknown[]) => {
    const message = args.join(" ").trim();
    if (message) logs.push(message);
    if (logs.length > 80) logs.shift();
  };
  const emscriptenModule = {
    print(...args: unknown[]) {
      recordLog(...args);
    },
    printErr(...args: unknown[]) {
      const message = args.join(" ");
      if (message.includes("Canvas size should be set using CSS properties")) {
        return;
      }
      recordLog(...args);
      if (/\[ERROR\]/i.test(message)) console.error(...args);
      else if (/\[WARN\]/i.test(message)) console.warn(...args);
    },
  } as NonNullable<NostalgistLaunchOptions["emscriptenModule"]>;

  const instance = await Nostalgist.launch({
    core: core
      ? {
          name: core.coreName,
          js: {
            fileContent: core.jsBlob,
            fileName: core.jsFileName,
          },
          wasm: {
            fileContent: core.wasmBlob,
            fileName: core.wasmFileName,
          },
        }
      : GENESIS_PLUS_GX_CORE,
    emscriptenModule,
    element: canvas,
    retroarchConfig: {
      audio_enable: true,
      audio_mute_enable: true,
      audio_mixer_mute_enable: false,
      audio_volume: 0,
      audio_mixer_volume: 0,
      log_verbosity: true,
      frontend_log_level: 0,
      video_shader_enable: false,
      video_smooth: false,
      video_threaded: false,
    },
    rom: {
      fileContent,
      fileName: rom.sourceName,
    },
  });

  const runtime: NostalgistPlayerRuntime = {
    instance,
    core: GENESIS_PLUS_GX_CORE,
    coreSource: core ? "user" : "dev-cdn",
    rom,
    startedAt: new Date().toISOString(),
    muted: true,
    volume: defaultPlayerVolume,
    volumeSteps: 0,
    logs,
  };

  return runtime;
}

// RetroArch's Emscripten build exposes its WebAudio context through RWA. Browsers
// keep that context suspended until a user gesture, so resume it explicitly.
function findAudioContext(runtime: NostalgistPlayerRuntime): AudioContext | undefined {
  try {
    const emscripten = runtime.instance.getEmscripten?.() as
      | { RWA?: { context?: AudioContext } }
      | undefined;
    const rwebAudio = emscripten?.RWA?.context;
    if (rwebAudio && typeof rwebAudio.resume === "function") {
      return rwebAudio;
    }

    const al = runtime.instance.getEmscriptenAL?.();
    const ctx = al?.currentCtx?.audioCtx;
    if (ctx && typeof ctx.resume === "function") {
      return ctx as AudioContext;
    }
  } catch {
    // Audio context is not available for this core/session.
  }
  return undefined;
}

export function nostalgistAudioState(runtime: NostalgistPlayerRuntime): PlayerAudioState {
  const ctx = findAudioContext(runtime);
  if (!ctx) {
    return "unavailable";
  }
  if (ctx.state === "suspended") return "needs-gesture";
  if (ctx.state !== "running") return "unavailable";
  return runtime.muted || runtime.volume === 0 ? "muted" : "audible";
}

export async function resumeNostalgistAudio(
  runtime: NostalgistPlayerRuntime,
): Promise<PlayerAudioState> {
  const ctx = findAudioContext(runtime);
  if (!ctx) {
    return "unavailable";
  }
  if (ctx.state === "suspended") {
    await tryResumeAudioContext(ctx);
  }
  return nostalgistAudioState(runtime);
}

export function clampPlayerVolume(volume: number) {
  if (!Number.isFinite(volume)) return defaultPlayerVolume;
  return Math.max(0, Math.min(100, Math.round(volume)));
}

export async function setNostalgistVolume(
  runtime: NostalgistPlayerRuntime,
  volume: number,
): Promise<PlayerAudioState> {
  const nextVolume = clampPlayerVolume(volume);

  if (nextVolume === 0) {
    if (!runtime.muted) runtime.instance.sendCommand("MUTE");
    runtime.muted = true;
    runtime.volume = 0;
    return nostalgistAudioState(runtime);
  }

  const ctx = findAudioContext(runtime);
  if (ctx?.state === "suspended") {
    await tryResumeAudioContext(ctx);
  }

  if (runtime.muted) {
    runtime.instance.sendCommand("MUTE");
    runtime.muted = false;
  }

  const nextSteps = Math.round((1 - nextVolume / 100) * retroarchAttenuationSteps);
  const stepDelta = nextSteps - runtime.volumeSteps;
  if (stepDelta > 0) {
    sendRepeatedCommand(runtime, "VOLUME_DOWN", stepDelta);
  } else if (stepDelta < 0) {
    sendRepeatedCommand(runtime, "VOLUME_UP", Math.abs(stepDelta));
  }

  runtime.volume = nextVolume;
  runtime.volumeSteps = nextSteps;
  return nostalgistAudioState(runtime);
}

async function tryResumeAudioContext(ctx: AudioContext) {
  try {
    await Promise.race([
      ctx.resume(),
      new Promise<void>((resolve) => window.setTimeout(resolve, 600)),
    ]);
  } catch {
    // A later click on the sound control can retry the browser gesture gate.
  }
}

function sendRepeatedCommand(
  runtime: NostalgistPlayerRuntime,
  command: "VOLUME_DOWN" | "VOLUME_UP",
  count: number,
) {
  for (let index = 0; index < count; index += 1) {
    runtime.instance.sendCommand(command);
  }
}

export function pauseNostalgistPlayer(runtime: NostalgistPlayerRuntime) {
  runtime.instance.pause();
}

export function resumeNostalgistPlayer(runtime: NostalgistPlayerRuntime) {
  runtime.instance.resume();
}

export function resetNostalgistPlayer(runtime: NostalgistPlayerRuntime) {
  runtime.instance.restart();
}

export function stopNostalgistPlayer(runtime: NostalgistPlayerRuntime) {
  runtime.instance.exit({ removeCanvas: false });
}

export function sendNostalgistInput(
  runtime: NostalgistPlayerRuntime,
  action: PlayerInputAction,
  phase: "down" | "up",
) {
  const button = inputButtonMap[action.id];
  if (phase === "down") {
    runtime.instance.pressDown({ button, player: 1 });
  } else {
    runtime.instance.pressUp({ button, player: 1 });
  }
}
