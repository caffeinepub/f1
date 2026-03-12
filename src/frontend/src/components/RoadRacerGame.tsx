import { useCallback, useEffect, useRef, useState } from "react";
import {
  AI_TEAM_DATA,
  CANVAS_H,
  CANVAS_W,
  type CarData,
  F1_POINTS,
  type GamePhase,
  type Point,
  type RaceState,
  TOTAL_LAPS,
  TRACK_WIDTH,
  WAYPOINTS,
} from "../hooks/useRoadRacer";

const N = WAYPOINTS.length;
const HALF_TRACK = TRACK_WIDTH / 2;
const COUNTDOWN_FRAMES = 180; // 3 seconds at 60fps
const FINISH_DISPLAY_FRAMES = 300; // 5 seconds

// Starting grid positions (near WP[0] = {800, 100})
const GRID_POSITIONS: Point[] = [
  { x: 770, y: 88 },
  { x: 770, y: 112 },
  { x: 700, y: 88 },
  { x: 700, y: 112 },
  { x: 630, y: 88 },
  { x: 630, y: 112 },
];
const START_HEADING = Math.atan2(100 - 95, 800 - 680); // toward WP[0] from WP[21]

function createInitialState(): RaceState {
  const player: CarData = {
    x: GRID_POSITIONS[0].x,
    y: GRID_POSITIONS[0].y,
    heading: START_HEADING,
    speed: 0,
    maxSpeed: 8,
    laps: 0,
    targetWP: 1,
    lapReady: false,
    color: "#00ff80",
    glowColor: "#00ff80",
    name: "TITOO",
    isPlayer: true,
    finished: false,
    finishPos: 0,
  };

  const ais: CarData[] = AI_TEAM_DATA.map((team, i) => ({
    x: GRID_POSITIONS[i + 1].x,
    y: GRID_POSITIONS[i + 1].y,
    heading: START_HEADING,
    speed: 0,
    maxSpeed: 4.5 + Math.random() * 0.7,
    laps: 0,
    targetWP: 1,
    lapReady: false,
    color: team.color,
    glowColor: team.glowColor,
    name: team.name,
    isPlayer: false,
    finished: false,
    finishPos: 0,
  }));

  return {
    phase: "idle",
    cars: [player, ...ais],
    countdown: COUNTDOWN_FRAMES,
    finishTimer: FINISH_DISPLAY_FRAMES,
    sortedIdx: [0, 1, 2, 3, 4, 5],
    playerPos: 1,
    currentLap: 1,
    finalPoints: 0,
  };
}

function advanceWaypoint(car: CarData, finishCount: { val: number }) {
  const wp = WAYPOINTS[car.targetWP];
  const dx = wp.x - car.x;
  const dy = wp.y - car.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const threshold = car.isPlayer ? 80 : 60;

  if (dist < threshold) {
    if (car.targetWP === 0 && car.lapReady) {
      car.laps++;
      car.lapReady = false;
      if (car.laps >= TOTAL_LAPS && !car.finished) {
        car.finished = true;
        finishCount.val++;
        car.finishPos = finishCount.val;
      }
    }
    car.targetWP = (car.targetWP + 1) % N;
  }
  if (car.targetWP >= Math.floor(N / 2)) {
    car.lapReady = true;
  }
}

function updateAI(car: CarData, finishCount: { val: number }) {
  if (car.finished) return;
  const wp = WAYPOINTS[car.targetWP];
  const dx = wp.x - car.x;
  const dy = wp.y - car.y;

  const targetAngle = Math.atan2(dy, dx);
  let diff = targetAngle - car.heading;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  car.heading += Math.sign(diff) * Math.min(Math.abs(diff), 0.07);

  car.speed = Math.min(car.speed + 0.25, car.maxSpeed);
  car.x += Math.cos(car.heading) * car.speed;
  car.y += Math.sin(car.heading) * car.speed;

  advanceWaypoint(car, finishCount);
}

function updatePlayer(
  car: CarData,
  keys: Set<string>,
  finishCount: { val: number },
) {
  if (car.finished) return;
  if (keys.has("ArrowUp") || keys.has("w") || keys.has("W")) {
    car.speed = Math.min(car.speed + 0.3, car.maxSpeed);
  } else if (keys.has("ArrowDown") || keys.has("s") || keys.has("S")) {
    car.speed = Math.max(car.speed - 0.5, -2);
  } else {
    car.speed *= 0.97;
  }

  if (Math.abs(car.speed) > 0.3) {
    const steer = 0.042 * (Math.abs(car.speed) / car.maxSpeed + 0.3);
    if (keys.has("ArrowLeft") || keys.has("a") || keys.has("A")) {
      car.heading -= steer;
    }
    if (keys.has("ArrowRight") || keys.has("d") || keys.has("D")) {
      car.heading += steer;
    }
  }

  car.x += Math.cos(car.heading) * car.speed;
  car.y += Math.sin(car.heading) * car.speed;

  advanceWaypoint(car, finishCount);
}

