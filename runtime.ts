/**
 * Codaloop Runtime — a simplified game programming API inspired by Processing/p5.js.
 *
 * Creates a canvas, exposes drawing primitives as simple functions,
 * and runs a requestAnimationFrame game loop calling the user's draw() function.
 *
 * @module
 */

import type {
  CodaloopError,
  CodaloopThumbnail,
  Color,
  DrawState,
  DrumPreset,
  PixelImage,
  RuntimeOptions,
  SoundPreset,
  Sprite,
  TextAlign,
  UserCallbacks,
} from "./types.ts";

import { buildSprite, spriteLibrary, spriteNames } from "./sprites.ts";

/** Options for the gridHelper() overlay. All fields are optional. */
interface GridHelperOptions {
  gridSize?: number;
  gridColor?: string;
  labelColor?: string;
  markerColor?: string;
}

/** Maximum iterations allowed in a single loop before we consider it infinite. */
const MAX_LOOP_ITERATIONS = 100_000;

/** Resolve a Color value to a CSS color string. */
function resolveColor(c: Color): string {
  if (typeof c === "number") {
    const v = Math.max(0, Math.min(255, Math.round(c)));
    return `rgb(${v},${v},${v})`;
  }
  return c;
}

/**
 * The core Codaloop runtime class. Manages the canvas, drawing state,
 * input tracking, the game loop, and user callback invocation.
 */
export class CodaloopRuntime {
  // --- Canvas & context ---
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;

  // --- Dimensions ---
  private _width: number;
  private _height: number;

  // --- Drawing state ---
  private state: DrawState = {
    fillEnabled: true,
    fillColor: "white",
    strokeEnabled: true,
    strokeColor: "black",
    strokeW: 1,
    textSz: 12,
    textAlign: "left",
  };

  // --- State stack for push/pop ---
  private _stateStack: DrawState[] = [];

  // --- Input state ---
  private _mouseX = 0;
  private _mouseY = 0;
  private _mouseIsPressed = false;
  private _key = "";
  private _keyIsPressed = false;
  private _keysDown: Set<string> = new Set();

  // --- Grid helper state ---
  private _gridHelperEnabled = false;
  private _gridHelperOpts: GridHelperOptions = {};
  private _gridPinX: number | null = null;
  private _gridPinY: number | null = null;

  // --- Loop state ---
  private _frameCount = 0;
  private _running = false;
  private _animFrameId = 0;

  // --- Audio ---
  private _audioCtx: AudioContext | null = null;

  // --- User callbacks ---
  private _userSetup?: () => void;
  private _userDraw?: () => void;
  private _userKeyPressed?: () => void;
  private _userKeyReleased?: () => void;

  constructor(options: RuntimeOptions = {}) {
    this._width = options.width ?? 400;
    this._height = options.height ?? 400;

    if (options.canvas) {
      this.canvas = options.canvas;
    } else {
      this.canvas = document.createElement("canvas");
      const parent = options.parent ?? document.body;
      parent.appendChild(this.canvas);
    }

    const dpr = globalThis.devicePixelRatio ?? 1;
    this.canvas.width = this._width * dpr;
    this.canvas.height = this._height * dpr;
    this.canvas.style.width = `${this._width}px`;
    this.canvas.style.height = `${this._height}px`;
    this.canvas.style.display = "block";

    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get 2D canvas context");
    this.ctx = ctx;
    this.ctx.scale(dpr, dpr);

    this._setupInputListeners();
  }

  // ─── Dimensions (read-only) ────────────────────────────────────────

  get width(): number {
    return this._width;
  }

  get height(): number {
    return this._height;
  }

  get frameCount(): number {
    return this._frameCount;
  }

  // ─── Input (read-only) ─────────────────────────────────────────────

  get mouseX(): number {
    return this._mouseX;
  }

  get mouseY(): number {
    return this._mouseY;
  }

  get mouseIsPressed(): boolean {
    return this._mouseIsPressed;
  }

  get key(): string {
    return this._key;
  }

