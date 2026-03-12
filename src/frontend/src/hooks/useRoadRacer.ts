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
export const TRACK_WIDTH = 140;
export const CANVAS_W = 480;
export const CANVAS_H = 640;
export const F1_POINTS = [25, 18, 15, 12, 10, 8];

export const WAYPOINTS: Point[] = [
  { x: 800, y: 100 },
  { x: 1050, y: 100 },
  { x: 1280, y: 140 },
  { x: 1430, y: 280 },
  { x: 1480, y: 460 },
  { x: 1460, y: 640 },
  { x: 1380, y: 800 },
  { x: 1200, y: 900 },
  { x: 1000, y: 950 },
  { x: 850, y: 940 },
  { x: 760, y: 890 },
  { x: 700, y: 970 },
  { x: 580, y: 1010 },
  { x: 400, y: 1020 },
  { x: 220, y: 980 },
  { x: 120, y: 850 },
  { x: 100, y: 660 },
  { x: 120, y: 460 },
  { x: 200, y: 290 },
  { x: 360, y: 175 },
  { x: 570, y: 110 },
  { x: 680, y: 95 },
];

export const AI_TEAM_DATA = [
  { name: "VER", color: "#3671C6", glowColor: "#5a90e8" },
  { name: "LEC", color: "#E8002D", glowColor: "#ff5577" },
  { name: "NOR", color: "#FF8000", glowColor: "#ffaa44" },
  { name: "ALO", color: "#006F62", glowColor: "#00b89a" },
  { name: "SAI", color: "#005AFF", glowColor: "#4d8cff" },
];