function getProgress(car: CarData): number {
  return car.laps + car.targetWP / N;
}

function sortPositions(cars: CarData[]): number[] {
  return cars
    .map((_, i) => i)
    .sort((a, b) => getProgress(cars[b]) - getProgress(cars[a]));
}

// ── Build Catmull-Rom spline path ────────────────────────────────────────────
function buildSplinePath(points: Point[], camX: number, camY: number): Path2D {
  const path = new Path2D();
  const n = points.length;
  path.moveTo(points[0].x - camX, points[0].y - camY);
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    const t = 0.5;
    const cp1x = p1.x + ((p2.x - p0.x) * t) / 2;
    const cp1y = p1.y + ((p2.y - p0.y) * t) / 2;
    const cp2x = p2.x - ((p3.x - p1.x) * t) / 2;
    const cp2y = p2.y - ((p3.y - p1.y) * t) / 2;
    path.bezierCurveTo(
      cp1x - camX,
      cp1y - camY,
      cp2x - camX,
      cp2y - camY,
      p2.x - camX,
      p2.y - camY,
    );
  }
  path.closePath();
  return path;
}

function getTrackNormal(i: number): Point {
  const prev = WAYPOINTS[(i - 1 + N) % N];
  const next = WAYPOINTS[(i + 1) % N];
  const dx = next.x - prev.x;
  const dy = next.y - prev.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  return { x: -dy / len, y: dx / len };
}

// ── Draw track ───────────────────────────────────────────────────────────────
function drawTrack(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
  const path = buildSplinePath(WAYPOINTS, camX, camY);

  // Crowd / grandstand strips (outside barriers)
  ctx.lineWidth = TRACK_WIDTH + 130;
  ctx.strokeStyle = "#1a2a1a";
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke(path);

  // Crowd color segments
  const teamColors = [
    "#e8002d",
    "#3671c6",
    "#ff8000",
    "#ffffff",
    "#006f62",
    "#ff0090",
  ];
  const segW = TRACK_WIDTH + 110;
  ctx.lineWidth = segW;
  // We paint crowd as a series of colored dashes
  for (let c = 0; c < 3; c++) {
    const dashLen = 40 + c * 25;
    ctx.setLineDash([dashLen, dashLen * 2]);
    ctx.lineDashOffset = c * 60;
    ctx.strokeStyle = `${teamColors[c]}33`;
    ctx.stroke(path);
  }
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;

  // Armco barriers (silver)
  ctx.lineWidth = TRACK_WIDTH + 28;
  ctx.strokeStyle = "#8a9aaa";
  ctx.stroke(path);

  // Red/white kerb stripe
  ctx.lineWidth = TRACK_WIDTH + 18;
  const kerbLen = 24;
  ctx.setLineDash([kerbLen, kerbLen]);
  ctx.strokeStyle = "#e8002d";
  ctx.stroke(path);
  ctx.lineDashOffset = kerbLen;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke(path);
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;

  // Track surface
  ctx.lineWidth = TRACK_WIDTH;
  ctx.strokeStyle = "#2d2d2d";
  ctx.stroke(path);

  // Track surface lighter band (highlights center)
  ctx.lineWidth = TRACK_WIDTH - 20;
  ctx.strokeStyle = "#333333";
  ctx.stroke(path);

  // Dashed center line
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.setLineDash([24, 32]);
  ctx.stroke(path);
  ctx.setLineDash([]);
}

// ── Draw start/finish line ───────────────────────────────────────────────────
function drawStartLine(
  ctx: CanvasRenderingContext2D,
  camX: number,
  camY: number,
) {
  const wp = WAYPOINTS[0];
  const norm = getTrackNormal(0);
  const sx = wp.x - camX;
  const sy = wp.y - camY;

  // Checkered start line
  const numCells = 8;
  const cellSize = HALF_TRACK / (numCells / 2);
  ctx.save();
  ctx.translate(sx, sy);
  const dir = WAYPOINTS[1];
  ctx.rotate(Math.atan2(dir.y - wp.y, dir.x - wp.x) + Math.PI / 2);
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < numCells; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? "white" : "black";
      ctx.fillRect(
        col * cellSize - HALF_TRACK,
        row * cellSize - cellSize,
        cellSize,
        cellSize,
      );
    }
  }
  ctx.restore();

  // Finish line
  void norm;
  void sx;
  void sy;
}