  get keyIsPressed(): boolean {
    return this._keyIsPressed;
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────

  /** Set the canvas size. Call with no arguments to fill the window. */
  size(w?: number, h?: number): void {
    if (w === undefined || h === undefined) {
      const parent = this.canvas.parentElement ?? document.body;
      w = parent.clientWidth;
      h = parent.clientHeight;
    }
    this._width = w;
    this._height = h;
    const dpr = globalThis.devicePixelRatio ?? 1;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.scale(dpr, dpr);
  }

  /** Clear the canvas with a solid color. */
  background(color: Color): void {
    this.ctx.save();
    this.ctx.fillStyle = resolveColor(color);
    this.ctx.fillRect(0, 0, this._width, this._height);
    this.ctx.restore();
  }

  // ─── Style ─────────────────────────────────────────────────────────

  /** Set the fill color for subsequent shapes. */
  fill(color: Color): void {
    this.state.fillEnabled = true;
    this.state.fillColor = resolveColor(color);
  }

  /** Set the stroke (outline) color for subsequent shapes. */
  stroke(color: Color): void {
    this.state.strokeEnabled = true;
    this.state.strokeColor = resolveColor(color);
  }

  /** Disable fill for subsequent shapes. */
  noFill(): void {
    this.state.fillEnabled = false;
  }

  /** Disable stroke for subsequent shapes. */
  noStroke(): void {
    this.state.strokeEnabled = false;
  }

  /** Set the stroke thickness. */
  strokeWeight(weight: number): void {
    this.state.strokeW = weight;
  }

  /** Set the text size in pixels. */
  textSize(size: number): void {
    this.state.textSz = size;
  }

  /** Set the text alignment: "left", "center", or "right". */
  textAlign(align: TextAlign): void {
    this.state.textAlign = align;
  }

  // ─── Shape drawing ─────────────────────────────────────────────────

  /** Apply current fill and stroke state to a path, then draw it. */
  private _applyStyle(): void {
    if (this.state.fillEnabled) {
      this.ctx.fillStyle = this.state.fillColor;
    }
    if (this.state.strokeEnabled) {
      this.ctx.strokeStyle = this.state.strokeColor;
      this.ctx.lineWidth = this.state.strokeW;
    }
  }

  /** Draw a rectangle. */
  rect(x: number, y: number, w: number, h: number): void {
    this._applyStyle();
    if (this.state.fillEnabled) {
      this.ctx.fillRect(x, y, w, h);
    }
    if (this.state.strokeEnabled) {
      this.ctx.strokeRect(x, y, w, h);
    }
  }

  /** Draw a circle (centered at x, y with radius r). */
  circle(x: number, y: number, r: number): void {
    this._applyStyle();
    this.ctx.beginPath();
    this.ctx.arc(x, y, r, 0, Math.PI * 2);
    if (this.state.fillEnabled) {
      this.ctx.fill();
    }
    if (this.state.strokeEnabled) {
      this.ctx.stroke();
    }
  }

  /** Draw a line from (x1, y1) to (x2, y2). */
  line(x1: number, y1: number, x2: number, y2: number): void {
    this._applyStyle();
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    if (this.state.strokeEnabled) {
      this.ctx.stroke();
    }
  }

  /** Draw a triangle with three vertices. */
  triangle(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
  ): void {
    this._applyStyle();
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.lineTo(x3, y3);
    this.ctx.closePath();
    if (this.state.fillEnabled) {
      this.ctx.fill();
    }
    if (this.state.strokeEnabled) {
      this.ctx.stroke();
    }
  }

  /** Draw an ellipse (oval) centered at (x, y) with width w and height h. */
  ellipse(x: number, y: number, w: number, h: number): void {
    this._applyStyle();
    this.ctx.beginPath();
    this.ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2);
    if (this.state.fillEnabled) {
      this.ctx.fill();
    }
    if (this.state.strokeEnabled) {
      this.ctx.stroke();
    }
  }

  /** Draw an arc (partial circle). Angles in degrees (0 = right, 90 = down). */
  arc(
    x: number,
    y: number,
    r: number,
    startAngle: number,
    stopAngle: number,
  ): void {
    this._applyStyle();
    this.ctx.beginPath();
    this.ctx.arc(
      x,
      y,
      r,
      startAngle * Math.PI / 180,
      stopAngle * Math.PI / 180,
    );
    if (this.state.fillEnabled) {
      this.ctx.fill();
    }
    if (this.state.strokeEnabled) {
      this.ctx.stroke();
    }
  }

