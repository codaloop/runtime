/**
 * @module
 * Codaloop Runtime — a simplified game programming API for kids.
 *
 * ## Usage as a library
 *
 * ```typescript
 * import { createRuntime } from "@codaloop/runtime";
 *
 * const pp = createRuntime(document.getElementById("canvas") as HTMLCanvasElement);
 * pp.background("white");
 * pp.fill("red");
 * pp.rect(10, 20, 50, 50);
 * ```
 *
 * ## Usage in browser (IIFE)
 *
 * The browser bundle exposes all functions as globals and auto-boots from
 * the `__CODALOOP_CODE__` global.
 */

export {
  bootGlobal,
  CodaloopRuntime,
  createRuntime,
  protectLoops,
} from "./runtime.ts";
export type {
  CodaloopError,
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
