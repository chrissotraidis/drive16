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

export type LoadedInteractiveCore = {
  loadedAt: string;
  source: "user";
  coreName: string;
  jsPath: string;
  wasmPath: string;
  jsFileName: string;
  wasmFileName: string;
  jsBlob: Blob;
  wasmBlob: Blob;
  jsBytes: number;
  wasmBytes: number;
};

export type PlayerProviderKind = "proof-preview" | "nostalgist-retroarch";

export type InteractiveCoreStatus =
  | "available"
  | "missing"
  | "unsupported"
  | "dev-only"
  | "needs-user-action";

export type InteractiveCorePolicy = "dev-cdn" | "user-supplied" | "disabled" | "unsupported";

export type InteractiveCoreReadiness = {
  status: InteractiveCoreStatus;
  policy: InteractiveCorePolicy;
  label: string;
  detail: string;
  verifyDetail: string;
  setupAction: string;
  source: string;
  canPlay: boolean;
  releaseSafe: boolean;
};

export type PlayerProviderState = InteractiveCoreStatus | "unconfigured" | "loading" | "error";

export type PlayerProvider = {
  kind: PlayerProviderKind;
  state: PlayerProviderState;
  label: string;
  detail: string;
};

export type PlayerSessionState = "idle" | "loading" | "playing" | "paused" | "stopped" | "error";

export type PlayerAudioState = "unavailable" | "needs-gesture" | "muted" | "audible";

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

export type PlayerInputBindingKind = "keyboard" | "gamepad-button" | "gamepad-axis";

export type KeyboardInputBinding = {
  kind: "keyboard";
  key: string;
  label: string;
};

export type GamepadButtonInputBinding = {
  kind: "gamepad-button";
  index: number;
  label: string;
};

export type GamepadAxisInputBinding = {
  kind: "gamepad-axis";
  axis: number;
  direction: -1 | 1;
  threshold: number;
  label: string;
};

export type PlayerInputBinding =
  | KeyboardInputBinding
  | GamepadButtonInputBinding
  | GamepadAxisInputBinding;

export type PlayerInputProfile = {
  version: 1;
  source: "default" | "local";
  updatedAt: string;
  keyboard: Record<PlayerInputActionId, KeyboardInputBinding>;
  controller: Record<PlayerInputActionId, PlayerInputBinding[]>;
};

export type GamepadReadinessState =
  | "unavailable"
  | "not-detected"
  | "detected"
  | "mapping-missing";

export type GamepadReadiness = {
  state: GamepadReadinessState;
  label: string;
  detail: string;
  gamepadId?: string;
  gamepadIndex?: number;
};

export type PlayerInputState = {
  focused: boolean;
  keyboardReady: boolean;
  profile: PlayerInputProfile;
  controller: GamepadReadiness;
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
  label: "Play setup needed",
  detail: "Interactive core delivery is not configured yet. Verify remains available.",
};