  /** Draw text at position (x, y). */
  text(str: string, x: number, y: number): void {
    this._applyStyle();
    this.ctx.font = `${this.state.textSz}px sans-serif`;
    this.ctx.textBaseline = "top";
    this.ctx.textAlign = this.state.textAlign;
    if (this.state.fillEnabled) {
      this.ctx.fillText(String(str), x, y);
    }
    if (this.state.strokeEnabled) {
      this.ctx.strokeText(String(str), x, y);
    }
  }

  // ─── Input functions ───────────────────────────────────────────────

  /** Returns true if the given key is currently held down. */
  keyIsDown(k: string): boolean {
    return this._keysDown.has(k);
  }

  // ─── Math helpers ──────────────────────────────────────────────────

  /** Return a random number. With one arg: 0..max. With two: min..max. */
  random(a: number, b?: number): number {
    if (b === undefined) {
      return Math.random() * a;
    }
    return a + Math.random() * (b - a);
  }

  /** Euclidean distance between two points. */
  dist(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  }

  /** Constrain a value between a low and high bound. */
  constrain(val: number, lo: number, hi: number): number {
    return Math.min(hi, Math.max(lo, val));
  }

  /** Remap a value from one range to another. */
  map(
    value: number,
    fromLow: number,
    fromHigh: number,
    toLow: number,
    toHigh: number,
  ): number {
    return toLow + (value - fromLow) / (fromHigh - fromLow) * (toHigh - toLow);
  }

  /** Linear interpolation: returns a + (b - a) * t. */
  lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  /** Integer random. One arg: 0..a-1. Two args: a..b inclusive. */
  randomInt(a: number, b?: number): number {
    if (b === undefined) {
      return Math.floor(Math.random() * a);
    }
    return Math.floor(Math.random() * (b - a + 1)) + a;
  }

  // ─── Color ──────────────────────────────────────────────────────

  /** Create an RGBA color string. r/g/b: 0–255, a: 0–255 (default 255). */
  color(r: number, g: number, b: number, a = 255): string {
    return `rgba(${r},${g},${b},${a / 255})`;
  }

  // ─── State management ───────────────────────────────────────────

  /** Save current drawing state and canvas transforms onto a stack. */
  push(): void {
    this._stateStack.push({ ...this.state });
    this.ctx.save();
  }

  /** Restore the last saved drawing state from the stack. */
  pop(): void {
    const saved = this._stateStack.pop();
    if (saved) {
      this.state = saved;
    }
    this.ctx.restore();
  }

  // ─── Transforms ─────────────────────────────────────────────────

  /** Shift the origin point. Use with push/pop. */
  translate(x: number, y: number): void {
    this.ctx.translate(x, y);
  }

  /** Rotate subsequent drawing. Angle in degrees. Use with push/pop. */
  rotate(angle: number): void {
    this.ctx.rotate(angle * Math.PI / 180);
  }

  // ─── Loop control ───────────────────────────────────────────────

  /** Stop the draw() loop. Canvas stays visible. */
  noLoop(): void {
    this._running = false;
    if (this._animFrameId) {
      cancelAnimationFrame(this._animFrameId);
      this._animFrameId = 0;
    }
  }

  /** Restart draw() loop after noLoop(). */
  loop(): void {
    if (!this._running) {
      this._running = true;
      this._loop();
    }
  }

  // ─── Sprites & collision ─────────────────────────────────────────

  /** Create a new sprite — a movable game object. */
  createSprite(x: number, y: number, w: number, h: number): Sprite {
    return { x, y, w, h, vx: 0, vy: 0, color: "white", visible: true };
  }

  /** Draw a sprite as a colored rectangle. Uses the sprite's own color, ignoring fill/stroke. */
  drawSprite(sprite: Sprite): void {
    if (!sprite.visible) return;
    this.ctx.fillStyle = sprite.color;
    this.ctx.fillRect(sprite.x, sprite.y, sprite.w, sprite.h);
  }

  /** Move a sprite by its velocity (x += vx, y += vy). */
  moveSprite(sprite: Sprite): void {
    sprite.x += sprite.vx;
    sprite.y += sprite.vy;
  }

