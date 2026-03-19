/**
 * Build script: transforms the runtime package for npm publishing using dnt.
 *
 * Usage:
 *   deno run -A packages/runtime/build_npm.ts 0.1.0
 *
 * Produces an npm-ready package in packages/runtime/npm/
 * Then publish with: cd packages/runtime/npm && npm publish
 */

// deno-lint-ignore-file no-import-prefix no-unversioned-import
import { build, emptyDir } from "jsr:@deno/dnt";
import { dirname, fromFileUrl, resolve } from "jsr:@std/path@1";

const __dirname = dirname(fromFileUrl(import.meta.url));
const outDir = resolve(__dirname, "npm");

// Read version from args or fall back to deno.json
let version = Deno.args[0];
if (!version) {
  const denoJson = JSON.parse(
    Deno.readTextFileSync(resolve(__dirname, "deno.json")),
  );
  version = denoJson.version;
}
if (!version) {
  console.error("Usage: deno run -A build_npm.ts [version]");
  console.error("Or set version in packages/runtime/deno.json");
  Deno.exit(1);
}

await emptyDir(outDir);

await build({
  entryPoints: [resolve(__dirname, "mod.ts")],
  outDir,
  rootTestDir: __dirname,
  // Pure browser library — no Deno APIs used, no shims needed
  shims: {},
  // Skip Node test runner since this is a browser-only library
  test: false,
  compilerOptions: {
    lib: ["ES2020", "DOM"],
    target: "ES2020",
  },
  package: {
    name: "@codaloop/runtime",
    version,
    description:
      "A simplified game programming API for kids — Canvas drawing, sprites, sound, and a 60fps game loop. Think Processing/p5.js but simpler.",
    license: "MIT",
    repository: {
      type: "git",
      url: "git+https://github.com/codaloop/runtime.git",
    },
    bugs: {
      url: "https://github.com/codaloop/runtime/issues",
    },
    homepage: "https://codaloop.dev",
    keywords: [
      "game",
      "canvas",
      "kids",
      "education",
      "creative-coding",
      "p5js",
      "processing",
      "sprites",
      "pixel-art",
      "game-engine",
    ],
    sideEffects: false,
  },
  // Copy README into the npm package
  postBuild() {
    try {
      Deno.copyFileSync(
        resolve(__dirname, "README.md"),
        resolve(outDir, "README.md"),
      );
    } catch {
      // README doesn't exist yet — that's fine
    }
  },
});

console.log(`\n✓ npm package built at ${outDir}`);
console.log(`  To publish: cd ${outDir} && npm publish --access public`);
