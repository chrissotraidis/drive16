import type {
  GamepadReadiness,
  GamepadReadinessState,
  KeyboardInputBinding,
  PlayerInputAction,
  PlayerInputActionId,
  PlayerInputBinding,
  PlayerInputProfile,
} from "./types";

export const inputProfileStorageKey = "drive16.inputProfile.v1";

export const playerInputActionIds: PlayerInputActionId[] = [
  "dpad.left",
  "dpad.right",
  "dpad.up",
  "dpad.down",
  "button.a",
  "button.b",
  "button.c",
  "button.start",
];

type PlayerInputActionDefinition = Omit<PlayerInputAction, "control" | "event"> & {
  keyboardEvent: string;
  controllerEvent: string;
};

const actionDefinitions: Record<PlayerInputActionId, PlayerInputActionDefinition> = {
  "dpad.left": {
    id: "dpad.left",
    label: "Left",
    detail: "D-pad left",
    keyboardEvent: "input.keyboard.left",
    controllerEvent: "input.controller.left",
    spriteDelta: -6,
  },
  "dpad.right": {
    id: "dpad.right",
    label: "Right",
    detail: "D-pad right",
    keyboardEvent: "input.keyboard.right",
    controllerEvent: "input.controller.right",
    spriteDelta: 6,
  },
  "dpad.up": {
    id: "dpad.up",
    label: "Up",
    detail: "D-pad up",
    keyboardEvent: "input.keyboard.up",
    controllerEvent: "input.controller.up",
  },
  "dpad.down": {
    id: "dpad.down",
    label: "Down",
    detail: "D-pad down",
    keyboardEvent: "input.keyboard.down",
    controllerEvent: "input.controller.down",
  },
  "button.a": {
    id: "button.a",
    label: "A",
    detail: "Genesis A button",
    keyboardEvent: "input.keyboard.a",
    controllerEvent: "input.controller.a",
  },
  "button.b": {
    id: "button.b",
    label: "B",
    detail: "Genesis B button",
    keyboardEvent: "input.keyboard.b",
    controllerEvent: "input.controller.b",
  },
  "button.c": {
    id: "button.c",
    label: "C",
    detail: "Genesis C button",
    keyboardEvent: "input.keyboard.c",
    controllerEvent: "input.controller.c",
  },
  "button.start": {
    id: "button.start",
    label: "Start",
    detail: "Genesis Start button",
    keyboardEvent: "input.keyboard.start",
    controllerEvent: "input.controller.start",
  },
};

const defaultKeyboardBindings: Record<PlayerInputActionId, KeyboardInputBinding> = {
  "dpad.left": { kind: "keyboard", key: "ArrowLeft", label: "Left Arrow" },
  "dpad.right": { kind: "keyboard", key: "ArrowRight", label: "Right Arrow" },
  "dpad.up": { kind: "keyboard", key: "ArrowUp", label: "Up Arrow" },
  "dpad.down": { kind: "keyboard", key: "ArrowDown", label: "Down Arrow" },
  "button.a": { kind: "keyboard", key: "z", label: "Z" },
  "button.b": { kind: "keyboard", key: "x", label: "X" },
  "button.c": { kind: "keyboard", key: "c", label: "C" },
  "button.start": { kind: "keyboard", key: "Enter", label: "Enter" },
};

const defaultControllerBindings: Record<PlayerInputActionId, PlayerInputBinding[]> = {
  "dpad.left": [
    { kind: "gamepad-axis", axis: 0, direction: -1, threshold: 0.45, label: "Stick left" },
    { kind: "gamepad-button", index: 14, label: "D-pad left" },
  ],
  "dpad.right": [
    { kind: "gamepad-axis", axis: 0, direction: 1, threshold: 0.45, label: "Stick right" },
    { kind: "gamepad-button", index: 15, label: "D-pad right" },
  ],
  "dpad.up": [
    { kind: "gamepad-axis", axis: 1, direction: -1, threshold: 0.45, label: "Stick up" },
    { kind: "gamepad-button", index: 12, label: "D-pad up" },
  ],
  "dpad.down": [
    { kind: "gamepad-axis", axis: 1, direction: 1, threshold: 0.45, label: "Stick down" },
    { kind: "gamepad-button", index: 13, label: "D-pad down" },
  ],
  "button.a": [{ kind: "gamepad-button", index: 0, label: "Button 0" }],
  "button.b": [{ kind: "gamepad-button", index: 1, label: "Button 1" }],
  "button.c": [{ kind: "gamepad-button", index: 2, label: "Button 2" }],
  "button.start": [{ kind: "gamepad-button", index: 9, label: "Start" }],
};

export const keyboardInputActions: PlayerInputAction[] = playerInputActionIds.map((id) =>
  playerInputActionForId(id, "keyboard", defaultKeyboardBindings[id].label),
);