  /** Check if two sprites are overlapping (AABB collision test). */
  collides(a: Sprite, b: Sprite): boolean {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  /** Check if a point (x, y) is inside a sprite. */
  overlap(sprite: Sprite, x: number, y: number): boolean {
    return x >= sprite.x && x <= sprite.x + sprite.w && y >= sprite.y &&
      y <= sprite.y + sprite.h;
  }

  /** Apply gravity to a sprite by increasing its vertical velocity. */
  applyGravity(sprite: Sprite, amount = 0.5): void {
    sprite.vy += amount;
  }

  /** Bounce a sprite off the canvas edges, reversing velocity and clamping position. */
  bounceEdges(sprite: Sprite): void {
    if (sprite.x < 0) {
      sprite.x = 0;
      sprite.vx *= -1;
    }
    if (sprite.x + sprite.w > this._width) {
      sprite.x = this._width - sprite.w;
      sprite.vx *= -1;
    }
    if (sprite.y < 0) {
      sprite.y = 0;
      sprite.vy *= -1;
    }
    if (sprite.y + sprite.h > this._height) {
      sprite.y = this._height - sprite.h;
      sprite.vy *= -1;
    }
  }

  // ─── Pixel art ──────────────────────────────────────────────────────

  /** Create a pixel art image from string rows and a color map. '.' and ' ' are transparent. */
  createImage(rows: string[], colorMap: Record<string, string>): PixelImage {
    const pixels: (string | null)[][] = [];
    for (const row of rows) {
      const pixelRow: (string | null)[] = [];
      for (const char of row) {
        if (char === "." || char === " ") {
          pixelRow.push(null);
        } else {
          pixelRow.push(colorMap[char] ?? null);
        }
      }
      pixels.push(pixelRow);
    }
    return {
      pixels,
      width: pixels.length > 0 ? Math.max(...pixels.map((r) => r.length)) : 0,
      height: pixels.length,
    };
  }

  /** Draw a pixel art image at (x, y) with an optional scale multiplier. */
  drawImage(image: PixelImage, x: number, y: number, scale = 1): void {
    for (let row = 0; row < image.pixels.length; row++) {
      for (let col = 0; col < image.pixels[row].length; col++) {
        const color = image.pixels[row][col];
        if (color !== null) {
          this.ctx.fillStyle = color;
          this.ctx.fillRect(x + col * scale, y + row * scale, scale, scale);
        }
      }
    }
  }

  /** Get a built-in pixel art sprite by name, optionally overriding colors. */
  getImage(name: string, colors?: Record<string, string>): PixelImage {
    const data = spriteLibrary[name];
    if (!data) {
      throw new Error(
        `No built-in sprite called "${name}". Available sprites: ${
          spriteNames.join(", ")
        }`,
      );
    }
    if (colors) {
      const validNames = Object.keys(data.palette);
      for (const key of Object.keys(colors)) {
        if (!(key in data.palette)) {
          throw new Error(
            `Unknown color "${key}" for "${name}". Available colors: ${
              validNames.join(", ")
            }`,
          );
        }
      }
    }
    return buildSprite(data, colors);
  }

  // ─── Sound & music ──────────────────────────────────────────────────

  /** Get or create the AudioContext, resuming it if suspended. */
  private _getAudioCtx(): AudioContext {
    if (!this._audioCtx) {
      this._audioCtx = new AudioContext();
    }
    if (this._audioCtx.state === "suspended") {
      this._audioCtx.resume();
    }
    return this._audioCtx;
  }

  /** Convert a musical note name like "C4" or "F#5" to its frequency in Hz. */
  private _noteToFreq(note: string): number {
    const noteMap: Record<string, number> = {
      "C": 0,
      "D": 2,
      "E": 4,
      "F": 5,
      "G": 7,
      "A": 9,
      "B": 11,
    };
    const match = note.match(/^([A-G])(#|b)?(\d)$/);
    if (!match) return 440;
    let semitone = noteMap[match[1]];
    if (match[2] === "#") semitone++;
    if (match[2] === "b") semitone--;
    const octave = parseInt(match[3], 10);
    const midi = semitone + (octave + 1) * 12;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  /** Play a built-in sound effect preset. */
  playSound(name: SoundPreset): void {
    const ctx = this._getAudioCtx();
    const now = ctx.currentTime;

    switch (name) {
      case "beep": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 440;
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.1);
        break;
      }
      case "coin": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(659.25, now);
        osc.frequency.setValueAtTime(987.77, now + 0.075);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
        break;
      }
      case "jump": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.2);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.2);
        break;
      }
      case "hit": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
        break;
      }
      case "explosion": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(20, now + 0.5);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.5);
        break;
      }
      case "powerup": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(261.63, now);
        osc.frequency.setValueAtTime(329.63, now + 0.1);
        osc.frequency.setValueAtTime(392.00, now + 0.2);
        osc.frequency.setValueAtTime(523.25, now + 0.3);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.4);
        break;
      }
      case "laser": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(1500, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
        break;
      }
      case "pop": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.08);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
        break;
      }
    }
  }

  /** Play a musical note by name (e.g. "C4", "F#5"). Duration in milliseconds. */
  playNote(note: string, duration: number, volume = 0.3): void {
    const ctx = this._getAudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = this._noteToFreq(note);
    const dur = duration / 1000;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur);
  }

  /** Play a drum sound preset. */
  playDrum(name: DrumPreset): void {
    const ctx = this._getAudioCtx();
    const now = ctx.currentTime;

    switch (name) {
      case "kick": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.15);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
        break;
      }
      case "snare": {
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = "triangle";
        osc1.frequency.value = 200;
        gain1.gain.setValueAtTime(0.4, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc1.connect(gain1).connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.12);
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = "sawtooth";
        osc2.frequency.value = 3000;
        gain2.gain.setValueAtTime(0.2, now);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc2.connect(gain2).connect(ctx.destination);
        osc2.start(now);
        osc2.stop(now + 0.12);
        break;
      }
      case "hihat": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.value = 6000;
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.06);
        break;
      }
    }
  }

  // ─── Grid helper ───────────────────────────────────────────────────

  /** Enable a coordinate grid overlay with mouse crosshair. Call once in setup(). */
  gridHelper(opts?: GridHelperOptions): void {
    this._gridHelperEnabled = true;
    this._gridHelperOpts = opts ?? {};
  }

  /** Render the grid overlay on top of the current frame. */
  private _drawGridOverlay(): void {
    const {
      gridSize = 50,
      gridColor = "rgba(0,0,0,0.15)",
      labelColor = "rgba(0,0,0,0.4)",
      markerColor = "red",
    } = this._gridHelperOpts;

    const ctx = this.ctx;
    const w = this._width;
    const h = this._height;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Grid lines
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = gridSize; x < w; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = gridSize; y < h; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    // Labels along edges
    ctx.fillStyle = labelColor;
    ctx.font = "10px sans-serif";
    ctx.textBaseline = "top";
    ctx.textAlign = "center";
    for (let x = gridSize; x < w; x += gridSize) {
      ctx.fillText(String(x), x, 2);
    }
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    for (let y = gridSize; y < h; y += gridSize) {
      ctx.fillText(String(y), 2, y);
    }

    // Active position (pinned or mouse)
    const mx = this._gridPinX ?? this._mouseX;
    const my = this._gridPinY ?? this._mouseY;

    // Crosshair lines
    ctx.strokeStyle = markerColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, my);
    ctx.lineTo(w, my);
    ctx.moveTo(mx, 0);
    ctx.lineTo(mx, h);
    ctx.stroke();

    // Dot
    ctx.fillStyle = markerColor;
    ctx.beginPath();
    ctx.arc(mx, my, 4, 0, Math.PI * 2);
    ctx.fill();

    // Coordinate label (offset to stay on-screen)
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = mx > w - 80 ? "right" : "left";
    ctx.textBaseline = my < 20 ? "top" : "bottom";
    const offsetX = mx > w - 80 ? -8 : 8;
    const offsetY = my < 20 ? 8 : -8;
    ctx.fillText(
      `(${Math.round(mx)}, ${Math.round(my)})`,
      mx + offsetX,
      my + offsetY,
    );

    ctx.restore();
  }

  // ─── Error reporting ───────────────────────────────────────────────

  /** Post an error to the parent frame. */
  private _reportError(err: unknown, context: string): void {
    let message = `Error in ${context}: `;
    let line: number | undefined;
    let col: number | undefined;

    if (err instanceof Error) {
      message += err.message;
      // Try to extract line number from stack trace
      // Format: "at <anonymous>:LINE:COL" or "eval:LINE:COL"
      const match = err.stack?.match(/<anonymous>:(\d+):(\d+)/);
      if (match) {
        line = parseInt(match[1], 10);
        col = parseInt(match[2], 10);
      }
    } else {
      message += String(err);
    }

    const errorInfo: CodaloopError = {
      type: "codaloop-error",
      message,
      line,
      col,
    };

    // Log to iframe console for debugging
    console.error(`[Codaloop] ${message}`);

    // Post to parent frame
    try {
      globalThis.parent.postMessage(errorInfo, "*");
    } catch {
      // If we can't post to parent, that's fine — we already logged it
    }
  }

  // ─── Input listeners ──────────────────────────────────────────────

  private _setupInputListeners(): void {
    // Mouse tracking — on the canvas
    this.canvas.addEventListener("mousemove", (e: MouseEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      this._mouseX = e.clientX - rect.left;
      this._mouseY = e.clientY - rect.top;
    });

    this.canvas.addEventListener("mousedown", () => {
      this._mouseIsPressed = true;
    });

    this.canvas.addEventListener("mouseup", () => {
      this._mouseIsPressed = false;
    });

    // Touch support for tablets/Chromebooks
    this.canvas.addEventListener("touchmove", (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      this._mouseX = touch.clientX - rect.left;
      this._mouseY = touch.clientY - rect.top;
    }, { passive: false });

    this.canvas.addEventListener("touchstart", (e: TouchEvent) => {
      e.preventDefault();
      this._mouseIsPressed = true;
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      this._mouseX = touch.clientX - rect.left;
      this._mouseY = touch.clientY - rect.top;
    }, { passive: false });

    this.canvas.addEventListener("touchend", () => {
      this._mouseIsPressed = false;
    });

    // Grid helper — click to pin/unpin crosshair
    this.canvas.addEventListener("click", () => {
      if (!this._gridHelperEnabled) return;
      if (this._gridPinX !== null) {
        // Unpin
        this._gridPinX = null;
        this._gridPinY = null;
      } else {
        // Pin at current mouse position
        this._gridPinX = this._mouseX;
        this._gridPinY = this._mouseY;
      }
    });

    // Keyboard — on the document (so keys work when canvas isn't focused)
    document.addEventListener("keydown", (e: KeyboardEvent) => {
      this._key = e.key;
      this._keyIsPressed = true;
      this._keysDown.add(e.key);

      // Grid helper — arrow keys nudge pinned position
      if (this._gridHelperEnabled && this._gridPinX !== null) {
        const nudge: Record<string, [number, number]> = {
          ArrowLeft: [-1, 0],
          ArrowRight: [1, 0],
          ArrowUp: [0, -1],
          ArrowDown: [0, 1],
        };
        const d = nudge[e.key];
        if (d) {
          this._gridPinX += d[0];
          this._gridPinY! += d[1];
          e.preventDefault();
        }
      }

      if (this._userKeyPressed) {
        try {
          this._userKeyPressed();
        } catch (err) {
          this._reportError(err, "keyPressed()");
        }
      }
    });

    document.addEventListener("keyup", (e: KeyboardEvent) => {
      this._key = e.key;
      this._keyIsPressed = false;
      this._keysDown.delete(e.key);

      if (this._userKeyReleased) {
        try {
          this._userKeyReleased();
        } catch (err) {
          this._reportError(err, "keyReleased()");
        }
      }
    });
  }

  // ─── Game loop ─────────────────────────────────────────────────────

  /** Register user callbacks and start the game loop. */
  start(callbacks: UserCallbacks): void {
    this._userSetup = callbacks.setup;
    this._userDraw = callbacks.draw;
    this._userKeyPressed = callbacks.keyPressed;
    this._userKeyReleased = callbacks.keyReleased;

    // Run setup
    if (this._userSetup) {
      try {
        this._userSetup();
      } catch (err) {
        this._reportError(err, "setup()");
        return; // Don't start loop if setup fails
      }
    }

    // Start game loop
    this._running = true;
    this._loop();
  }

  /** Stop the game loop. */
  stop(): void {
    this._running = false;
    if (this._animFrameId) {
      cancelAnimationFrame(this._animFrameId);
      this._animFrameId = 0;
    }
  }

  private _loop = (): void => {
    if (!this._running) return;

    this._frameCount++;

    if (this._userDraw) {
      try {
        this._userDraw();
      } catch (err) {
        this._reportError(err, "draw()");
        this.stop();
        return;
      }
    }

    if (this._gridHelperEnabled) this._drawGridOverlay();

    this._animFrameId = requestAnimationFrame(this._loop);
  };

  // ─── Global injection ──────────────────────────────────────────────

  /**
   * Expose all API functions and read-only variables as globals on the given object
   * (typically `window`). This is used by the IIFE browser build.
   */
  exposeGlobals(target: Record<string, unknown>): void {
    // Drawing functions
    target.size = (w?: number, h?: number) => this.size(w, h);
    target.background = (c: Color) => this.background(c);
    target.fill = (c: Color) => this.fill(c);
    target.stroke = (c: Color) => this.stroke(c);
    target.noFill = () => this.noFill();
    target.noStroke = () => this.noStroke();
    target.strokeWeight = (n: number) => this.strokeWeight(n);
    target.textSize = (n: number) => this.textSize(n);
    target.textAlign = (align: TextAlign) => this.textAlign(align);
    target.rect = (x: number, y: number, w: number, h: number) =>
      this.rect(x, y, w, h);
    target.circle = (x: number, y: number, r: number) => this.circle(x, y, r);
    target.line = (x1: number, y1: number, x2: number, y2: number) =>
      this.line(x1, y1, x2, y2);
    target.triangle = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      x3: number,
      y3: number,
    ) => this.triangle(x1, y1, x2, y2, x3, y3);
    target.ellipse = (x: number, y: number, w: number, h: number) =>
      this.ellipse(x, y, w, h);
    target.arc = (
      x: number,
      y: number,
      r: number,
      start: number,
      stop: number,
    ) => this.arc(x, y, r, start, stop);
    target.text = (str: string, x: number, y: number) => this.text(str, x, y);

    // Input functions
    target.keyIsDown = (k: string) => this.keyIsDown(k);

    // Math helpers
    target.random = (a: number, b?: number) => this.random(a, b);
    target.dist = (x1: number, y1: number, x2: number, y2: number) =>
      this.dist(x1, y1, x2, y2);
    target.constrain = (val: number, lo: number, hi: number) =>
      this.constrain(val, lo, hi);
    target.map = (
      value: number,
      fromLow: number,
      fromHigh: number,
      toLow: number,
      toHigh: number,
    ) => this.map(value, fromLow, fromHigh, toLow, toHigh);
    target.lerp = (a: number, b: number, t: number) => this.lerp(a, b, t);
    target.randomInt = (a: number, b?: number) => this.randomInt(a, b);

    // Color
    target.color = (r: number, g: number, b: number, a?: number) =>
      this.color(r, g, b, a);

    // State management
    target.push = () => this.push();
    target.pop = () => this.pop();

    // Transforms
    target.translate = (x: number, y: number) => this.translate(x, y);
    target.rotate = (angle: number) => this.rotate(angle);

    // Loop control
    target.noLoop = () => this.noLoop();
    target.loop = () => this.loop();

    // Helpers
    target.gridHelper = (opts?: GridHelperOptions) => this.gridHelper(opts);

    // Sprites & collision
    target.createSprite = (x: number, y: number, w: number, h: number) =>
      this.createSprite(x, y, w, h);
    target.drawSprite = (s: Sprite) => this.drawSprite(s);
    target.moveSprite = (s: Sprite) => this.moveSprite(s);
    target.collides = (a: Sprite, b: Sprite) => this.collides(a, b);
    target.overlap = (s: Sprite, x: number, y: number) => this.overlap(s, x, y);
    target.applyGravity = (s: Sprite, amount?: number) =>
      this.applyGravity(s, amount);
    target.bounceEdges = (s: Sprite) => this.bounceEdges(s);

    // Pixel art
    target.createImage = (rows: string[], colorMap: Record<string, string>) =>
      this.createImage(rows, colorMap);
    target.drawImage = (
      img: PixelImage,
      x: number,
      y: number,
      scale?: number,
    ) => this.drawImage(img, x, y, scale);
    target.getImage = (name: string, colors?: Record<string, string>) =>
      this.getImage(name, colors);

    // Sound & music
    target.playSound = (name: string) => this.playSound(name as SoundPreset);
    target.playNote = (note: string, duration: number, volume?: number) =>
      this.playNote(note, duration, volume);
    target.playDrum = (name: string) => this.playDrum(name as DrumPreset);

    // Read-only variables via getters
    Object.defineProperty(target, "mouseX", {
      get: () => this._mouseX,
      configurable: true,
    });
    Object.defineProperty(target, "mouseY", {
      get: () => this._mouseY,
      configurable: true,
    });
    Object.defineProperty(target, "mouseIsPressed", {
      get: () => this._mouseIsPressed,
      configurable: true,
    });
    Object.defineProperty(target, "key", {
      get: () => this._key,
      configurable: true,
    });
    Object.defineProperty(target, "keyIsPressed", {
      get: () => this._keyIsPressed,
      configurable: true,
    });
    Object.defineProperty(target, "width", {
      get: () => this._width,
      configurable: true,
    });
    Object.defineProperty(target, "height", {
      get: () => this._height,
      configurable: true,
    });
    Object.defineProperty(target, "frameCount", {
      get: () => this._frameCount,
      configurable: true,
    });
  }
}