// ── Draw car ─────────────────────────────────────────────────────────────────
function drawCar(
  ctx: CanvasRenderingContext2D,
  car: CarData,
  sx: number,
  sy: number,
) {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(car.heading + Math.PI / 2);

  if (car.isPlayer) {
    // Triple glow layers
    ctx.shadowColor = car.glowColor;
    ctx.shadowBlur = 28;
    ctx.fillStyle = car.color;
    ctx.fillRect(-8, -16, 16, 32);
    ctx.shadowBlur = 16;
    ctx.fillRect(-8, -16, 16, 32);
    ctx.shadowBlur = 0;
  }

  // Body
  ctx.fillStyle = car.color;
  ctx.beginPath();
  ctx.roundRect(-6, -14, 12, 28, 2);
  ctx.fill();

  // Nose
  ctx.beginPath();
  ctx.moveTo(-4, -14);
  ctx.lineTo(4, -14);
  ctx.lineTo(2, -20);
  ctx.lineTo(-2, -20);
  ctx.closePath();
  ctx.fill();

  // HALO (player only)
  if (car.isPlayer) {
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -8, 4.5, 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Front wing
  ctx.fillStyle = car.isPlayer ? "#00cc60" : car.color;
  ctx.fillRect(-11, -16, 22, 4);

  // Rear wing
  ctx.fillStyle = car.isPlayer ? "#00cc60" : car.color;
  ctx.fillRect(-10, 9, 20, 5);

  // Cockpit
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.beginPath();
  ctx.ellipse(0, -4, 4, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wheels
  const wheelColor = "#222222";
  ctx.fillStyle = wheelColor;
  ctx.fillRect(-10, -10, 4, 8); // FL
  ctx.fillRect(6, -10, 4, 8); // FR
  ctx.fillRect(-10, 5, 4, 8); // RL
  ctx.fillRect(6, 5, 4, 8); // RR

  if (car.isPlayer) {
    // Glowing rim detail
    ctx.strokeStyle = car.glowColor;
    ctx.lineWidth = 1;
    ctx.shadowColor = car.glowColor;
    ctx.shadowBlur = 6;
    ctx.strokeRect(-10, -10, 4, 8);
    ctx.strokeRect(6, -10, 4, 8);
    ctx.strokeRect(-10, 5, 4, 8);
    ctx.strokeRect(6, 5, 4, 8);
  }

  ctx.restore();
}

// ── Draw minimap ─────────────────────────────────────────────────────────────
function drawMinimap(ctx: CanvasRenderingContext2D, cars: CarData[]) {
  const mx = CANVAS_W - 215;
  const my = CANVAS_H - 165;
  const mw = 200;
  const mh = 150;

  // Background
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.beginPath();
  ctx.roundRect(mx - 5, my - 5, mw + 10, mh + 10, 8);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 1;
  ctx.stroke();

  const worldMinX = 80;
  const worldMinY = 80;
  const worldW = 1430;
  const worldH = 970;
  const scaleX = mw / worldW;
  const scaleY = mh / worldH;

  // Draw track outline on minimap
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const wp = WAYPOINTS[i % N];
    const px = mx + (wp.x - worldMinX) * scaleX;
    const py = my + (wp.y - worldMinY) * scaleY;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.strokeStyle = "rgba(120,120,120,0.9)";
  ctx.lineWidth = 8;
  ctx.lineJoin = "round";
  ctx.stroke();

  // Draw start line on minimap
  const wp0 = WAYPOINTS[0];
  ctx.strokeStyle = "white";
  ctx.lineWidth = 2;
  const norm = getTrackNormal(0);
  ctx.beginPath();
  ctx.moveTo(
    mx + (wp0.x - worldMinX + norm.x * 8) * scaleX,
    my + (wp0.y - worldMinY + norm.y * 8) * scaleY,
  );
  ctx.lineTo(
    mx + (wp0.x - worldMinX - norm.x * 8) * scaleX,
    my + (wp0.y - worldMinY - norm.y * 8) * scaleY,
  );
  ctx.stroke();

  // Draw car dots
  for (const car of cars) {
    const px = mx + (car.x - worldMinX) * scaleX;
    const py = my + (car.y - worldMinY) * scaleY;
    ctx.beginPath();
    ctx.arc(px, py, car.isPlayer ? 5 : 3.5, 0, Math.PI * 2);
    ctx.fillStyle = car.color;
    if (car.isPlayer) {
      ctx.shadowColor = car.glowColor;
      ctx.shadowBlur = 8;
    }
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  ctx.font = "bold 9px monospace";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText("MAP", mx + mw - 24, my + mh - 4);
}

// ── Draw HUD ─────────────────────────────────────────────────────────────────
function drawHUD(
  ctx: CanvasRenderingContext2D,
  state: RaceState,
  playerSpeedPx: number,
) {
  const player = state.cars[0];
  const currentLap = Math.min(player.laps + 1, TOTAL_LAPS);
  const playerPos = state.sortedIdx.findIndex((i) => i === 0) + 1;
  const speedKmh = Math.round(Math.abs(playerSpeedPx) * 45);

  // HUD panel top-left
  const hudX = 10;
  const hudY = 10;
  const hudW = 190;
  const hudH = 80;

  ctx.fillStyle = "rgba(0,0,0,0.72)";
  ctx.beginPath();
  ctx.roundRect(hudX, hudY, hudW, hudH, 8);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,255,128,0.35)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // LAP
  ctx.font = "bold 11px monospace";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText("LAP", hudX + 10, hudY + 22);
  ctx.font = "bold 22px monospace";
  ctx.fillStyle = "#00ff80";
  ctx.shadowColor = "#00ff80";
  ctx.shadowBlur = 8;
  ctx.fillText(`${currentLap} / ${TOTAL_LAPS}`, hudX + 10, hudY + 46);
  ctx.shadowBlur = 0;

  // POSITION
  ctx.font = "bold 11px monospace";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText("POS", hudX + 110, hudY + 22);
  const posColors = [
    "#ffd700",
    "#c0c0c0",
    "#cd7f32",
    "#ffffff",
    "#ffffff",
    "#ffffff",
  ];
  ctx.font = "bold 22px monospace";
  ctx.fillStyle = posColors[playerPos - 1] || "#ffffff";
  if (playerPos <= 3) {
    ctx.shadowColor = posColors[playerPos - 1];
    ctx.shadowBlur = 10;
  }
  ctx.fillText(`P${playerPos}`, hudX + 110, hudY + 46);
  ctx.shadowBlur = 0;

  // SPEED
  ctx.font = "bold 11px monospace";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText(`${speedKmh} km/h`, hudX + 10, hudY + 68);

  // PLAYER NAME
  ctx.font = "bold 11px monospace";
  ctx.fillStyle = "rgba(0,255,128,0.7)";
  ctx.fillText("TITOO", hudX + 110, hudY + 68);
}

// ── Draw countdown ───────────────────────────────────────────────────────────
function drawCountdown(ctx: CanvasRenderingContext2D, frames: number) {
  const secLeft = Math.ceil(frames / 60);
  const isGo = frames <= 0;
  const text = isGo ? "GO!" : String(secLeft);
  const alpha = isGo
    ? Math.max(0, 1 - Math.abs(frames) / 40)
    : 1 - (((frames % 60) / 60) * 0.4 + 0.0);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = "bold 96px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const color = isGo ? "#00ff80" : secLeft === 1 ? "#ff4444" : "#ffdd00";
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 30;
  ctx.fillText(text, CANVAS_W / 2, CANVAS_H / 2 - 40);
  ctx.shadowBlur = 0;
  ctx.restore();
}

// ── Draw finish results ───────────────────────────────────────────────────────
function drawFinishScreen(
  ctx: CanvasRenderingContext2D,
  state: RaceState,
  alpha: number,
) {
  ctx.save();
  ctx.globalAlpha = alpha;

  // Semi-transparent panel
  const pw = 320;
  const ph = 280;
  const px = (CANVAS_W - pw) / 2;
  const py = (CANVAS_H - ph) / 2 - 30;

  ctx.fillStyle = "rgba(5,8,16,0.92)";
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 12);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,255,128,0.5)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Title
  ctx.textAlign = "center";
  ctx.font = "bold 28px monospace";
  ctx.fillStyle = "#00ff80";
  ctx.shadowColor = "#00ff80";
  ctx.shadowBlur = 16;
  ctx.fillText("RACE FINISHED", CANVAS_W / 2, py + 40);
  ctx.shadowBlur = 0;

  // Results header
  ctx.font = "bold 12px monospace";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText("FINAL CLASSIFICATION", CANVAS_W / 2, py + 65);

  // Positions
  const posColors = [
    "#ffd700",
    "#c0c0c0",
    "#cd7f32",
    "rgba(255,255,255,0.8)",
    "rgba(255,255,255,0.6)",
    "rgba(255,255,255,0.6)",
  ];

  state.sortedIdx.slice(0, 6).forEach((carIdx, pos) => {
    const car = state.cars[carIdx];
    const rowY = py + 90 + pos * 30;
    const pts = F1_POINTS[pos];

    // Position number
    ctx.textAlign = "left";
    ctx.font = "bold 14px monospace";
    ctx.fillStyle = posColors[pos];
    if (pos < 3) {
      ctx.shadowColor = posColors[pos];
      ctx.shadowBlur = 8;
    }
    ctx.fillText(`P${pos + 1}`, px + 20, rowY);
    ctx.shadowBlur = 0;

    // Car name
    ctx.font = car.isPlayer ? "bold 14px monospace" : "14px monospace";
    ctx.fillStyle = car.isPlayer ? "#00ff80" : "rgba(255,255,255,0.85)";
    if (car.isPlayer) {
      ctx.shadowColor = "#00ff80";
      ctx.shadowBlur = 6;
    }
    ctx.fillText(car.name, px + 60, rowY);
    ctx.shadowBlur = 0;

    // Points
    ctx.textAlign = "right";
    ctx.font = "bold 14px monospace";
    ctx.fillStyle = posColors[pos];
    ctx.fillText(`${pts} pts`, px + pw - 20, rowY);
  });

  // Player result highlight
  const playerPosIdx = state.sortedIdx.findIndex((i) => i === 0);
  const finalPts = F1_POINTS[playerPosIdx] || 0;
  ctx.textAlign = "center";
  ctx.font = "bold 14px monospace";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText(
    `YOUR SCORE: ${finalPts} championship pts`,
    CANVAS_W / 2,
    py + ph - 20,
  );

  ctx.restore();
}

