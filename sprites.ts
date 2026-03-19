/**
 * Built-in pixel art sprite library for Glitchlab.
 *
 * Each sprite stores raw pixel rows + a color palette with friendly names.
 * getImage() builds a PixelImage at call time, optionally applying color overrides.
 *
 * @module
 */

import type { PixelImage } from "./types.ts";

/** A color in the palette: maps a single char to a friendly name + default CSS color. */
interface PaletteEntry {
  char: string;
  color: string;
}

/** Raw sprite data before being built into a PixelImage. */
export interface SpriteData {
  rows: string[];
  /** Maps friendly color name → { char used in rows, default CSS color }. */
  palette: Record<string, PaletteEntry>;
}

/** Build a PixelImage from sprite data, optionally overriding colors by friendly name. */
export function buildSprite(
  data: SpriteData,
  overrides?: Record<string, string>,
): PixelImage {
  // Build char → resolved color map
  const charToColor: Record<string, string> = {};
  for (const [name, entry] of Object.entries(data.palette)) {
    charToColor[entry.char] = overrides?.[name] ?? entry.color;
  }

  const pixels: (string | null)[][] = [];
  for (const row of data.rows) {
    const pixelRow: (string | null)[] = [];
    for (const char of row) {
      if (char === "." || char === " ") {
        pixelRow.push(null);
      } else {
        pixelRow.push(charToColor[char] ?? null);
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

export const spriteLibrary: Record<string, SpriteData> = {
  // ─── Animals ──────────────────────────────────────────────────────

  dog: {
    rows: [
      "..OO...",
      ".OBBO..",
      "OBBBEO.",
      "OBNBEO.",
      "OBBBBOS",
      ".OBBO..",
      ".OBBO..",
      "OBBBO..",
      "O.OO.O.",
    ],
    palette: {
      outline: { char: "O", color: "#6B3E26" },
      body: { char: "B", color: "#D2956A" },
      nose: { char: "N", color: "#222" },
      eye: { char: "E", color: "#222" },
      // S is unused in current rows but reserved for collar
    },
  },

  cat: {
    rows: [
      "O....O.",
      "OO..OO.",
      "OBBBBO.",
      "BEBBEBO",
      "BBNBBO.",
      "BBBBO..",
      ".BBBO..",
      ".BBBO..",
      "..O.O..",
    ],
    palette: {
      outline: { char: "O", color: "#333" },
      body: { char: "B", color: "#F5A623" },
      eye: { char: "E", color: "#2D2" },
      nose: { char: "N", color: "#F06" },
    },
  },

  fish: {
    rows: [
      "...OOO..",
      "..OBBO..",
      "OOBBBEO.",
      "OBBBBBBO",
      "OOBBBOO.",
      "..OBBO..",
      "...OOO..",
    ],
    palette: {
      outline: { char: "O", color: "#1565C0" },
      body: { char: "B", color: "#42A5F5" },
      eye: { char: "E", color: "#222" },
    },
  },

  bird: {
    rows: [
      "..BB...",
      ".BBBB..",
      "BEBB...",
      ".BBBC..",
      ".BBBB..",
      "..BBW..",
      "..WW...",
      "..LL...",
    ],
    palette: {
      body: { char: "B", color: "#FFD54F" },
      eye: { char: "E", color: "#222" },
      beak: { char: "C", color: "#FF6F00" },
      wing: { char: "W", color: "#EEEEEE" },
      legs: { char: "L", color: "#FF6F00" },
    },
  },

  // ─── Objects ──────────────────────────────────────────────────────

  heart: {
    rows: [
      ".BB.BB.",
      "BBBBBBB",
      "BBBBBBB",
      "BBBBBBB",
      ".BBBBB.",
      "..BBB..",
      "...B...",
    ],
    palette: {
      body: { char: "B", color: "#E53935" },
    },
  },

  star: {
    rows: [
      "...B...",
      "...B...",
      "..BBB..",
      "BBBBBBB",
      ".BBBBB.",
      "..BBB..",
      ".BB.BB.",
      "BB...BB",
    ],
    palette: {
      body: { char: "B", color: "#FFD600" },
    },
  },

  tree: {
    rows: [
      "...L...",
      "..LLL..",
      ".LLLLL.",
      "..LLL..",
      ".LLLLL.",
      "LLLLLLL",
      "...T...",
      "...T...",
    ],
    palette: {
      leaves: { char: "L", color: "#388E3C" },
      trunk: { char: "T", color: "#795548" },
    },
  },

  flower: {
    rows: [
      "..P.P..",
      ".PPYPP.",
      "PPYYYPP",
      ".PPYPP.",
      "..P.P..",
      "...S...",
      "..SLS..",
      "...S...",
    ],
    palette: {
      petals: { char: "P", color: "#E91E63" },
      center: { char: "Y", color: "#FFD600" },
      stem: { char: "S", color: "#4CAF50" },
      leaf: { char: "L", color: "#4CAF50" },
    },
  },

  key: {
    rows: [
      "..BBB.",
      ".B...B",
      ".B...B",
      "..BBB.",
      "...B..",
      "...BB.",
      "...B..",
      "...BB.",
    ],
    palette: {
      body: { char: "B", color: "#FFD600" },
    },
  },

  gem: {
    rows: [
      "..OOO..",
      ".OBBBO.",
      "OBBBBSO",
      "OBBSSSO",
      ".OBSSO.",
      "..OSO..",
      "...O...",
    ],
    palette: {
      outline: { char: "O", color: "#1A237E" },
      face: { char: "B", color: "#42A5F5" },
      facet: { char: "S", color: "#1565C0" },
    },
  },

  coin: {
    rows: [
      "..OOO..",
      ".OBOOO.",
      "OBBBBOO",
      "OBBBBBO",
      "OBBBBOO",
      ".OBOOO.",
      "..OOO..",
    ],
    palette: {
      outer: { char: "O", color: "#FFD600" },
      inner: { char: "B", color: "#FFA000" },
    },
  },

  // ─── Game ─────────────────────────────────────────────────────────

  brick: {
    rows: [
      "MBBBBBBM",
      "MBBBBBBM",
      "MMMMMMMM",
      "BBBMMBBB",
      "BBBMMBBB",
      "MMMMMMMM",
      "MBBBBBBM",
      "MBBBBBBM",
    ],
    palette: {
      brick: { char: "B", color: "#C62828" },
      mortar: { char: "M", color: "#795548" },
    },
  },

  player: {
    rows: [
      "..OOO..",
      ".OSSOO.",
      ".OSESO.",
      "..OSO..",
      ".OOOO..",
      "OOCJOO.",
      "..CJ...",
      ".CJ.CJ.",
      ".OO.OO.",
    ],
    palette: {
      outline: { char: "O", color: "#222" },
      skin: { char: "S", color: "#FFCC80" },
      eye: { char: "E", color: "#222" },
      clothes: { char: "C", color: "#1565C0" },
      jeans: { char: "J", color: "#1565C0" },
    },
  },

  enemy: {
    rows: [
      "..BBBB.",
      ".BBBBBB",
      "BWBBWBB",
      "BBBBBB.",
      "BBMMMB.",
      ".BBBB..",
      "..BB.B.",
      ".BB..B.",
    ],
    palette: {
      body: { char: "B", color: "#C62828" },
      eye: { char: "W", color: "#FFF" },
      mouth: { char: "M", color: "#FFF" },
    },
  },

  rocket: {
    rows: [
      "...B...",
      "..BBB..",
      ".BBBBB.",
      ".BWBWB.",
      ".BBBBB.",
      ".BBBBB.",
      "FBBBBSF",
      "FF.E.FF",
      "...E...",
    ],
    palette: {
      body: { char: "B", color: "#ECEFF1" },
      window: { char: "W", color: "#1565C0" },
      fins: { char: "F", color: "#C62828" },
      exhaust: { char: "S", color: "#C62828" },
      flame: { char: "E", color: "#FF6F00" },
    },
  },
};

/** All available sprite names. */
export const spriteNames: string[] = Object.keys(spriteLibrary);