/**
 * Create a new Codaloop runtime instance.
 *
 * @example
 * ```typescript
 * import { createRuntime } from "@codaloop/runtime";
 * const gl = createRuntime(document.getElementById("canvas") as HTMLCanvasElement);
 * gl.rect(10, 20, 50, 50);
 * ```
 */
export function createRuntime(
  canvasOrOptions?: HTMLCanvasElement | RuntimeOptions,
): CodaloopRuntime {
  let options: RuntimeOptions = {};
  if (canvasOrOptions instanceof HTMLCanvasElement) {
    options = { canvas: canvasOrOptions };
  } else if (canvasOrOptions) {
    options = canvasOrOptions;
  }
  return new CodaloopRuntime(options);
}

/**
 * Inject infinite-loop protection into user code.
 * Adds a counter to `for`, `while`, and `do` loops that throws
 * if iterations exceed MAX_LOOP_ITERATIONS.
 */
export function protectLoops(code: string): string {
  const counterVar = `__loopGuard_${Date.now()}`;
  // Match for/while/do loops and inject a counter check at the start of each loop body
  // This regex matches: for(...){, while(...){, do {
  let counter = 0;

  const result = code.replace(
    /(for\s*\([^)]*\)\s*\{|while\s*\([^)]*\)\s*\{|do\s*\{)/g,
    (match) => {
      const id = `${counterVar}_${counter++}`;
      return `${match} if(typeof ${id}==="undefined")var ${id}=0;if(++${id}>${MAX_LOOP_ITERATIONS})throw new Error("Infinite loop detected! Your loop ran more than ${MAX_LOOP_ITERATIONS} times.");`;
    },
  );

  return result;
}

/**
 * Boot the runtime in "global mode" — intended for the iframe/browser bundle.
 * Creates a runtime, exposes globals on window, evaluates user code, and starts the loop.
 */
export function bootGlobal(userCode: string): CodaloopRuntime {
  const runtime = new CodaloopRuntime();

  // Expose all globals
  // deno-lint-ignore no-explicit-any
  const win = globalThis as any;
  runtime.exposeGlobals(win);

  // Protect against infinite loops
  const safeCode = protectLoops(userCode);

  // Execute user code — this defines their setup(), draw(), keyPressed(), etc.
  try {
    // Indirect eval: (0, eval)(...) runs in global scope, so function declarations
    // like `function draw() {}` become true globals on `window`.
    // (new Function() would scope them locally, breaking auto-detection.)
    (0, eval)(safeCode);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Codaloop] Error in user code: ${message}`);
    try {
      globalThis.parent.postMessage(
        {
          type: "codaloop-error",
          message: `Error: ${message}`,
        } satisfies CodaloopError,
        "*",
      );
    } catch {
      // ignore
    }
    return runtime;
  }

  // Collect user-defined callbacks from global scope
  runtime.start({
    setup: typeof win.setup === "function" ? win.setup : undefined,
    draw: typeof win.draw === "function" ? win.draw : undefined,
    keyPressed: typeof win.keyPressed === "function"
      ? win.keyPressed
      : undefined,
    keyReleased: typeof win.keyReleased === "function"
      ? win.keyReleased
      : undefined,
  });

  // Listen for thumbnail capture requests from parent frame
  globalThis.addEventListener("message", (e: MessageEvent) => {
    if (e.data?.type === "codaloop-capture") {
      try {
        const dataUrl = runtime.canvas.toDataURL("image/png", 0.3);
        globalThis.parent.postMessage(
          { type: "codaloop-thumbnail", dataUrl } satisfies CodaloopThumbnail,
          "*",
        );
      } catch {
        // ignore — toDataURL can fail if canvas is tainted
      }
    }
  });

  return runtime;
}
