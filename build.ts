/**
 * Build script: bundles browser.ts into an IIFE at codaloop.js
 * using esbuild via Deno.
 */

import * as esbuild from "npm:esbuild@0.24.2";
import { dirname, fromFileUrl, resolve } from "jsr:@std/path@1";

const __dirname = dirname(fromFileUrl(import.meta.url));
const entryPoint = resolve(__dirname, "browser.ts");
const outFile = resolve(__dirname, "codaloop.js");

const result = await esbuild.build({
  entryPoints: [entryPoint],
  bundle: true,
  format: "iife",
  outfile: outFile,
  target: "es2020",
  minify: false, // Keep readable for debugging during development
  sourcemap: false,
  logLevel: "info",
});

if (result.errors.length > 0) {
  console.error("Build failed:", result.errors);
  Deno.exit(1);
}

console.log(`✓ Built ${outFile}`);

esbuild.stop();