export function defaultInputProfile(): PlayerInputProfile {
  return {
    version: 1,
    source: "default",
    updatedAt: new Date(0).toISOString(),
    keyboard: { ...defaultKeyboardBindings },
    controller: cloneControllerBindings(defaultControllerBindings),
  };
}

export function loadInputProfile(): PlayerInputProfile {
  if (typeof window === "undefined") {
    return defaultInputProfile();
  }

  const stored = window.localStorage.getItem(inputProfileStorageKey);
  if (!stored) {
    return defaultInputProfile();
  }

  try {
    return normalizeInputProfile(JSON.parse(stored));
  } catch {
    return defaultInputProfile();
  }
}

export function saveInputProfile(profile: PlayerInputProfile): PlayerInputProfile {
  const normalized = normalizeInputProfile({
    ...profile,
    source: "local",
    updatedAt: new Date().toISOString(),
  });

  if (typeof window !== "undefined") {
    window.localStorage.setItem(inputProfileStorageKey, JSON.stringify(normalized));
  }

  return normalized;
}

export function resetInputProfile(): PlayerInputProfile {
  const profile = {
    ...defaultInputProfile(),
    source: "local" as const,
    updatedAt: new Date().toISOString(),
  };

  if (typeof window !== "undefined") {
    window.localStorage.setItem(inputProfileStorageKey, JSON.stringify(profile));
  }

  return profile;
}

export function playerInputActionFromKey(
  key: string,
  profile: PlayerInputProfile = defaultInputProfile(),
): PlayerInputAction | undefined {
  const normalizedKey = normalizeKeyboardKey(key);
  const actionId = playerInputActionIds.find(
    (id) => normalizeKeyboardKey(profile.keyboard[id].key) === normalizedKey,
  );

  if (!actionId) return undefined;

  return playerInputActionForId(actionId, "keyboard", profile.keyboard[actionId].label);
}

export function playerInputActionForId(
  id: PlayerInputActionId,
  source: "keyboard" | "controller",
  control?: string,
): PlayerInputAction {
  const definition = actionDefinitions[id];
  return {
    id,
    label: definition.label,
    control: control ?? definition.label,
    detail: definition.detail,
    event: source === "keyboard" ? definition.keyboardEvent : definition.controllerEvent,
    spriteDelta: definition.spriteDelta,
  };
}

export function visibleKeyboardMappings(profile: PlayerInputProfile = defaultInputProfile()) {
  return [
    { control: "Arrows", label: "D-pad" },
    { control: profile.keyboard["button.a"].label, label: "A" },
    { control: profile.keyboard["button.b"].label, label: "B" },
    { control: profile.keyboard["button.c"].label, label: "C" },
    { control: profile.keyboard["button.start"].label, label: "Start" },
  ];
}

export function visibleKeyboardBindings(profile: PlayerInputProfile = defaultInputProfile()) {
  return playerInputActionIds.map((id) => ({
    id,
    label: actionDefinitions[id].label,
    control: profile.keyboard[id].label,
  }));
}

export function visibleControllerBindings(profile: PlayerInputProfile = defaultInputProfile()) {
  return playerInputActionIds.map((id) => ({
    id,
    label: actionDefinitions[id].label,
    control: controllerBindingLabel(profile.controller[id]),
  }));
}

export function controllerProfileConfigured(profile: PlayerInputProfile): boolean {
  return playerInputActionIds.every((id) => (profile.controller[id] ?? []).length > 0);
}

export function detectGamepadReadiness(
  profile: PlayerInputProfile = defaultInputProfile(),
): GamepadReadiness {
  if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") {
    return gamepadReadiness(
      "unavailable",
      "Controller unavailable",
      "This browser surface does not expose the Gamepad API.",
    );
  }

  const gamepad = firstConnectedGamepad();
  if (!gamepad) {
    return gamepadReadiness(
      "not-detected",
      "Controller unavailable",
      "No controller detected. Keyboard input is ready.",
    );
  }

  if (!controllerProfileConfigured(profile)) {
    return gamepadReadiness(
      "mapping-missing",
      "Mapping not configured",
      "A controller is connected, but this profile does not map every player action.",
      gamepad,
    );
  }

  return gamepadReadiness(
    "detected",
    "Controller detected",
    "Controller input is mapped to the current player actions.",
    gamepad,
  );
}

export function activeGamepadActionIds(
  gamepad: Gamepad,
  profile: PlayerInputProfile = defaultInputProfile(),
): Set<PlayerInputActionId> {
  const active = new Set<PlayerInputActionId>();
  for (const id of playerInputActionIds) {
    if ((profile.controller[id] ?? []).some((binding) => isGamepadBindingActive(gamepad, binding))) {
      active.add(id);
    }
  }
  return active;
}

