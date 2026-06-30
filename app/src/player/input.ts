import type { PlayerInputAction } from "./types";

export const keyboardInputActions: PlayerInputAction[] = [
  {
    id: "dpad.left",
    label: "Left",
    control: "Arrows",
    detail: "D-pad left",
    event: "input.keyboard.left",
    spriteDelta: -6,
  },
  {
    id: "dpad.right",
    label: "Right",
    control: "Arrows",
    detail: "D-pad right",
    event: "input.keyboard.right",
    spriteDelta: 6,
  },
  {
    id: "dpad.up",
    label: "Up",
    control: "Arrows",
    detail: "D-pad up",
    event: "input.keyboard.up",
  },
  {
    id: "dpad.down",
    label: "Down",
    control: "Arrows",
    detail: "D-pad down",
    event: "input.keyboard.down",
  },
  {
    id: "button.a",
    label: "A",
    control: "Z",
    detail: "Genesis A button",
    event: "input.keyboard.a",
  },
  {
    id: "button.b",
    label: "B",
    control: "X",
    detail: "Genesis B button",
    event: "input.keyboard.b",
  },
  {
    id: "button.c",
    label: "C",
    control: "C",
    detail: "Genesis C button",
    event: "input.keyboard.c",
  },
  {
    id: "button.start",
    label: "Start",
    control: "Enter",
    detail: "Genesis Start button",
    event: "input.keyboard.start",
  },
];

export function playerInputActionFromKey(key: string): PlayerInputAction | undefined {
  switch (key) {
    case "ArrowLeft":
      return keyboardInputActions[0];
    case "ArrowRight":
      return keyboardInputActions[1];
    case "ArrowUp":
      return keyboardInputActions[2];
    case "ArrowDown":
      return keyboardInputActions[3];
    case "z":
    case "Z":
      return keyboardInputActions[4];
    case "x":
    case "X":
      return keyboardInputActions[5];
    case "c":
    case "C":
      return keyboardInputActions[6];
    case "Enter":
      return keyboardInputActions[7];
    default:
      return undefined;
  }
}

export function visibleKeyboardMappings() {
  return [
    { control: "Arrows", label: "D-pad" },
    { control: "Z", label: "A" },
    { control: "X", label: "B" },
    { control: "C", label: "C" },
    { control: "Enter", label: "Start" },
  ];
}
