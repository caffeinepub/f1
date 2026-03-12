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