export function firstConnectedGamepad(): Gamepad | undefined {
  if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") {
    return undefined;
  }

  return Array.from(navigator.getGamepads()).find(
    (gamepad): gamepad is Gamepad => Boolean(gamepad && gamepad.connected),
  );
}

export function sameGamepadReadiness(a: GamepadReadiness, b: GamepadReadiness): boolean {
  return (
    a.state === b.state &&
    a.label === b.label &&
    a.detail === b.detail &&
    a.gamepadId === b.gamepadId &&
    a.gamepadIndex === b.gamepadIndex
  );
}

function normalizeInputProfile(value: unknown): PlayerInputProfile {
  const defaults = defaultInputProfile();
  if (!value || typeof value !== "object") {
    return defaults;
  }

  const candidate = value as Partial<PlayerInputProfile>;
  const keyboard = { ...defaults.keyboard };
  const hasStoredControllerProfile = Boolean(
    candidate.controller && typeof candidate.controller === "object",
  );
  const controller = hasStoredControllerProfile
    ? emptyControllerBindings()
    : cloneControllerBindings(defaults.controller);

  for (const id of playerInputActionIds) {
    const keyboardBinding = candidate.keyboard?.[id];
    if (isKeyboardBinding(keyboardBinding)) {
      keyboard[id] = keyboardBinding;
    }

    const controllerBindings = candidate.controller?.[id];
    if (Array.isArray(controllerBindings)) {
      const validBindings = controllerBindings.filter(isControllerBinding);
      if (validBindings.length > 0) {
        controller[id] = validBindings;
      }
    }
  }

  return {
    version: 1,
    source: candidate.source === "local" ? "local" : defaults.source,
    updatedAt:
      typeof candidate.updatedAt === "string" && candidate.updatedAt.length > 0
        ? candidate.updatedAt
        : defaults.updatedAt,
    keyboard,
    controller,
  };
}

function isKeyboardBinding(binding: unknown): binding is KeyboardInputBinding {
  return (
    Boolean(binding) &&
    typeof binding === "object" &&
    (binding as KeyboardInputBinding).kind === "keyboard" &&
    typeof (binding as KeyboardInputBinding).key === "string" &&
    typeof (binding as KeyboardInputBinding).label === "string"
  );
}

function isControllerBinding(binding: unknown): binding is PlayerInputBinding {
  if (!binding || typeof binding !== "object") return false;
  const candidate = binding as PlayerInputBinding;
  if (candidate.kind === "gamepad-button") {
    return Number.isInteger(candidate.index) && typeof candidate.label === "string";
  }
  if (candidate.kind === "gamepad-axis") {
    return (
      Number.isInteger(candidate.axis) &&
      (candidate.direction === -1 || candidate.direction === 1) &&
      typeof candidate.threshold === "number" &&
      typeof candidate.label === "string"
    );
  }
  return false;
}

function cloneControllerBindings(
  bindings: Record<PlayerInputActionId, PlayerInputBinding[]>,
): Record<PlayerInputActionId, PlayerInputBinding[]> {
  return Object.fromEntries(
    playerInputActionIds.map((id) => [id, bindings[id].map((binding) => ({ ...binding }))]),
  ) as Record<PlayerInputActionId, PlayerInputBinding[]>;
}

function emptyControllerBindings(): Record<PlayerInputActionId, PlayerInputBinding[]> {
  return playerInputActionIds.reduce(
    (bindings, id) => ({
      ...bindings,
      [id]: [],
    }),
    {} as Record<PlayerInputActionId, PlayerInputBinding[]>,
  );
}

function normalizeKeyboardKey(key: string) {
  return key.length === 1 ? key.toLowerCase() : key;
}

function controllerBindingLabel(bindings: PlayerInputBinding[] = []) {
  if (bindings.length === 0) return "Not configured";
  return bindings.map((binding) => binding.label).join(" / ");
}

function isGamepadBindingActive(gamepad: Gamepad, binding: PlayerInputBinding) {
  if (binding.kind === "gamepad-button") {
    const button = gamepad.buttons[binding.index];
    return Boolean(button && (button.pressed || button.value >= 0.5));
  }

  if (binding.kind === "gamepad-axis") {
    const value = gamepad.axes[binding.axis] ?? 0;
    return binding.direction < 0 ? value <= -binding.threshold : value >= binding.threshold;
  }

  return false;
}

function gamepadReadiness(
  state: GamepadReadinessState,
  label: string,
  detail: string,
  gamepad?: Gamepad,
): GamepadReadiness {
  return {
    state,
    label,
    detail,
    gamepadId: gamepad?.id,
    gamepadIndex: gamepad?.index,
  };
}
