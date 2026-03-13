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
export const TRACK_WIDTH = 430;
export const CANVAS_W = 640;
export const CANVAS_H = 800;
export const F1_POINTS = [25, 18, 15, 12, 10, 8];

// Waypoints scaled 3x — smaller track for tighter, more challenging racing
export const WAYPOINTS: Point[] = [
  { x: 3840, y: 480 },
  { x: 5040, y: 480 },
  { x: 6144, y: 672 },
  { x: 6864, y: 1344 },
  { x: 7104, y: 2208 },
  { x: 7008, y: 3072 },
  { x: 6624, y: 3840 },
  { x: 5760, y: 4320 },
  { x: 4800, y: 4560 },
  { x: 4080, y: 4512 },
  { x: 3648, y: 4272 },
  { x: 3360, y: 4656 },
  { x: 2784, y: 4848 },
  { x: 1920, y: 4896 },
  { x: 1056, y: 4704 },
  { x: 576, y: 4080 },
  { x: 480, y: 3168 },
  { x: 576, y: 2208 },
  { x: 960, y: 1392 },
  { x: 1728, y: 840 },
  { x: 2736, y: 528 },
  { x: 3264, y: 456 },
];

export const AI_TEAM_DATA = [
  { name: "VER", color: "#3671C6", glowColor: "#5a90e8" },
  { name: "LEC", color: "#E8002D", glowColor: "#ff5577" },
  { name: "NOR", color: "#FF8000", glowColor: "#ffaa44" },
  { name: "ALO", color: "#006F62", glowColor: "#00b89a" },
  { name: "SAI", color: "#005AFF", glowColor: "#4d8cff" },
];

// Stage 2 waypoints — more complex circuit with hairpins, chicanes, and S-curves (3x scale)
export const WAYPOINTS_STAGE2: Point[] = [
  { x: 3600, y: 450 },
  { x: 4800, y: 450 },
  { x: 6000, y: 450 },
  { x: 6750, y: 750 },
  { x: 7050, y: 1350 },
  { x: 7050, y: 1950 },
  { x: 6750, y: 2550 },
  { x: 6000, y: 2850 },
  { x: 5400, y: 3000 },
  { x: 4800, y: 2850 },
  { x: 4200, y: 3150 },
  { x: 3600, y: 3600 },
  { x: 3000, y: 4050 },
  { x: 2100, y: 4350 },
  { x: 1200, y: 4500 },
  { x: 450, y: 4200 },
  { x: 300, y: 3600 },
  { x: 450, y: 3000 },
  { x: 750, y: 2400 },
  { x: 600, y: 1800 },
  { x: 900, y: 1350 },
  { x: 600, y: 900 },
  { x: 900, y: 525 },
  { x: 1800, y: 420 },
  { x: 2700, y: 420 },
  { x: 3150, y: 435 },
  { x: 3375, y: 443 },
];
