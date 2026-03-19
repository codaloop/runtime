# @glitchlab/runtime

A simplified game programming API for kids — Canvas drawing, sprites, sound, and
a 60fps game loop. Think Processing/p5.js but simpler.

Built for [Glitchlab](https://glitchlabs.deno.dev), a zero-friction
browser-based game programming environment for classrooms.

## Install

```bash
# npm
npm install @glitchlab/runtime

# Deno / JSR
deno add jsr:@glitchlab/runtime
```

## Quick Start

```typescript
import { createRuntime } from "@glitchlab/runtime";

const gl = createRuntime();

gl.size(400, 400);
gl.background("white");
gl.fill("red");
gl.circle(200, 200, 50);

// Game loop
gl.start({
  setup() {
    gl.size(400, 400);
  },
  draw() {
    gl.background("skyblue");
    gl.fill("yellow");
    gl.circle(gl.mouseX, gl.mouseY, 30);
  },
});
```

## Browser (Script Tag)

```html
<script src="https://esm.sh/@glitchlab/runtime/browser"></script>
<script type="text/javascript">
  function setup() {
    size(400, 400);
  }

  function draw() {
    background("white");
    fill("red");
    circle(mouseX, mouseY, 30);
  }
</script>
```

## API Overview

### Lifecycle

- `size(w, h)` — Set canvas size
- `background(color)` — Clear canvas with a color
- `noLoop()` / `loop()` — Stop/restart the draw loop

### Shapes

- `rect(x, y, w, h)` — Rectangle
- `circle(x, y, r)` — Circle
- `ellipse(x, y, w, h)` — Ellipse
- `line(x1, y1, x2, y2)` — Line
- `triangle(x1, y1, x2, y2, x3, y3)` — Triangle
- `arc(x, y, r, startAngle, stopAngle)` — Arc (degrees)
- `text(str, x, y)` — Text

### Style

- `fill(color)` / `noFill()` — Fill color
- `stroke(color)` / `noStroke()` — Outline color
- `strokeWeight(n)` — Outline thickness
- `textSize(n)` / `textAlign(align)` — Text styling
- `color(r, g, b, a?)` — Create RGBA color

### Input

- `mouseX`, `mouseY` — Mouse position
- `mouseIsPressed` — Is mouse down?
- `key`, `keyIsPressed` — Last key pressed
- `keyIsDown(k)` — Is a specific key held?
- `keyPressed()` / `keyReleased()` — Callbacks (define as globals)

### Sprites

- `createSprite(x, y, w, h)` — Create a sprite
- `drawSprite(s)` / `moveSprite(s)` — Draw/move
- `collides(a, b)` — AABB collision
- `applyGravity(s)` / `bounceEdges(s)` — Physics helpers

### Pixel Art

- `createImage(rows, colorMap)` — Create from string art
- `drawImage(img, x, y, scale?)` — Draw pixel image
- `getImage(name, colors?)` — Get built-in sprite

### Sound

- `playSound(name)` — `"beep"`, `"coin"`, `"jump"`, `"hit"`, `"explosion"`,
  `"powerup"`, `"laser"`, `"pop"`
- `playNote(note, duration, volume?)` — Play a musical note (`"C4"`, `"F#5"`,
  etc.)
- `playDrum(name)` — `"kick"`, `"snare"`, `"hihat"`

### Math

- `random(max)` / `random(min, max)` — Random float
- `randomInt(max)` / `randomInt(min, max)` — Random integer
- `dist(x1, y1, x2, y2)` — Distance
- `constrain(val, lo, hi)` — Clamp
- `map(val, fromLo, fromHi, toLo, toHi)` — Remap
- `lerp(a, b, t)` — Linear interpolation

### State

- `push()` / `pop()` — Save/restore drawing state + transforms
- `translate(x, y)` / `rotate(angle)` — Transform (degrees)

## License

MIT
