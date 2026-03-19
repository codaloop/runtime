# Publishing @glitchlab/runtime

The runtime is published to both JSR and npm from the same TypeScript source.

## Prerequisites

- **JSR**: Authenticated via `deno publish` (uses your Deno account)
- **npm**: Logged in via `npm login` with access to the `@glitchlab` scope

## Version bump

Update the version in `packages/runtime/deno.json`:

```json
{
  "name": "@glitchlab/runtime",
  "version": "0.2.0"
}
```

Both publish commands read from this file, so you only need to change it in one
place.

## Publish to JSR

```bash
deno task publish:runtime
```

This runs `deno publish` from the `packages/runtime/` directory.

## Publish to npm

```bash
deno task publish:npm
```

This does two things:

1. Builds an npm-ready package (ESM + CJS + `.d.ts` types) into
   `packages/runtime/npm/` using [dnt](https://github.com/denoland/dnt)
2. Runs `npm publish --access public` from that directory

To build without publishing (e.g. to inspect the output):

```bash
deno task build:npm
ls packages/runtime/npm/
```

You can also override the version at build time:

```bash
deno task build:npm 0.3.0-beta.1
```

## Full release checklist

1. Update version in `packages/runtime/deno.json`
2. Rebuild the IIFE bundle: `deno task build:runtime`
3. Test locally: `deno task dev`
4. Publish to JSR: `deno task publish:runtime`
5. Publish to npm: `deno task publish:npm`
6. Commit and tag: `git tag runtime-v0.2.0 && git push --tags`

## npm scope setup

If you haven't claimed `@glitchlab` on npm yet:

1. Go to https://www.npmjs.com/org/create
2. Create the `glitchlab` organization
3. Run `npm login` if you haven't already

If the scope isn't available, you can change the package name in `build_npm.ts`
to something unscoped like `glitchlab-runtime`.
