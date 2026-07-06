import {
  Gamepad2,
  KeyRound,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RefreshCcw,
  Settings,
  Square,
  Volume2,
  Wrench,
  X,
} from "lucide-react";
import type { KeyboardEvent, MutableRefObject, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  GamepadReadiness,
  PlayerAudioState,
  PlayerInputActionId,
  PlayerSessionState,
} from "../player";
import { base64ToBytes } from "./ui";

type TransportState = "running" | "paused";

type FramebufferFrame = {
  frameIndex: number;
  width: number;
  height: number;
  format: string;
  rgb565Data: string;
};

type ScreenSource = {
  screenshotDataUrl: string;
  framebufferFrames: FramebufferFrame[];
  streamEvery: number;
};

type BindingRow = { id: PlayerInputActionId; label: string; control: string };
type MappingRow = { control: string; label: string };

export function PlayerPane({
  canvasRef,
  controllerBindings,
  controllerConfigured,
  controlsOpen,
  emulatorFocused,
  gamepadReadiness,
  keyboardBindings,
  keyboardMappings,
  lastInputAction,
  playerAudio,
  playerCanvasActive,
  playerState,
  profileSource,
  romInputFocused,
  romLabel,
  sessionActive,
  spriteX,
  starterBusy,
  starterRom,
  stateLabel,
  transport,
  viewportRef,
  onCloseControls,
  onPlay,
  onResetPlayer,
  onResetProfile,
  onScreenBlur,
  onScreenClick,
  onScreenFocus,
  onScreenKeyDown,
  onScreenKeyUp,
  onStop,
  onToggleControls,
  onToggleFocus,
  onToggleMute,
  onTogglePause,
}: {
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  controllerBindings: BindingRow[];
  controllerConfigured: boolean;
  controlsOpen: boolean;
  emulatorFocused: boolean;
  gamepadReadiness: GamepadReadiness;
  keyboardBindings: BindingRow[];
  keyboardMappings: MappingRow[];
  lastInputAction: string;
  playerAudio: PlayerAudioState;
  playerCanvasActive: boolean;
  playerState: PlayerSessionState;
  profileSource: string;
  romInputFocused: boolean;
  romLabel: string;
  sessionActive: boolean;
  spriteX: number;
  starterBusy: boolean;
  starterRom: ScreenSource;
  stateLabel: string;
  transport: TransportState;
  viewportRef: MutableRefObject<HTMLDivElement | null>;
  onCloseControls: () => void;
  onPlay: () => void;
  onResetPlayer: () => void;
  onResetProfile: () => void;
  onScreenBlur: () => void;
  onScreenClick: () => void;
  onScreenFocus: () => void;
  onScreenKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onScreenKeyUp: (event: KeyboardEvent<HTMLDivElement>) => void;
  onStop: () => void;
  onToggleControls: () => void;
  onToggleFocus: () => void;
  onToggleMute: () => void;
  onTogglePause: () => void;
}) {
  const interactive = playerCanvasActive || playerState === "loading";
  const screenMode = interactive
    ? "interactive"
    : starterRom.framebufferFrames.length > 0
      ? "framebuffer"
      : starterRom.screenshotDataUrl
        ? "captured"
        : "fallback";

  return (
    <section className="player-pane" aria-label="Game player">
      <div className="screen-stage">
        <div className="screen-bezel">
          <div
            className={`genesis-screen ${transport} ${screenMode} ${
              romInputFocused ? "input-focused" : ""
            }`}
            ref={viewportRef}
            role="application"
            tabIndex={0}
            data-testid="starter-rom-screen"
            onBlur={onScreenBlur}
            onClick={onScreenClick}
            onFocus={onScreenFocus}
            onKeyDown={onScreenKeyDown}
            onKeyUp={onScreenKeyUp}
          >
            <canvas
              ref={canvasRef}
              aria-label="Interactive Genesis player"
              className={`nostalgist-canvas ${interactive ? "active" : ""}`}
              data-testid="interactive-player-canvas"
            />
            {interactive ? (
              playerState === "loading" ? (
                <span className="player-loading">LOADING PLAYER</span>
              ) : null
            ) : (
              <FramebufferCanvas
                fallback={
                  starterRom.screenshotDataUrl ? (
                    <img
                      className="starter-frame"
                      src={starterRom.screenshotDataUrl}
                      alt="Project ROM frame"
                    />
                  ) : (
                    <>
                      <div className="scanlines" />
                      <span className="screen-title">DRIVE16</span>
                      <span className="screen-status">
                        {starterBusy
                          ? "LOADING"
                          : transport === "running"
                            ? "PREVIEW"
                            : "PAUSED"}
                      </span>
                      <span
                        className="sprite-cursor"
                        style={{ left: `${spriteX}%` }}
                        aria-hidden="true"
                      />
                    </>
                  )
                }
                frames={starterRom.framebufferFrames}
              />
            )}
          </div>
        </div>
      </div>

      <div className="player-controls" aria-label="Player controls">
        <button
          type="button"
          className="control-primary"
          data-testid="play-active-rom"
          onClick={onPlay}
          disabled={playerState === "loading" || playerState === "playing"}
        >
          <Play size={15} />
          {playerState === "loading" ? "Preparing" : "Play ROM"}
        </button>
        {sessionActive ? (
          <>
            <button type="button" data-testid="pause-player" onClick={onTogglePause}>
              {playerState === "paused" ? <Play size={15} /> : <Pause size={15} />}
              {playerState === "paused" ? "Resume" : "Pause"}
            </button>
            <button type="button" data-testid="reset-player" onClick={onResetPlayer}>
              <RefreshCcw size={15} />
              Reset
            </button>
            <button type="button" data-testid="stop-player" onClick={onStop}>
              <Square size={15} />
              Stop
            </button>
          </>
        ) : null}
        <span className="control-spacer" aria-hidden="true" />
        <button
          type="button"
          className={`player-audio-toggle ${playerAudio}`}
          data-testid="player-audio-toggle"
          title={
            playerAudio === "unavailable"
              ? "Click to enable sound"
              : playerAudio === "muted"
                ? "Unmute"
                : "Mute"
          }
          onClick={onToggleMute}
        >
          <Volume2 size={15} />
          {playerAudio === "audible" ? "Sound on" : playerAudio === "muted" ? "Muted" : "Sound off"}
        </button>
        <button
          type="button"
          data-testid="open-controls"
          aria-expanded={controlsOpen}
          onClick={onToggleControls}
        >
          <Gamepad2 size={15} />
          Controls
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label={emulatorFocused ? "Exit full screen" : "Full screen"}
          title={emulatorFocused ? "Exit full screen" : "Full screen"}
          onClick={onToggleFocus}
        >
          {emulatorFocused ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>
      </div>

      <p className="player-status" data-testid="player-status">
        <strong>{romLabel}</strong>
        <span className="status-sep" aria-hidden="true">
          ·
        </span>
        <span>{stateLabel}</span>
      </p>

      {controlsOpen ? (
        <InputControlsPanel
          controllerBindings={controllerBindings}
          controllerConfigured={controllerConfigured}
          gamepadReadiness={gamepadReadiness}
          keyboardBindings={keyboardBindings}
          keyboardMappings={keyboardMappings}
          lastInput={lastInputAction}
          profileSource={profileSource}
          onClose={onCloseControls}
          onReset={onResetProfile}
        />
      ) : null}
    </section>
  );
}

function InputControlsPanel({
  controllerBindings,
  controllerConfigured,
  gamepadReadiness,
  keyboardBindings,
  keyboardMappings,
  lastInput,
  profileSource,
  onClose,
  onReset,
}: {
  controllerBindings: BindingRow[];
  controllerConfigured: boolean;
  gamepadReadiness: GamepadReadiness;
  keyboardBindings: BindingRow[];
  keyboardMappings: MappingRow[];
  lastInput: string;
  profileSource: string;
  onClose: () => void;
  onReset: () => void;
}) {
  const profileLabel = profileSource === "local" ? "Saved locally" : "Default profile";
  const mappingLabel = controllerConfigured ? "Default mapping" : "Mapping not configured";
  const controllerDetail =
    gamepadReadiness.gamepadId && gamepadReadiness.state === "detected"
      ? `${gamepadReadiness.detail} ${gamepadReadiness.gamepadId}`
      : gamepadReadiness.detail;

  return (
    <div className={`controls-panel ${gamepadReadiness.state}`} data-testid="controls-panel">
      <div className="controls-panel-head">
        <span>
          <Gamepad2 size={15} />
          <strong>Controls</strong>
          <small>{profileLabel}</small>
        </span>
        <button type="button" data-testid="close-controls" onClick={onClose}>
          <X size={14} />
          Close
        </button>
      </div>
      <div className="rom-key-map" data-testid="rom-controls" aria-label="Keyboard mapping">
        {keyboardMappings.map((mapping) => (
          <span key={`${mapping.control}-${mapping.label}`}>
            <kbd>{mapping.control}</kbd>
            {mapping.label}
          </span>
        ))}
      </div>
      <div className="input-status-grid">
        <span data-testid="keyboard-readiness">
          <KeyRound size={15} />
          <strong>Keyboard ready</strong>
        </span>
        <span data-testid="controller-readiness" title={controllerDetail}>
          <Gamepad2 size={15} />
          <strong>{gamepadReadiness.label}</strong>
        </span>
        <span data-testid="controller-mapping-state">
          <Wrench size={15} />
          <strong>{mappingLabel}</strong>
        </span>
      </div>
      <div className="input-binding-grid">
        <section aria-label="Keyboard bindings">
          <h4>Keyboard</h4>
          <div className="input-binding-list">
            {keyboardBindings.map((binding) => (
              <span key={`keyboard-${binding.id}`}>
                <kbd>{binding.control}</kbd>
                {binding.label}
              </span>
            ))}
          </div>
        </section>
        <section aria-label="Controller bindings">
          <h4>Controller</h4>
          <div className="input-binding-list controller">
            {controllerBindings.map((binding) => (
              <span key={`controller-${binding.id}`}>
                <small>{binding.control}</small>
                {binding.label}
              </span>
            ))}
          </div>
        </section>
      </div>
      <div className="controls-panel-actions">
        <span className="controls-last-input">
          Last input
          <strong data-testid="rom-last-input">{lastInput}</strong>
        </span>
        <button type="button" data-testid="reset-input-profile" onClick={onReset}>
          <RefreshCcw size={14} />
          Reset defaults
        </button>
      </div>
    </div>
  );
}

function FramebufferCanvas({
  fallback,
  frames,
}: {
  fallback: ReactNode;
  frames: FramebufferFrame[];
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const decodedFrames = useMemo(() => decodeFramebufferFrames(frames), [frames]);
  // Show the settled screen, not a replay: the captured stream starts with
  // boot-black frames and looping them reads as a broken, flashing display.
  const activeFrame =
    decodedFrames.length > 0 ? decodedFrames[decodedFrames.length - 1] : null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activeFrame) return;

    canvas.width = activeFrame.width;
    canvas.height = activeFrame.height;
    const context = canvas.getContext("2d");
    if (!context) return;

    const imageData = context.createImageData(activeFrame.width, activeFrame.height);
    imageData.data.set(activeFrame.rgba);
    context.putImageData(imageData, 0, 0);
  }, [activeFrame]);

  if (!activeFrame) {
    return <>{fallback}</>;
  }

  return (
    <canvas
      ref={canvasRef}
      aria-label="ROM preview frames"
      className="framebuffer-canvas"
      data-frame-index={activeFrame.frameIndex}
      data-testid="framebuffer-canvas"
    />
  );
}

function decodeFramebufferFrames(frames: FramebufferFrame[]) {
  return frames.flatMap((frame) => {
    if (frame.format !== "RGB565") return [];
    const bytes = base64ToBytes(frame.rgb565Data);
    const expectedLength = frame.width * frame.height * 2;
    if (bytes.length !== expectedLength) return [];

    const rgba = new Uint8ClampedArray(frame.width * frame.height * 4);
    for (let sourceIndex = 0, targetIndex = 0; sourceIndex < bytes.length; sourceIndex += 2) {
      const value = bytes[sourceIndex] | (bytes[sourceIndex + 1] << 8);
      const red = (value >> 11) & 0x1f;
      const green = (value >> 5) & 0x3f;
      const blue = value & 0x1f;
      rgba[targetIndex] = (red << 3) | (red >> 2);
      rgba[targetIndex + 1] = (green << 2) | (green >> 4);
      rgba[targetIndex + 2] = (blue << 3) | (blue >> 2);
      rgba[targetIndex + 3] = 255;
      targetIndex += 4;
    }

    return [
      {
        frameIndex: frame.frameIndex,
        width: frame.width,
        height: frame.height,
        rgba,
      },
    ];
  });
}
