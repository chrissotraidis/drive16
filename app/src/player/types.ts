export type ActiveRomSourceKind = "starter" | "imported" | "generated";

export type ActiveRomSource = {
  kind: ActiveRomSourceKind;
  label: string;
  detail: string;
  path: string;
  storage: "repo" | "ignored-artifact" | "generated-artifact";
  canVerify: boolean;
};

export type LoadedPlayerRom = {
  loadedAt: string;
  sourcePath: string;
  sourceName: string;
  objectUrl: string;
  bytes: number;
};

export type PlayerProviderKind = "proof-preview" | "nostalgist-retroarch";

export type PlayerProviderState = "available" | "unconfigured" | "loading" | "error";

export type PlayerProvider = {
  kind: PlayerProviderKind;
  state: PlayerProviderState;
  label: string;
  detail: string;
};

export type PlayerSessionState = "idle" | "loading" | "playing" | "paused" | "stopped" | "error";

export type PlayerAudioState = "unavailable" | "muted" | "audible";

export type PlayerInputActionId =
  | "dpad.left"
  | "dpad.right"
  | "dpad.up"
  | "dpad.down"
  | "button.a"
  | "button.b"
  | "button.c"
  | "button.start";

export type PlayerInputAction = {
  id: PlayerInputActionId;
  label: string;
  control: string;
  detail: string;
  event: string;
  spriteDelta?: number;
};

export type PlayerInputState = {
  focused: boolean;
  keyboardReady: boolean;
  controllerReady: boolean;
  lastAction?: PlayerInputAction;
};

export type InteractivePlayerSession = {
  provider: PlayerProvider;
  state: PlayerSessionState;
  audio: PlayerAudioState;
  rom: ActiveRomSource;
  loadedRom?: LoadedPlayerRom;
  input: PlayerInputState;
};

export const proofPreviewProvider: PlayerProvider = {
  kind: "proof-preview",
  state: "available",
  label: "Proof preview",
  detail: "Captured-frame validation path; not a live playable session.",
};

export const nostalgistProviderPending: PlayerProvider = {
  kind: "nostalgist-retroarch",
  state: "unconfigured",
  label: "Interactive player",
  detail: "RetroArch core delivery is not configured yet.",
};
