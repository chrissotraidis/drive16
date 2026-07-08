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
    "Nostalgist/RetroArch loads Genesis Plus GX from the dev CDN at play time; Drive16 does not vendor the core.",
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
};

type NostalgistLaunchOptions = Parameters<typeof Nostalgist.launch>[0];

export const defaultPlayerVolume = 0;
const retroarchVolumeCommandSteps = 80;

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

  const fileContent = await fetchRomBlob(rom);
  const emscriptenModule = {
    printErr(...args: unknown[]) {
      const message = args.join(" ");
      if (message.includes("Canvas size should be set using CSS properties")) {
        return;
      }
      console.error(...args);
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
      audio_mixer_mute_enable: true,
      audio_volume: -80,
      audio_mixer_volume: -80,
    },
    rom: {
      fileContent,
      fileName: rom.sourceName,
    },
  });

  return {
    instance,
    core: GENESIS_PLUS_GX_CORE,
    coreSource: core ? "user" : "dev-cdn",
    rom,
    startedAt: new Date().toISOString(),
    muted: true,
    volume: defaultPlayerVolume,
    volumeSteps: 0,
  };
}

// The RetroArch Emscripten build routes audio through OpenAL; browsers keep
// its AudioContext suspended until a user gesture, so playback starts silent
// unless we resume it explicitly.
function findAudioContext(runtime: NostalgistPlayerRuntime): AudioContext | undefined {
  try {
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
  return runtime.muted ? "muted" : "audible";
}

export async function resumeNostalgistAudio(
  runtime: NostalgistPlayerRuntime,
): Promise<PlayerAudioState> {
  const ctx = findAudioContext(runtime);
  if (!ctx) {
    return "unavailable";
  }
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      // The browser refused; a later user gesture can retry.
    }
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
    if (!runtime.muted) {
      runtime.instance.sendCommand("MUTE");
    }
    sendRepeatedCommand(runtime, "VOLUME_DOWN", retroarchVolumeCommandSteps);
    runtime.muted = true;
    runtime.volume = 0;
    runtime.volumeSteps = 0;
    return nostalgistAudioState(runtime);
  }

  const ctx = findAudioContext(runtime);
  if (ctx?.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      // The user can retry from the volume control after another gesture.
    }
  }

  const nextSteps = Math.round((nextVolume / 100) * retroarchVolumeCommandSteps);
  const stepDelta = nextSteps - runtime.volumeSteps;
  if (stepDelta > 0) {
    sendRepeatedCommand(runtime, "VOLUME_UP", stepDelta);
  } else if (stepDelta < 0) {
    sendRepeatedCommand(runtime, "VOLUME_DOWN", Math.abs(stepDelta));
  }

  runtime.volume = nextVolume;
  runtime.volumeSteps = nextSteps;
  if (runtime.muted) {
    runtime.instance.sendCommand("MUTE");
    runtime.muted = false;
  }
  return nostalgistAudioState(runtime);
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

async function fetchRomBlob(rom: LoadedPlayerRom) {
  const response = await fetch(rom.objectUrl);
  if (!response.ok) {
    throw new Error(`Could not prepare ${rom.sourceName} for interactive Play.`);
  }
  return response.blob();
}
