/**
 * IIFE browser entry point for Codaloop runtime.
 *
 * When loaded as a <script> tag, this:
 * 1. Creates a fullscreen canvas
 * 2. Exposes all Codaloop globals (rect, fill, circle, etc.)
 * 3. Waits for the user code script to load
 * 4. Boots the game loop
 *
 * User code is provided via the global `__CODALOOP_CODE__` variable,
 * set before this script executes in the iframe's srcdoc.
 */

import { bootGlobal } from "./runtime.ts";

// deno-lint-ignore no-explicit-any
const win = globalThis as any;

// The editor sets __CODALOOP_CODE__ in the iframe's srcdoc before loading this script
const userCode: string = win.__CODALOOP_CODE__ ?? "";

if (userCode) {
  // Small delay to ensure DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      bootGlobal(userCode);
    });
  } else {
    bootGlobal(userCode);
  }
} else {
  console.warn(
    "[Codaloop] No user code found. Set window.__CODALOOP_CODE__ before loading this script.",
  );
}
