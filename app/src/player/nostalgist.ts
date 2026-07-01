import { Nostalgist } from "nostalgist";
import type {
  LoadedPlayerRom,
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
  rom: LoadedPlayerRom;
  startedAt: string;
};

type NostalgistLaunchOptions = Parameters<typeof Nostalgist.launch>[0];

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
  rom,
}: {
  canvas: HTMLCanvasElement;
  rom: LoadedPlayerRom;
}): Promise<NostalgistPlayerRuntime> {
  canvas.dataset.playerCore = GENESIS_PLUS_GX_CORE;
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
    core: GENESIS_PLUS_GX_CORE,
    emscriptenModule,
    element: canvas,
    rom: {
      fileContent,
      fileName: rom.sourceName,
    },
  });

  return {
    instance,
    core: GENESIS_PLUS_GX_CORE,
    rom,
    startedAt: new Date().toISOString(),
  };
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