// ── Draw background ───────────────────────────────────────────────────────────
function drawBackground(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#0d1f0d";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

// ── Wheel rotation state ─────────────────────────────────────────────────────
interface WheelRotation {
  z: number; // left/right tilt (rotateZ)
  x: number; // up/down tilt (rotateX) — positive = tilt back (brake), negative = tilt forward (accel)
}

// ── F1 Steering Wheel SVG component ──────────────────────────────────────────
function SteeringWheelSVG({ rotation }: { rotation: WheelRotation }) {
  return (
    <svg
      width="120"
      height="110"
      viewBox="0 0 120 110"
      style={{
        transform: `perspective(300px) rotateZ(${rotation.z}deg) rotateX(${rotation.x}deg)`,
        transition: "transform 0.05s ease-out",
        filter: "drop-shadow(0 0 8px rgba(0,255,128,0.6))",
        transformStyle: "preserve-3d",
      }}
      aria-hidden="true"
    >
      {/* Outer ring - flat bottom F1 style */}
      <path
        d="M 20 65 A 42 42 0 1 1 100 65 L 100 72 Q 100 80 60 80 Q 20 80 20 72 Z"
        fill="none"
        stroke="#00ff80"
        strokeWidth="7"
        strokeLinejoin="round"
      />
      {/* Horizontal center bar (left grip) */}
      <rect
        x="14"
        y="56"
        width="28"
        height="9"
        rx="4"
        fill="#00ff80"
        opacity="0.9"
      />
      {/* Horizontal center bar (right grip) */}
      <rect
        x="78"
        y="56"
        width="28"
        height="9"
        rx="4"
        fill="#00ff80"
        opacity="0.9"
      />
      {/* Center hub */}
      <circle
        cx="60"
        cy="60"
        r="14"
        fill="#0a1a0a"
        stroke="#00ff80"
        strokeWidth="3"
      />
      {/* Hub inner detail */}
      <circle cx="60" cy="60" r="7" fill="#00ff80" opacity="0.3" />
      {/* Spokes */}
      <line
        x1="60"
        y1="46"
        x2="60"
        y2="20"
        stroke="#00ff80"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <line
        x1="46"
        y1="60"
        x2="18"
        y2="60"
        stroke="#00ff80"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <line
        x1="74"
        y1="60"
        x2="102"
        y2="60"
        stroke="#00ff80"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* DRS / button indicators on wheel */}
      <rect
        x="30"
        y="50"
        width="10"
        height="5"
        rx="2"
        fill="#ff4444"
        opacity="0.8"
      />
      <rect
        x="80"
        y="50"
        width="10"
        height="5"
        rx="2"
        fill="#3399ff"
        opacity="0.8"
      />
    </svg>
  );
}

