/** Color value — CSS color string or grayscale number (0–255). */
export type Color = string | number;

/** Configuration options for creating a Codaloop runtime. */
export interface RuntimeOptions {
  /** Target canvas element. If not provided, one is created and appended to body. */
  canvas?: HTMLCanvasElement;
  /** Parent element to append auto-created canvas to. Defaults to document.body. */
  parent?: HTMLElement;
  /** Initial canvas width. Defaults to 400. */
  width?: number;
  /** Initial canvas height. Defaults to 400. */
  height?: number;
}

/** Text alignment options. */
export type TextAlign = "left" | "center" | "right";

/** The drawing state tracked by the runtime. */
export interface DrawState {
  fillEnabled: boolean;
  fillColor: string;
  strokeEnabled: boolean;
  strokeColor: string;
  strokeW: number;
  textSz: number;
  textAlign: CanvasTextAlign;
}

/** Error info posted from iframe to parent. */
export interface CodaloopError {
  type: "codaloop-error";
  message: string;
  line?: number;
  col?: number;
}

/** User-defined lifecycle callbacks. */
export interface UserCallbacks {
  setup?: () => void;
  draw?: () => void;
  keyPressed?: () => void;
  keyReleased?: () => void;
}

/** Thumbnail capture request from parent frame. */
export interface CodaloopCapture {
  type: "codaloop-capture";
}

/** Thumbnail response posted back to parent frame. */
export interface CodaloopThumbnail {
  type: "codaloop-thumbnail";
  dataUrl: string;
}

/** A sprite — a movable game object with position, size, velocity, and color. */
export interface Sprite {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  color: string;
  visible: boolean;
}

/** A pixel art image — a grid of colored pixels created from string rows. */
export interface PixelImage {
  pixels: (string | null)[][];
  width: number;
  height: number;
}

/** Available sound effect presets for playSound(). */
export type SoundPreset =
  | "beep"
  | "coin"
  | "jump"
  | "hit"
  | "explosion"
  | "powerup"
  | "laser"
  | "pop";

/** Available drum presets for playDrum(). */
export type DrumPreset = "kick" | "snare" | "hihat";
