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
  audioSignalDetected: boolean;
  audioProbe?: AnalyserNode;
  logs: string[];
};

type NostalgistLaunchOptions = Parameters<typeof Nostalgist.launch>[0];

export const defaultPlayerVolume = 60;
const retroarchVolumeStepDb = 0.5;
const retroarchMaxAttenuationDb = 60;
const playerVolumeCurveExponent = 2;

const inputButtonMap: Record<PlayerInputActionId, string> = {
  "dpad.left": "left",
  "dpad.right": "right",
  "dpad.up": "up",
  "dpad.down": "down",
  // Genesis Plus GX maps the three-button pad onto RetroPad as A->Y,
  // B->B, C->A. Using the face-button names directly sends the wrong
  // Genesis control for A and C.
  "button.a": "y",
  "button.b": "b",
  "button.c": "a",
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
      if (
        /Cannot push NULL or empty core path into the playlist|Could not get screen dimensions/i.test(
          message,
        )
      ) {
        return;
      }
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
    audioSignalDetected: false,
    logs,
  };

  runtime.audioProbe = installAudioProbe(runtime);

  return runtime;
}

// RetroArch's Emscripten build exposes its WebAudio context through RWA. Browsers
// keep that context suspended until a user gesture, so resume it explicitly.
function findAudioContext(runtime: NostalgistPlayerRuntime): AudioContext | undefined {
  if (!browserAudioOutputSupported()) return undefined;

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

function browserAudioOutputSupported() {
  const browserGlobal = globalThis as typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };
  return (
    typeof browserGlobal.AudioContext === "function" ||
    typeof browserGlobal.webkitAudioContext === "function"
  );
}

export function nostalgistAudioState(runtime: NostalgistPlayerRuntime): PlayerAudioState {
  const ctx = findAudioContext(runtime);
  if (!ctx) {
    return "unavailable";
  }
  if (ctx.state === "suspended") return "needs-gesture";
  if (ctx.state !== "running") return "unavailable";
  if (runtime.muted || runtime.volume === 0) return "muted";
  return runtime.audioSignalDetected ? "signal" : "enabled";
}

export async function detectNostalgistAudioSignal(
  runtime: NostalgistPlayerRuntime,
  durationMs = 2_000,
): Promise<boolean> {
  const analyser = runtime.audioProbe;
  if (!analyser) return false;

  const samples = new Float32Array(analyser.fftSize);
  const deadline = performance.now() + durationMs;
  while (performance.now() < deadline) {
    analyser.getFloatTimeDomainData(samples);
    for (const sample of samples) {
      if (Math.abs(sample) > 0.0005) {
        runtime.audioSignalDetected = true;
        return true;
      }
    }
    await new Promise<void>((resolve) => window.setTimeout(resolve, 120));
  }
  return false;
}

function installAudioProbe(runtime: NostalgistPlayerRuntime): AnalyserNode | undefined {
  const ctx = findAudioContext(runtime);
  if (!ctx) return undefined;

  try {
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0;
    analyser.connect(ctx.destination);

    // This RetroArch build creates a fresh AudioBufferSourceNode for every
    // audio block and connects it directly to the destination. Route future
    // blocks through an analyser so Drive16 can distinguish an enabled context
    // from a real signal reaching the browser output graph.
    const originalCreateBufferSource = ctx.createBufferSource.bind(ctx);
    const contextFactory = ctx as unknown as {
      createBufferSource: () => AudioBufferSourceNode;
    };
    contextFactory.createBufferSource = () => {
      const source = originalCreateBufferSource();
      const originalConnect = source.connect.bind(source) as (
        destination: AudioNode,
        ...args: number[]
      ) => AudioNode;
      source.connect = ((destination: AudioNode, ...args: number[]) =>
        originalConnect(destination === ctx.destination ? analyser : destination, ...args)) as typeof source.connect;
      return source;
    };
    return analyser;
  } catch {
    return undefined;
  }
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

export function playerVolumeToAttenuationSteps(volume: number) {
  const normalized = clampPlayerVolume(volume) / 100;
  if (normalized <= 0) {
    return Math.round(retroarchMaxAttenuationDb / retroarchVolumeStepDb);
  }

  // A percentage is a listening-level control, not a decibel control. Square
  // the normalized value before converting it to dB so 5% and 10% are
  // genuinely quiet and audibly distinct instead of adjacent near-full-scale
  // RetroArch steps. The slider label remains the saved user percentage.
  const amplitude = normalized ** playerVolumeCurveExponent;
  const attenuationDb = Math.min(
    retroarchMaxAttenuationDb,
    Math.max(0, -20 * Math.log10(amplitude)),
  );
  return Math.round(attenuationDb / retroarchVolumeStepDb);
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

  if (runtime.muted) {
    runtime.instance.sendCommand("MUTE");
    runtime.muted = false;
  }

  const ctx = findAudioContext(runtime);
  if (ctx?.state === "suspended") {
    await tryResumeAudioContext(ctx);
  }

  const nextSteps = playerVolumeToAttenuationSteps(nextVolume);
  const stepDelta = nextSteps - runtime.volumeSteps;
  if (stepDelta > 0) {
    sendRepeatedCommand(runtime, "VOLUME_DOWN", stepDelta);
  } else if (stepDelta < 0) {
    sendRepeatedCommand(runtime, "VOLUME_UP", Math.abs(stepDelta));
  }

  runtime.volume = nextVolume;
  runtime.volumeSteps = nextSteps;
  const state = nostalgistAudioState(runtime);
  // `On` is the explicit player setting; signal detection is reported
  // separately. Some embedded browser sessions play RetroArch audio without
  // exposing its AudioContext back through the core, so do not relabel a
  // successful unmute command as Unavailable merely because probing failed.
  return state === "unavailable" || state === "needs-gesture" ? "enabled" : state;
}

export async function setNostalgistMuted(
  runtime: NostalgistPlayerRuntime,
  muted: boolean,
): Promise<PlayerAudioState> {
  const ctx = findAudioContext(runtime);
  if (runtime.muted !== muted) {
    runtime.instance.sendCommand("MUTE");
    runtime.muted = muted;
  }
  if (!muted && ctx?.state === "suspended") {
    await tryResumeAudioContext(ctx);
  }
  const state = nostalgistAudioState(runtime);
  return !muted && (state === "unavailable" || state === "needs-gesture")
    ? "enabled"
    : state;
}

async function tryResumeAudioContext(ctx: AudioContext) {
  try {
    // Some WebViews keep an otherwise valid RetroArch context suspended until
    // a source is started during the same user gesture. Prime the existing
    // graph with one silent sample; ROM audio still supplies all audible data.
    const unlockSource = ctx.createBufferSource();
    unlockSource.buffer = ctx.createBuffer(1, 1, 22_050);
    unlockSource.connect(ctx.destination);
    unlockSource.start(0);
    await Promise.race([
      ctx.resume(),
      new Promise<void>((resolve) => window.setTimeout(resolve, 2_000)),
    ]);
  } catch {
    // A later explicit click can retry the browser gesture gate.
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

export async function restartNostalgistPlayer(
  runtime: NostalgistPlayerRuntime,
  action?: PlayerInputAction,
) {
  if (!action) throw new Error("This project does not document a game recovery control.");
  const button = inputButtonMap[action.id];
  // Use Nostalgist's complete key press helper so the recovery control remains
  // down across several emulated frames and is always released. A short pair
  // of synthetic down/up calls was unreliable at pause and game-over edges.
  await runtime.instance.press({ button, player: 1, time: 220 });
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