// ── Derive direction hint label from wheel rotation ──────────────────────────
function getDirectionHint(rotation: WheelRotation): string {
  const absZ = Math.abs(rotation.z);
  const absX = Math.abs(rotation.x);
  const THRESHOLD = 5;

  // Dominant axis determines label
  if (absX > absZ && absX > THRESHOLD) {
    // X-axis dominant: up/down
    return rotation.x < 0 ? "▲ GO" : "▼ BRAKE";
  }
  if (absZ > THRESHOLD) {
    return rotation.z < 0 ? "◀ LEFT" : "RIGHT ▶";
  }
  return "STEER";
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  onStateChange: (state: "idle" | "playing" | "gameover") => void;
  onScoreChange: (score: number, speedLevel: number, lives: number) => void;
  autoStart?: boolean;
}

export default function F1Game({
  onStateChange,
  onScoreChange,
  autoStart,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<RaceState>(createInitialState());
  const keysRef = useRef<Set<string>>(new Set());
  const rafRef = useRef<number>(0);
  const goTimerRef = useRef<number>(0); // frames to show GO!
  const finishCountRef = useRef({ val: 0 });

  // Steering wheel 2D rotation state
  const [wheelRotation, setWheelRotation] = useState<WheelRotation>({
    z: 0,
    x: 0,
  });

  // Track both startX and startY for 2D joystick drag
  const wheelDragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    pointerId: number;
  } | null>(null);

  const startCountdown = useCallback(() => {
    const s = stateRef.current;
    s.phase = "countdown";
    s.countdown = COUNTDOWN_FRAMES;
    goTimerRef.current = 0;
    onStateChange("playing");
  }, [onStateChange]);

  useEffect(() => {
    if (autoStart) {
      startCountdown();
    }
  }, [autoStart, startCountdown]);

  // Key handlers
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)
      ) {
        e.preventDefault();
      }
      if (e.key === "Enter" && stateRef.current.phase === "idle") {
        startCountdown();
      }
    };
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.key);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [startCountdown]);

  // Touch controls for mobile (canvas-level, kept for fallback)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let touchAccel = false;

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      for (const touch of Array.from(e.touches)) {
        const rect = canvas.getBoundingClientRect();
        const y = touch.clientY - rect.top;
        const relY = y / rect.height;
        if (relY <= 0.7) {
          touchAccel = true;
        }
      }
      if (touchAccel) keysRef.current.add("ArrowUp");
    };

    const handleTouchEnd = () => {
      touchAccel = false;
      keysRef.current.delete("ArrowUp");
    };

    canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    canvas.addEventListener("touchend", handleTouchEnd, { passive: false });
    canvas.addEventListener("touchcancel", handleTouchEnd, { passive: false });
    return () => {
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchend", handleTouchEnd);
      canvas.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, []);

  // ── Steering wheel pointer handlers (full 2D joystick) ───────────────────────
  const handleWheelPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      wheelDragRef.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        pointerId: e.pointerId,
      };
      if (stateRef.current.phase === "idle") {
        startCountdown();
      }
    },
    [startCountdown],
  );

  const handleWheelPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = wheelDragRef.current;
      if (!drag?.active || e.pointerId !== drag.pointerId) return;

      const deltaX = e.clientX - drag.startX;
      const deltaY = e.clientY - drag.startY;
      const DEAD_ZONE = 8;
      const MAX_DRAG = 60;

      // ── Horizontal axis: left / right steering ──
      if (deltaX < -DEAD_ZONE) {
        const intensity = Math.min(Math.abs(deltaX), MAX_DRAG) / MAX_DRAG;
        keysRef.current.add("ArrowLeft");
        keysRef.current.delete("ArrowRight");
        setWheelRotation((prev) => ({
          ...prev,
          z: -Math.round(intensity * 30),
        }));
      } else if (deltaX > DEAD_ZONE) {
        const intensity = Math.min(deltaX, MAX_DRAG) / MAX_DRAG;
        keysRef.current.add("ArrowRight");
        keysRef.current.delete("ArrowLeft");
        setWheelRotation((prev) => ({
          ...prev,
          z: Math.round(intensity * 30),
        }));
      } else {
        keysRef.current.delete("ArrowLeft");
        keysRef.current.delete("ArrowRight");
        setWheelRotation((prev) => ({ ...prev, z: 0 }));
      }

      // ── Vertical axis: up = accelerate, down = brake ──
      // Drag UP (negative deltaY) = accelerate
      if (deltaY < -DEAD_ZONE) {
        const intensity = Math.min(Math.abs(deltaY), MAX_DRAG) / MAX_DRAG;
        keysRef.current.add("ArrowUp");
        keysRef.current.delete("ArrowDown");
        // rotateX negative = tilt top of wheel toward viewer (lean forward)
        setWheelRotation((prev) => ({
          ...prev,
          x: -Math.round(intensity * 25),
        }));
      } else if (deltaY > DEAD_ZONE) {
        // Drag DOWN = brake
        const intensity = Math.min(deltaY, MAX_DRAG) / MAX_DRAG;
        keysRef.current.add("ArrowDown");
        keysRef.current.delete("ArrowUp");
        // rotateX positive = tilt top of wheel away from viewer (lean back)
        setWheelRotation((prev) => ({
          ...prev,
          x: Math.round(intensity * 25),
        }));
      } else {
        keysRef.current.delete("ArrowUp");
        keysRef.current.delete("ArrowDown");
        setWheelRotation((prev) => ({ ...prev, x: 0 }));
      }
    },
    [],
  );

  const handleWheelPointerUp = useCallback(
    (_e: React.PointerEvent<HTMLDivElement>) => {
      wheelDragRef.current = null;
      setWheelRotation({ z: 0, x: 0 });
      keysRef.current.delete("ArrowLeft");
      keysRef.current.delete("ArrowRight");
      keysRef.current.delete("ArrowUp");
      keysRef.current.delete("ArrowDown");
    },
    [],
  );

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const loop = () => {
      const s = stateRef.current;
      const player = s.cars[0];

      // ── UPDATE ──
      if (s.phase === "countdown") {
        s.countdown -= 1;
        if (s.countdown <= -40) {
          // GO shown, now racing
          s.phase = "racing";
        }
      } else if (s.phase === "racing") {
        // Update AI cars
        for (let i = 1; i < s.cars.length; i++) {
          updateAI(s.cars[i], finishCountRef.current);
        }
        // Update player
        updatePlayer(player, keysRef.current, finishCountRef.current);

        // Sort positions
        s.sortedIdx = sortPositions(s.cars);
        const playerPos = s.sortedIdx.findIndex((i) => i === 0) + 1;
        const currentLap = Math.min(player.laps + 1, TOTAL_LAPS);
        const ptsForPos = F1_POINTS[playerPos - 1] || 0;
        s.playerPos = playerPos;
        s.currentLap = currentLap;

        // Report to App
        onScoreChange(ptsForPos, currentLap, playerPos);

        // Check race over (player finishes or any car finishes all laps)
        if (player.finished) {
          const playerPosIdx = s.sortedIdx.findIndex((i) => i === 0);
          s.finalPoints = F1_POINTS[playerPosIdx] || 0;
          s.phase = "finished";
          s.finishTimer = FINISH_DISPLAY_FRAMES;
        }
      } else if (s.phase === "finished") {
        // Keep AI moving
        for (let i = 1; i < s.cars.length; i++) {
          updateAI(s.cars[i], finishCountRef.current);
        }
        s.finishTimer -= 1;
        if (s.finishTimer <= 0) {
          const playerPosIdx = s.sortedIdx.findIndex((i) => i === 0);
          onScoreChange(s.finalPoints, TOTAL_LAPS, playerPosIdx + 1);
          onStateChange("gameover");
        }
      }

      // ── DRAW ──
      const camX = player.x - CANVAS_W / 2;
      const camY = player.y - CANVAS_H / 2;

      drawBackground(ctx);
      drawTrack(ctx, camX, camY);
      drawStartLine(ctx, camX, camY);

      // Draw cars (sorted back-to-front by Y for visual layering)
      const drawOrder = [...s.cars].sort((a, b) => a.y - b.y);
      for (const car of drawOrder) {
        drawCar(ctx, car, car.x - camX, car.y - camY);
      }

      // HUD (fixed position, reset transforms)
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (s.phase === "racing" || s.phase === "finished") {
        drawHUD(ctx, s, player.speed);
        drawMinimap(ctx, s.cars);
      }

      if (s.phase === "countdown") {
        drawHUD(ctx, s, 0);
        drawMinimap(ctx, s.cars);
        drawCountdown(ctx, s.countdown);
      }

      if (s.phase === "finished") {
        const fadeIn = Math.min(
          1,
          (FINISH_DISPLAY_FRAMES - s.finishTimer) / 40,
        );
        drawFinishScreen(ctx, s, fadeIn);
      }

      if (s.phase === "idle") {
        // Draw track and prompt
        ctx.font = "bold 18px monospace";
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(0,255,128,0.9)";
        ctx.shadowColor = "#00ff80";
        ctx.shadowBlur = 12;
        ctx.fillText("PRESS ENTER TO RACE", CANVAS_W / 2, CANVAS_H / 2);
        ctx.shadowBlur = 0;
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [onStateChange, onScoreChange]);

  const directionHint = getDirectionHint(wheelRotation);

  // Tint the wheel plate based on current action
  const getWheelGlowColor = () => {
    if (Math.abs(wheelRotation.x) > 5) {
      return wheelRotation.x < 0
        ? "rgba(0,255,128,0.4)" // accelerating — green
        : "rgba(255,60,60,0.4)"; // braking — red
    }
    return "rgba(0,255,128,0.2)";
  };

  return (
    <div className="relative" data-ocid="game.canvas_target">
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        style={{
          display: "block",
          border: "1px solid rgba(0,255,128,0.15)",
          borderRadius: 8,
          boxShadow: "0 0 40px rgba(0,255,128,0.08), 0 0 80px rgba(0,0,0,0.8)",
          touchAction: "none",
        }}
      />

      {/* ── F1 Steering Controller Overlay ── */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-end justify-center"
        style={{
          padding: "12px 16px 16px",
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        {/* Steering Wheel — full 2D joystick (center) */}
        <div
          style={{
            pointerEvents: "auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
            userSelect: "none",
            WebkitUserSelect: "none",
          }}
        >
          {/* Direction arrows hint above wheel */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gridTemplateRows: "1fr 1fr",
              width: 72,
              gap: 2,
              textAlign: "center",
              fontFamily: "monospace",
              fontSize: 11,
              fontWeight: 700,
              userSelect: "none",
            }}
          >
            <span
              style={{
                gridColumn: 2,
                color: wheelRotation.x < -5 ? "#00ff80" : "rgba(0,255,128,0.3)",
                textShadow: wheelRotation.x < -5 ? "0 0 8px #00ff80" : "none",
              }}
            >
              ▲
            </span>
            <span
              style={{
                gridColumn: 1,
                gridRow: 2,
                color: wheelRotation.z < -5 ? "#00ff80" : "rgba(0,255,128,0.3)",
                textShadow: wheelRotation.z < -5 ? "0 0 8px #00ff80" : "none",
              }}
            >
              ◀
            </span>
            <span
              style={{
                gridColumn: 2,
                gridRow: 2,
                color: wheelRotation.x > 5 ? "#ff4444" : "rgba(0,255,128,0.3)",
                textShadow: wheelRotation.x > 5 ? "0 0 8px #ff4444" : "none",
              }}
            >
              ▼
            </span>
            <span
              style={{
                gridColumn: 3,
                gridRow: 2,
                color: wheelRotation.z > 5 ? "#00ff80" : "rgba(0,255,128,0.3)",
                textShadow: wheelRotation.z > 5 ? "0 0 8px #00ff80" : "none",
              }}
            >
              ▶
            </span>
          </div>

          {/* Wheel drag zone */}
          <div
            role="slider"
            aria-label="Steering wheel — drag in any direction to control"
            aria-valuenow={wheelRotation.z}
            aria-valuemin={-30}
            aria-valuemax={30}
            tabIndex={0}
            data-ocid="game.canvas_target"
            style={{
              cursor: "grab",
              touchAction: "none",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 0,
              userSelect: "none",
              WebkitUserSelect: "none",
            }}
            onPointerDown={handleWheelPointerDown}
            onPointerMove={handleWheelPointerMove}
            onPointerUp={handleWheelPointerUp}
            onPointerCancel={handleWheelPointerUp}
          >
            {/* Wheel background plate */}
            <div
              style={{
                background: "rgba(0,10,5,0.78)",
                border: `1.5px solid rgba(0,255,128,${Math.abs(wheelRotation.z) > 5 || Math.abs(wheelRotation.x) > 5 ? "0.75" : "0.35"})`,
                borderRadius: "50%",
                padding: 8,
                backdropFilter: "blur(6px)",
                boxShadow: `0 0 20px ${getWheelGlowColor()}, inset 0 0 12px rgba(0,0,0,0.5)`,
                transition: "box-shadow 0.1s ease, border-color 0.1s ease",
              }}
            >
              <SteeringWheelSVG rotation={wheelRotation} />
            </div>
          </div>

          {/* Direction label below wheel */}
          <div
            style={{
              fontSize: 10,
              fontFamily: "monospace",
              color:
                directionHint === "▼ BRAKE"
                  ? "rgba(255,100,100,0.85)"
                  : directionHint === "STEER"
                    ? "rgba(0,255,128,0.4)"
                    : "rgba(0,255,128,0.85)",
              letterSpacing: 1.5,
              textTransform: "uppercase",
              textShadow:
                directionHint !== "STEER"
                  ? directionHint === "▼ BRAKE"
                    ? "0 0 6px rgba(255,60,60,0.6)"
                    : "0 0 6px rgba(0,255,128,0.5)"
                  : "none",
              transition: "color 0.1s, text-shadow 0.1s",
              minWidth: 72,
              textAlign: "center",
            }}
          >
            {directionHint}
          </div>
        </div>
      </div>
    </div>
  );
}
