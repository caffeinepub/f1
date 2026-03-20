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

export type GamePhase =
  | "idle"
  | "countdown"
  | "racing"
  | "finished"
  | "fuelout";

export interface FuelCan {
  x: number;
  y: number;
  collected: boolean;
  respawnTimer: number;
}

export interface RaceState {
  phase: GamePhase;
  cars: CarData[];
  countdown: number;
  finishTimer: number;
  sortedIdx: number[];
  playerPos: number;
  currentLap: number;
  finalPoints: number;
  fuelLevel: number; // 0-100
  fuelCans: FuelCan[];
}

export const TOTAL_LAPS = 3;
export const TRACK_WIDTH = 490;
export const CANVAS_W = 640;
export const CANVAS_H = 800;
export const F1_POINTS = [25, 18, 15, 12, 10, 8];

// Waypoints scaled ~3.4x — track size slightly increased for better racing
export const WAYPOINTS: Point[] = [
  { x: 4351, y: 544 },
  { x: 5710, y: 544 },
  { x: 6961, y: 761 },
  { x: 7777, y: 1523 },
  { x: 8049, y: 2502 },
  { x: 7940, y: 3481 },
  { x: 7505, y: 4351 },
  { x: 6526, y: 4895 },
  { x: 5438, y: 5166 },
  { x: 4623, y: 5112 },
  { x: 4133, y: 4840 },
  { x: 3807, y: 5275 },
  { x: 3154, y: 5493 },
  { x: 2175, y: 5547 },
  { x: 1196, y: 5330 },
  { x: 653, y: 4623 },
  { x: 544, y: 3589 },
  { x: 653, y: 2502 },
  { x: 1088, y: 1577 },
  { x: 1958, y: 952 },
  { x: 3100, y: 598 },
  { x: 3698, y: 517 },
];

export const AI_TEAM_DATA = [
  { name: "VER", color: "#3671C6", glowColor: "#5a90e8" },
  { name: "LEC", color: "#E8002D", glowColor: "#ff5577" },
  { name: "NOR", color: "#FF8000", glowColor: "#ffaa44" },
  { name: "ALO", color: "#006F62", glowColor: "#00b89a" },
  { name: "SAI", color: "#005AFF", glowColor: "#4d8cff" },
];

// Stage 2 waypoints — more complex circuit (scaled ~3.4x)
export const WAYPOINTS_STAGE2: Point[] = [
  { x: 4079, y: 510 },
  { x: 5438, y: 510 },
  { x: 6798, y: 510 },
  { x: 7648, y: 850 },
  { x: 7988, y: 1530 },
  { x: 7988, y: 2209 },
  { x: 7648, y: 2889 },
  { x: 6798, y: 3229 },
  { x: 6118, y: 3399 },
  { x: 5438, y: 3229 },
  { x: 4759, y: 3569 },
  { x: 4079, y: 4079 },
  { x: 3399, y: 4589 },
  { x: 2379, y: 4929 },
  { x: 1360, y: 5098 },
  { x: 510, y: 4759 },
  { x: 340, y: 4079 },
  { x: 510, y: 3399 },
  { x: 850, y: 2719 },
  { x: 680, y: 2039 },
  { x: 1020, y: 1530 },
  { x: 680, y: 1020 },
  { x: 1020, y: 595 },
  { x: 2039, y: 476 },
  { x: 3059, y: 476 },
  { x: 3569, y: 493 },
  { x: 3824, y: 502 },
];

// Fuel can positions spread along Stage 1 track (at key waypoints)
export const FUEL_CAN_POSITIONS_STAGE1: { x: number; y: number }[] = [
  { x: 7777, y: 1523 }, // wp 3
  { x: 6526, y: 4895 }, // wp 7
  { x: 4133, y: 4840 }, // wp 10
  { x: 1196, y: 5330 }, // wp 14
  { x: 653, y: 2502 }, // wp 17
  { x: 3100, y: 598 }, // wp 20
];

// Fuel can positions spread along Stage 2 track
export const FUEL_CAN_POSITIONS_STAGE2: { x: number; y: number }[] = [
  { x: 7648, y: 850 }, // wp 3
  { x: 6798, y: 3229 }, // wp 7
  { x: 4759, y: 3569 }, // wp 10
  { x: 1360, y: 5098 }, // wp 14
  { x: 510, y: 3399 }, // wp 17
  { x: 1020, y: 1530 }, // wp 20
];
