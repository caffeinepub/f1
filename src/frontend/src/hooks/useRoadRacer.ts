// Types and constants for the F1 circuit racing game
export interface Point {
  x: number;
  y: number;
}

export interface CarData {
  x: number;
  y: number;
  heading: number;
  speed: number;
  maxSpeed: number;
  laps: number;
  targetWP: number;
  lapReady: boolean;
  color: string;
  glowColor: string;
  name: string;
  isPlayer: boolean;
  finished: boolean;
  finishPos: number;
}

export type GamePhase = "idle" | "countdown" | "racing" | "finished";

export interface RaceState {
  phase: GamePhase;
  cars: CarData[];
  countdown: number;
  finishTimer: number;
  sortedIdx: number[];
  playerPos: number;
  currentLap: number;
  finalPoints: number;
}

export const TOTAL_LAPS = 3;
export const TRACK_WIDTH = 280;
export const CANVAS_W = 640;
export const CANVAS_H = 800;
export const F1_POINTS = [25, 18, 15, 12, 10, 8];

// Waypoints scaled 2x for a much larger track
export const WAYPOINTS: Point[] = [
  { x: 2560, y: 320 },
  { x: 3360, y: 320 },
  { x: 4096, y: 448 },
  { x: 4576, y: 896 },
  { x: 4736, y: 1472 },
  { x: 4672, y: 2048 },
  { x: 4416, y: 2560 },
  { x: 3840, y: 2880 },
  { x: 3200, y: 3040 },
  { x: 2720, y: 3008 },
  { x: 2432, y: 2848 },
  { x: 2240, y: 3104 },
  { x: 1856, y: 3232 },
  { x: 1280, y: 3264 },
  { x: 704, y: 3136 },
  { x: 384, y: 2720 },
  { x: 320, y: 2112 },
  { x: 384, y: 1472 },
  { x: 640, y: 928 },
  { x: 1152, y: 560 },
  { x: 1824, y: 352 },
  { x: 2176, y: 304 },
];

export const AI_TEAM_DATA = [
  { name: "VER", color: "#3671C6", glowColor: "#5a90e8" },
  { name: "LEC", color: "#E8002D", glowColor: "#ff5577" },
  { name: "NOR", color: "#FF8000", glowColor: "#ffaa44" },
  { name: "ALO", color: "#006F62", glowColor: "#00b89a" },
  { name: "SAI", color: "#005AFF", glowColor: "#4d8cff" },
];

// Stage 2 waypoints — more complex circuit with hairpins, chicanes, and S-curves
export const WAYPOINTS_STAGE2: Point[] = [
  { x: 2400, y: 300 }, // 0 start/finish
  { x: 3200, y: 300 }, // 1 long straight
  { x: 4000, y: 300 }, // 2 long straight continues
  { x: 4500, y: 500 }, // 3 right curve entry
  { x: 4700, y: 900 }, // 4 hairpin approach
  { x: 4700, y: 1300 }, // 5 hairpin
  { x: 4500, y: 1700 }, // 6 hairpin exit
  { x: 4000, y: 1900 }, // 7 chicane S entry
  { x: 3600, y: 2000 }, // 8 chicane left
  { x: 3200, y: 1900 }, // 9 chicane right
  { x: 2800, y: 2100 }, // 10
  { x: 2400, y: 2400 }, // 11
  { x: 2000, y: 2700 }, // 12 sweeping left
  { x: 1400, y: 2900 }, // 13
  { x: 800, y: 3000 }, // 14
  { x: 300, y: 2800 }, // 15 left hairpin approach
  { x: 200, y: 2400 }, // 16 left hairpin
  { x: 300, y: 2000 }, // 17 hairpin exit
  { x: 500, y: 1600 }, // 18
  { x: 400, y: 1200 }, // 19 tight chicane
  { x: 600, y: 900 }, // 20 chicane exit
  { x: 400, y: 600 }, // 21 tight left
  { x: 600, y: 350 }, // 22 approach finish
  { x: 1200, y: 280 }, // 23
  { x: 1800, y: 280 }, // 24
  { x: 2100, y: 290 }, // 25
  { x: 2250, y: 295 }, // 26
];
