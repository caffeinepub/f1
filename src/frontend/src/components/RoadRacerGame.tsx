import { useCallback, useEffect, useRef, useState } from "react";
import type { ScoreEntry } from "../backend.d";
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
  WAYPOINTS_STAGE2,
} from "../hooks/useRoadRacer";

// mutable module-level waypoints – updated by F1Game based on stage prop
let _WP: Point[] = WAYPOINTS;
let N = _WP.length;
const HALF_TRACK = TRACK_WIDTH / 2;
const COUNTDOWN_FRAMES = 180; // 3 seconds at 60fps
const FINISH_DISPLAY_FRAMES = 120; // 2 seconds
const PLAYER_MAX_SPEED = 6.8; // same for Stage 1 and Stage 2

// Starting grid positions (near new WP[0] = {1280, 160}), spacing scaled 1.6x
const GRID_POSITIONS: Point[] = [
  { x: 3680, y: 456 },
  { x: 3680, y: 500 },
  { x: 3520, y: 454 },
  { x: 3520, y: 498 },
  { x: 3360, y: 452 },
  { x: 3360, y: 496 },
];
const START_HEADING = Math.atan2(480 - 456, 3840 - 3680); // toward WP[0] from grid

function createInitialState(): RaceState {
  const player: CarData = {
    x: GRID_POSITIONS[0].x,
    y: GRID_POSITIONS[0].y,
    heading: START_HEADING,
    speed: 0,
    maxSpeed: PLAYER_MAX_SPEED,
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
    maxSpeed: 5 + Math.random() * 1.2,
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
  const wp = _WP[car.targetWP];
  const dx = wp.x - car.x;
  const dy = wp.y - car.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const threshold =
    car.targetWP === 0 ? (car.isPlayer ? 500 : 400) : car.isPlayer ? 280 : 220;

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
  // Use physical distance from finish line to determine if car has gone far enough
  // to earn the next lap credit. More reliable than waypoint-index approach.
  const fdx = car.x - _WP[0].x;
  const fdy = car.y - _WP[0].y;
  const distFromFinish = Math.sqrt(fdx * fdx + fdy * fdy);
  if (!car.lapReady && distFromFinish > 2000) {
    car.lapReady = true;
  }
}

function updateAI(car: CarData, finishCount: { val: number }) {
  if (car.finished) return;
  const wp = _WP[car.targetWP];
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
  steerIntensity = 1.0,
  accelIntensity = 1.0,
) {
  if (car.finished) return;

  const accel = 0.28 * accelIntensity;

  if (keys.has("ArrowUp") || keys.has("w") || keys.has("W")) {
    car.speed = Math.min(car.speed + accel, car.maxSpeed);
  } else if (keys.has("ArrowDown") || keys.has("s") || keys.has("S")) {
    // Stronger braking for better control
    car.speed = Math.max(car.speed - 0.65, -2);
  } else {
    // Slightly quicker natural deceleration (0.97 -> 0.96)
    car.speed *= 0.96;
  }

  if (Math.abs(car.speed) > 0.2) {
    // Base steer rate increased for better grip; analog intensity scales it
    const baseSteer = 0.062;
    // Speed-dependent: full grip at moderate speed, slight reduction at max
    const speedRatio = Math.abs(car.speed) / car.maxSpeed;
    const gripFactor = 1.0 - speedRatio * 0.25; // up to 25% less turn at top speed
    const steer = baseSteer * gripFactor * steerIntensity;

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
  const prev = _WP[(i - 1 + N) % N];
  const next = _WP[(i + 1) % N];
  const dx = next.x - prev.x;
  const dy = next.y - prev.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  return { x: -dy / len, y: dx / len };
}

// ── Spline closest point + track constraint ──────────────────────────────────
function getClosestPointOnSpline(
  x: number,
  y: number,
  points: Point[],
): { cx: number; cy: number; nx: number; ny: number; dist: number } {
  const n = points.length;
  const SAMPLES = 12; // samples per segment
  let bestDist = Number.POSITIVE_INFINITY;
  let bestCx = x;
  let bestCy = y;
  let bestNx = 0;
  let bestNy = -1;

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

    for (let s = 0; s <= SAMPLES; s++) {
      const u = s / SAMPLES;
      const u2 = u * u;
      const u3 = u2 * u;
      // Cubic Bezier
      const bx =
        (1 - u) * (1 - u) * (1 - u) * p1.x +
        3 * (1 - u) * (1 - u) * u * cp1x +
        3 * (1 - u) * u2 * cp2x +
        u3 * p2.x;
      const by =
        (1 - u) * (1 - u) * (1 - u) * p1.y +
        3 * (1 - u) * (1 - u) * u * cp1y +
        3 * (1 - u) * u2 * cp2y +
        u3 * p2.y;
      // Tangent
      const dtx =
        3 * (1 - u) * (1 - u) * (cp1x - p1.x) +
        6 * (1 - u) * u * (cp2x - cp1x) +
        3 * u2 * (p2.x - cp2x);
      const dty =
        3 * (1 - u) * (1 - u) * (cp1y - p1.y) +
        6 * (1 - u) * u * (cp2y - cp1y) +
        3 * u2 * (p2.y - cp2y);
      const tLen = Math.sqrt(dtx * dtx + dty * dty) || 1;
      // Normal (perpendicular, pointing outward = right of direction)
      const nx = dty / tLen;
      const ny = -dtx / tLen;

      const ddx = x - bx;
      const ddy = y - by;
      const d = Math.sqrt(ddx * ddx + ddy * ddy);
      if (d < bestDist) {
        bestDist = d;
        bestCx = bx;
        bestCy = by;
        bestNx = nx;
        bestNy = ny;
      }
    }
  }

  // Signed lateral offset: positive = right of track direction
  const lx = x - bestCx;
  const ly = y - bestCy;
  const signedDist = lx * bestNx + ly * bestNy;

  return { cx: bestCx, cy: bestCy, nx: bestNx, ny: bestNy, dist: signedDist };
}

function constrainToTrack(car: CarData, points: Point[]) {
  const LIMIT = HALF_TRACK - 22; // barrier starts slightly inside visual edge
  const result = getClosestPointOnSpline(car.x, car.y, points);
  const absLat = Math.abs(result.dist);
  if (absLat > LIMIT) {
    // Push car back inside the limit
    const overshoot = absLat - LIMIT;
    const sign = result.dist > 0 ? 1 : -1;
    car.x -= result.nx * sign * overshoot;
    car.y -= result.ny * sign * overshoot;
    // Absorb speed (40% energy loss)
    car.speed *= 0.6;
    // Reflect heading slightly away from the barrier
    const wallNx = result.nx * sign;
    const wallNy = result.ny * sign;
    const dot = Math.cos(car.heading) * wallNx + Math.sin(car.heading) * wallNy;
    car.heading -= dot * wallNx * 0.8;
    car.heading -= dot * wallNy * 0.8;
  }
}

// ── Draw background (daytime) ─────────────────────────────────────────────────
function drawBackground(ctx: CanvasRenderingContext2D) {
  // Sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  sky.addColorStop(0, "#87CEEB");
  sky.addColorStop(1, "#d0eeff");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Grass
  ctx.fillStyle = "#4a7c3f";
  ctx.fillRect(0, CANVAS_H * 0.55, CANVAS_W, CANVAS_H * 0.45);

  // Grass highlight band
  ctx.fillStyle = "#5a9e4e";
  ctx.fillRect(0, CANVAS_H * 0.55, CANVAS_W, 18);
}

// ── Draw grandstand audience ──────────────────────────────────────────────────
const CROWD_PALETTE = [
  "#E8002D",
  "#3671C6",
  "#FF8000",
  "#FFFFFF",
  "#FFFF00",
  "#006F62",
  "#FF69B4",
  "#C0C0C0",
];

// Stand indices (waypoint indices where stands are placed)
const STAND_WP_INDICES = [0, 3, 6, 9, 12, 15, 18, 20];

function drawAudience(
  ctx: CanvasRenderingContext2D,
  camX: number,
  camY: number,
) {
  const STAND_OFFSET = 300; // perpendicular offset from track center
  const STAND_W = 400; // world units wide
  const STAND_DEPTH = 120; // world units deep
  const ROWS = 4;
  const COLS = 25;
  const DOT_SIZE = 14; // world units per crowd dot

  for (const wpIdx of STAND_WP_INDICES) {
    const wp = _WP[wpIdx];
    const norm = getTrackNormal(wpIdx);

    // Tangent along track
    const next = _WP[(wpIdx + 1) % N];
    const tx = next.x - wp.x;
    const ty = next.y - wp.y;
    const tLen = Math.sqrt(tx * tx + ty * ty) || 1;
    const tang = { x: tx / tLen, y: ty / tLen };

    // Draw stands on both sides (+norm and -norm)
    for (const side of [1, -1]) {
      const cx = wp.x + norm.x * STAND_OFFSET * side;
      const cy = wp.y + norm.y * STAND_OFFSET * side;

      // Screen coordinates of stand center
      const sx = cx - camX;
      const sy = cy - camY;

      // Skip if completely off screen
      if (sx < -STAND_W - 80 || sx > CANVAS_W + STAND_W + 80) continue;
      if (sy < -STAND_DEPTH - 80 || sy > CANVAS_H + STAND_DEPTH + 80) continue;

      ctx.save();
      ctx.translate(sx, sy);
      // Rotate to align with track tangent
      ctx.rotate(Math.atan2(tang.y, tang.x));

      // Grandstand structure (grey backdrop)
      ctx.fillStyle = "#6b7280";
      ctx.fillRect(
        -STAND_W / 2 - 4,
        -(STAND_DEPTH / 2) * side - 8,
        STAND_W + 8,
        STAND_DEPTH + 12,
      );

      // Grandstand roof tint
      ctx.fillStyle = "#4b5563";
      ctx.fillRect(
        -STAND_W / 2 - 4,
        -(STAND_DEPTH / 2) * side - 8,
        STAND_W + 8,
        10,
      );

      // Crowd rows
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          const colorIdx = (col + row * 3) % CROWD_PALETTE.length;
          ctx.fillStyle = CROWD_PALETTE[colorIdx];

          const dotX = -STAND_W / 2 + col * (STAND_W / COLS) + 2;
          const dotY = -STAND_DEPTH / 2 + row * (STAND_DEPTH / ROWS) + 4;

          ctx.fillRect(dotX, dotY, DOT_SIZE - 1, DOT_SIZE - 1);

          // Head circle on top
          ctx.fillStyle = "#f5cba7";
          ctx.beginPath();
          ctx.arc(dotX + (DOT_SIZE - 1) / 2, dotY - 2, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Team flags above the stands (alternating colours)
      const flagColors = [
        "#E8002D",
        "#3671C6",
        "#FF8000",
        "#006F62",
        "#FFFF00",
      ];
      for (let f = 0; f < 5; f++) {
        const flagX = -STAND_W / 2 + (f + 0.5) * (STAND_W / 5);
        const flagY = -STAND_DEPTH / 2 - 20;
        // Pole
        ctx.strokeStyle = "#9ca3af";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(flagX, flagY);
        ctx.lineTo(flagX, flagY - 18);
        ctx.stroke();
        // Flag rectangle
        ctx.fillStyle = flagColors[f % flagColors.length];
        ctx.fillRect(flagX + 1, flagY - 18, 14, 8);
      }

      ctx.restore();
    }
  }
}

// ── Draw track ───────────────────────────────────────────────────────────────
function drawTrack(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
  const path = buildSplinePath(_WP, camX, camY);

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

  // ── Outer armco barrier (silver crash barrier) ──
  ctx.lineWidth = TRACK_WIDTH + 40;
  ctx.strokeStyle = "#8a9aaa";
  ctx.stroke(path);

  // Thin white highlight line on top of armco
  ctx.lineWidth = TRACK_WIDTH + 36;
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
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

  // ── Inner tyre wall (red/white alternating dashes) ──
  const tyreWallWidth = TRACK_WIDTH - 8;
  ctx.lineWidth = tyreWallWidth;
  const tyreLen = 12;
  ctx.setLineDash([tyreLen, tyreLen]);
  ctx.strokeStyle = "#cc0000";
  ctx.stroke(path);
  ctx.lineDashOffset = tyreLen;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke(path);
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;

  // Re-draw track surface over inner tyre wall (tyre wall is only at the very edge)
  ctx.lineWidth = TRACK_WIDTH - 16;
  ctx.strokeStyle = "#2d2d2d";
  ctx.stroke(path);

  ctx.lineWidth = TRACK_WIDTH - 32;
  ctx.strokeStyle = "#333333";
  ctx.stroke(path);

  // ── Tyre stack circles at every 3rd waypoint (inner barrier decoration) ──
  ctx.shadowBlur = 0;
  for (let i = 0; i < N; i += 3) {
    const wp = _WP[i];
    const norm = getTrackNormal(i);
    // Place tyre stacks just inside the inner edge of the track
    const innerOffset = HALF_TRACK - 14;
    for (const side of [1, -1]) {
      const tx = wp.x + norm.x * innerOffset * side - camX;
      const ty = wp.y + norm.y * innerOffset * side - camY;
      // Skip if off-screen
      if (tx < -30 || tx > CANVAS_W + 30 || ty < -30 || ty > CANVAS_H + 30)
        continue;
      // Stack of 3 tyres
      for (let stack = 0; stack < 3; stack++) {
        const stackOffset = stack * 5;
        ctx.beginPath();
        ctx.arc(tx, ty - stackOffset, 7, 0, Math.PI * 2);
        ctx.fillStyle = stack % 2 === 0 ? "#cc0000" : "#ffffff";
        ctx.fill();
        ctx.strokeStyle = "#222222";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  // ── Pit lane box near waypoint 2 ──
  const pitWP = _WP[2];
  const pitNorm = getTrackNormal(2);
  const pitX = pitWP.x + pitNorm.x * (HALF_TRACK - 10) - camX;
  const pitY = pitWP.y + pitNorm.y * (HALF_TRACK - 10) - camY;
  if (
    pitX > -100 &&
    pitX < CANVAS_W + 100 &&
    pitY > -100 &&
    pitY < CANVAS_H + 100
  ) {
    ctx.save();
    ctx.translate(pitX, pitY);
    const pitAngle = Math.atan2(_WP[3].y - pitWP.y, _WP[3].x - pitWP.x);
    ctx.rotate(pitAngle + Math.PI / 2);
    // Yellow pit box
    ctx.fillStyle = "#ffff00";
    ctx.fillRect(-20, -10, 40, 20);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-20, -10, 40, 20);
    // PIT label
    ctx.fillStyle = "#000000";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("PIT", 0, 0);
    ctx.restore();
  }

  // ── Armco barricades along track edges ─────────────────────────────────────
  {
    const BARRIER_INTERVAL = 200; // world units between barriers
    const BARRIER_W = 40; // barrier width along track
    const BARRIER_H = 14; // barrier height (thickness)
    const outerOffset = HALF_TRACK + 2;
    const innerOffset = HALF_TRACK + 2;

    // Sample spline to find evenly spaced barricade positions
    const n = _WP.length;
    const allPts: {
      bx: number;
      by: number;
      nx: number;
      ny: number;
      angle: number;
    }[] = [];
    const TOTAL_SAMPLES = n * 16;
    for (let s = 0; s < TOTAL_SAMPLES; s++) {
      const frac = s / TOTAL_SAMPLES;
      const rawIdx = frac * n;
      const i = Math.floor(rawIdx) % n;
      const u = rawIdx - Math.floor(rawIdx);
      const u2 = u * u;
      const p0 = _WP[(i - 1 + n) % n];
      const p1 = _WP[i];
      const p2 = _WP[(i + 1) % n];
      const p3 = _WP[(i + 2) % n];
      const t = 0.5;
      const cp1x = p1.x + ((p2.x - p0.x) * t) / 2;
      const cp1y = p1.y + ((p2.y - p0.y) * t) / 2;
      const cp2x = p2.x - ((p3.x - p1.x) * t) / 2;
      const cp2y = p2.y - ((p3.y - p1.y) * t) / 2;
      const bx =
        (1 - u) * (1 - u) * (1 - u) * p1.x +
        3 * (1 - u) * (1 - u) * u * cp1x +
        3 * (1 - u) * u2 * cp2x +
        u * u * u * p2.x;
      const by =
        (1 - u) * (1 - u) * (1 - u) * p1.y +
        3 * (1 - u) * (1 - u) * u * cp1y +
        3 * (1 - u) * u2 * cp2y +
        u * u * u * p2.y;
      const dtx =
        3 * (1 - u) * (1 - u) * (cp1x - p1.x) +
        6 * (1 - u) * u * (cp2x - cp1x) +
        3 * u * u * (p2.x - cp2x);
      const dty =
        3 * (1 - u) * (1 - u) * (cp1y - p1.y) +
        6 * (1 - u) * u * (cp2y - cp1y) +
        3 * u * u * (p2.y - cp2y);
      const tLen = Math.sqrt(dtx * dtx + dty * dty) || 1;
      const nx = dty / tLen;
      const ny = -dtx / tLen;
      const angle = Math.atan2(dty, dtx);
      allPts.push({ bx, by, nx, ny, angle });
    }

    // Pick positions spaced ~BARRIER_INTERVAL apart along spline
    const positions: typeof allPts = [];
    let accDist = 0;
    for (let k = 0; k < allPts.length; k++) {
      const prev = allPts[(k - 1 + allPts.length) % allPts.length];
      const cur = allPts[k];
      const ddx = cur.bx - prev.bx;
      const ddy = cur.by - prev.by;
      accDist += Math.sqrt(ddx * ddx + ddy * ddy);
      if (k === 0 || accDist >= BARRIER_INTERVAL) {
        positions.push(cur);
        accDist = 0;
      }
    }

    for (let k = 0; k < positions.length; k++) {
      const { bx, by, nx, ny, angle } = positions[k];
      const isRed = k % 2 === 0;

      for (const side of [1, -1] as const) {
        const offset = side === 1 ? outerOffset : innerOffset;
        const bsX = bx + nx * offset * side - camX;
        const bsY = by + ny * offset * side - camY;
        if (
          bsX < -60 ||
          bsX > CANVAS_W + 60 ||
          bsY < -60 ||
          bsY > CANVAS_H + 60
        )
          continue;

        ctx.save();
        ctx.translate(bsX, bsY);
        ctx.rotate(angle);
        // Shadow
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 2;
        // Main color
        ctx.fillStyle = isRed ? "#dd1111" : "#f0f0f0";
        ctx.fillRect(-BARRIER_W / 2, -BARRIER_H / 2, BARRIER_W, BARRIER_H);
        // Highlight stripe on top
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.fillStyle = isRed ? "rgba(255,80,80,0.5)" : "rgba(255,255,255,0.8)";
        ctx.fillRect(
          -BARRIER_W / 2,
          -BARRIER_H / 2,
          BARRIER_W,
          BARRIER_H * 0.35,
        );
        // Border
        ctx.strokeStyle = "#333";
        ctx.lineWidth = 0.8;
        ctx.strokeRect(-BARRIER_W / 2, -BARRIER_H / 2, BARRIER_W, BARRIER_H);
        ctx.restore();
      }
    }
  }

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
  const wp = _WP[0];
  const norm = getTrackNormal(0);
  const sx = wp.x - camX;
  const sy = wp.y - camY;

  // Checkered start line
  const numCells = 8;
  const cellSize = HALF_TRACK / (numCells / 2);
  ctx.save();
  ctx.translate(sx, sy);
  const dir = _WP[1];
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
  boostActive: boolean,
) {
  // ── Boost pulse rings (drawn before car so they appear behind) ──
  if (boostActive && car.isPlayer) {
    const pulsePhase = (Date.now() / 80) % (Math.PI * 2);
    const rings = [
      { baseR: 24, alpha: 0.7 },
      { baseR: 36, alpha: 0.45 },
      { baseR: 50, alpha: 0.25 },
    ];
    for (let r = 0; r < rings.length; r++) {
      const ring = rings[r];
      const pulsedR = ring.baseR + Math.sin(pulsePhase + r * 0.9) * 5;
      ctx.save();
      ctx.shadowColor = "#ffd700";
      ctx.shadowBlur = 20;
      ctx.strokeStyle = `rgba(255,215,0,${ring.alpha})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(sx, sy, pulsedR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(car.heading + Math.PI / 2);

  if (car.isPlayer) {
    // Triple glow layers
    ctx.shadowColor = car.glowColor;
    ctx.shadowBlur = boostActive ? 40 : 28;
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
    ctx.strokeStyle = boostActive ? "#ffd700" : car.glowColor;
    ctx.lineWidth = 1;
    ctx.shadowColor = boostActive ? "#ffd700" : car.glowColor;
    ctx.shadowBlur = 6;
    ctx.strokeRect(-10, -10, 4, 8);
    ctx.strokeRect(6, -10, 4, 8);
    ctx.strokeRect(-10, 5, 4, 8);
    ctx.strokeRect(6, 5, 4, 8);
  }

  ctx.restore();
}

// ── Draw rear view mirror ────────────────────────────────────────────────────
function drawRearView(
  ctx: CanvasRenderingContext2D,
  cars: CarData[],
  player: CarData,
) {
  const MW = 180;
  const MH = 90;
  const MX = CANVAS_W / 2 - MW / 2;
  const MY = 8;
  const RADIUS = 12;

  ctx.save();

  // ── Chrome border (drawn before clip so it shows over the mirror content) ──
  // Outer chrome glow
  ctx.shadowColor = "rgba(200,220,255,0.6)";
  ctx.shadowBlur = 8;
  ctx.strokeStyle = "#b8c8d8";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(MX - 2, MY - 2, MW + 4, MH + 4, RADIUS + 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Inner chrome highlight
  ctx.strokeStyle = "#d8e8f0";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(MX - 1, MY - 1, MW + 2, MH + 2, RADIUS + 1);
  ctx.stroke();

  // ── Clip to mirror shape ──
  ctx.beginPath();
  ctx.roundRect(MX, MY, MW, MH, RADIUS);
  ctx.clip();

  // ── Background ──
  // Slightly blue-tinted dark to simulate camera/glass look
  ctx.fillStyle = "#0a0f18";
  ctx.fillRect(MX, MY, MW, MH);

  // ── Draw a simplified track strip (asphalt-colored band) ──
  // The track strip is drawn in world space relative to player
  // We rotate the view 180 degrees (looking backward)
  const mirrorCX = MX + MW / 2;
  const mirrorCY = MY + MH / 2;

  ctx.save();
  ctx.translate(mirrorCX, mirrorCY);
  // Rotate 180 degrees + player heading so we look behind the player
  ctx.rotate(player.heading + Math.PI / 2 + Math.PI);

  // Scale: world units → mirror pixels
  // Show roughly ±120 world units wide, ±180 world units tall (behind)
  const WORLD_VIEW_W = 240;
  const WORLD_VIEW_H = 360;
  const scaleX = MW / WORLD_VIEW_W;
  const scaleY = MH / WORLD_VIEW_H;
  const scale = Math.min(scaleX, scaleY);

  ctx.scale(scale, scale);

  // Player is at origin (center of mirror world space)
  // We offset so player appears at bottom-center of mirror
  // (which becomes top-center after 180° rotation)
  ctx.translate(0, -WORLD_VIEW_H * 0.35);

  // Track strip — approximate road surface behind player
  const trackW = TRACK_WIDTH * 0.9;
  ctx.fillStyle = "#2a2a2a";
  ctx.fillRect(-trackW / 2, -WORLD_VIEW_H, trackW, WORLD_VIEW_H * 2);

  // Track surface highlight
  ctx.fillStyle = "#303030";
  ctx.fillRect(-trackW / 2 + 6, -WORLD_VIEW_H, trackW - 12, WORLD_VIEW_H * 2);

  // Centre line dashes
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 3 / scale;
  ctx.setLineDash([20, 30]);
  ctx.beginPath();
  ctx.moveTo(0, -WORLD_VIEW_H);
  ctx.lineTo(0, WORLD_VIEW_H);
  ctx.stroke();
  ctx.setLineDash([]);

  // Kerb stripes (left & right edges)
  ctx.lineWidth = 6 / scale;
  ctx.setLineDash([16, 16]);
  ctx.strokeStyle = "#e8002d";
  ctx.beginPath();
  ctx.moveTo(-trackW / 2, -WORLD_VIEW_H);
  ctx.lineTo(-trackW / 2, WORLD_VIEW_H);
  ctx.stroke();
  ctx.strokeStyle = "#ffffff";
  ctx.lineDashOffset = 16;
  ctx.beginPath();
  ctx.moveTo(-trackW / 2, -WORLD_VIEW_H);
  ctx.lineTo(-trackW / 2, WORLD_VIEW_H);
  ctx.stroke();

  ctx.strokeStyle = "#e8002d";
  ctx.lineDashOffset = 0;
  ctx.beginPath();
  ctx.moveTo(trackW / 2, -WORLD_VIEW_H);
  ctx.lineTo(trackW / 2, WORLD_VIEW_H);
  ctx.stroke();
  ctx.strokeStyle = "#ffffff";
  ctx.lineDashOffset = 16;
  ctx.beginPath();
  ctx.moveTo(trackW / 2, -WORLD_VIEW_H);
  ctx.lineTo(trackW / 2, WORLD_VIEW_H);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;

  // ── Draw AI cars behind the player ──
  // In the rotated/scaled coordinate system, the player is at (0, 0) offset.
  // We need to transform each car's world position relative to the player,
  // then rotate by the same mirror transform.
  for (const car of cars) {
    if (car.isPlayer) continue;

    // World-space offset from player
    const wdx = car.x - player.x;
    const wdy = car.y - player.y;

    // Rotate by -(player.heading + PI/2 + PI) to get into mirror local space
    const mirrorAngle = -(player.heading + Math.PI / 2 + Math.PI);
    const lx = wdx * Math.cos(mirrorAngle) - wdy * Math.sin(mirrorAngle);
    const ly = wdx * Math.sin(mirrorAngle) + wdy * Math.cos(mirrorAngle);

    // Only show cars that appear behind (positive ly in mirror space = ahead in mirror = behind player)
    // We'll show all nearby cars within a generous range
    const dist = Math.sqrt(wdx * wdx + wdy * wdy);
    if (dist > 350) continue;

    // Car position in mirror coords (already translated by offset above)
    const carX = lx;
    const carY = ly;

    // Draw a small car shape
    ctx.save();
    ctx.translate(carX, carY);
    // Rotate car in mirror space (car heading relative to mirror view)
    const carMirrorHeading =
      car.heading - (player.heading + Math.PI / 2 + Math.PI);
    ctx.rotate(carMirrorHeading + Math.PI / 2);

    // Glow effect
    ctx.shadowColor = car.color;
    ctx.shadowBlur = 8;

    // Body
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(-4, -9, 8, 18, 2);
    ctx.fill();

    // Front wing
    ctx.fillRect(-7, -10, 14, 3);

    // Rear wing
    ctx.fillRect(-6, 6, 12, 3);

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // ── Player car indicator at bottom of mirror ──
  ctx.save();
  ctx.shadowColor = "#00ff80";
  ctx.shadowBlur = 10;
  ctx.fillStyle = "#00ff80";
  ctx.beginPath();
  ctx.roundRect(-5, -8, 10, 16, 2);
  ctx.fill();
  ctx.fillRect(-8, -9, 16, 3); // front wing
  ctx.fillRect(-7, 7, 14, 3); // rear wing
  ctx.shadowBlur = 0;
  ctx.restore();

  ctx.restore(); // restore mirror camera transform

  // ── Scanline effect for camera feel ──
  ctx.save();
  ctx.globalAlpha = 0.06;
  for (let scanY = MY; scanY < MY + MH; scanY += 3) {
    ctx.fillStyle = "#000000";
    ctx.fillRect(MX, scanY, MW, 1);
  }
  ctx.globalAlpha = 1;

  // ── Vignette at edges ──
  const vignette = ctx.createRadialGradient(
    mirrorCX,
    mirrorCY,
    MW * 0.2,
    mirrorCX,
    mirrorCY,
    MW * 0.72,
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = vignette;
  ctx.fillRect(MX, MY, MW, MH);
  ctx.restore();

  // ── "REAR" label ──
  ctx.save();
  ctx.font = "bold 9px monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(180,210,255,0.7)";
  ctx.letterSpacing = "2px";
  ctx.fillText("◀ REAR CAM ▶", mirrorCX, MY + MH - 6);
  ctx.restore();

  // ── Outer frame border (drawn last so it sits on top) ──
  ctx.save();
  ctx.strokeStyle = "rgba(160,190,220,0.9)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(MX, MY, MW, MH, RADIUS);
  ctx.stroke();
  // Inner bevel highlight (top-left lighter)
  const bevel = ctx.createLinearGradient(MX, MY, MX + MW, MY + MH);
  bevel.addColorStop(0, "rgba(255,255,255,0.25)");
  bevel.addColorStop(0.4, "rgba(255,255,255,0.05)");
  bevel.addColorStop(1, "rgba(0,0,0,0.2)");
  ctx.strokeStyle = bevel;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  ctx.restore(); // main save
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

  const worldMinX = 256;
  const worldMinY = 256;
  const worldW = 4576;
  const worldH = 3264;
  const scaleX = mw / worldW;
  const scaleY = mh / worldH;

  // Draw track outline on minimap
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const wp = _WP[i % N];
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
  const wp0 = _WP[0];
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
  boostTimer: number,
  lapFlash: number,
) {
  const player = state.cars[0];
  const currentLap = Math.min(player.laps + 1, TOTAL_LAPS);
  const playerPos = state.sortedIdx.findIndex((i) => i === 0) + 1;
  const speedKmh = Math.round(Math.abs(playerSpeedPx) * 45);

  // HUD panel top-left
  const hudX = 10;
  const hudY = 10;
  const hudW = 210;
  const hudH = 96;
  const flashPulse = lapFlash > 0 ? Math.min(1, lapFlash / 30) : 0;

  ctx.fillStyle =
    flashPulse > 0
      ? `rgba(0,${Math.round(30 + flashPulse * 80)},0,0.85)`
      : "rgba(0,0,0,0.78)";
  ctx.beginPath();
  ctx.roundRect(hudX, hudY, hudW, hudH, 10);
  ctx.fill();
  const borderAlpha = flashPulse > 0 ? 0.9 : 0.45;
  ctx.strokeStyle = `rgba(0,255,128,${borderAlpha})`;
  ctx.lineWidth = flashPulse > 0 ? 2.5 : 1.5;
  if (flashPulse > 0) {
    ctx.shadowColor = "#00ff80";
    ctx.shadowBlur = 16 * flashPulse;
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  // LAP label
  ctx.font = "bold 11px monospace";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText("LAP", hudX + 12, hudY + 22);

  // Lap counter — bigger, with flash color
  const lapColor =
    flashPulse > 0
      ? `rgba(255,${Math.round(215 + (255 - 215) * (1 - flashPulse))},0,1)`
      : "#00ff80";
  const lapGlow = flashPulse > 0 ? "#ffd700" : "#00ff80";
  const lapBlur = flashPulse > 0 ? 20 * flashPulse : 8;
  ctx.font = "bold 30px monospace";
  ctx.fillStyle = lapColor;
  ctx.shadowColor = lapGlow;
  ctx.shadowBlur = lapBlur;
  ctx.fillText(`${currentLap} / ${TOTAL_LAPS}`, hudX + 12, hudY + 58);
  ctx.shadowBlur = 0;

  // "LAP COMPLETE!" flash label
  if (lapFlash > 60) {
    const alpha = Math.min(1, (lapFlash - 60) / 20);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = "bold 10px monospace";
    ctx.fillStyle = "#ffd700";
    ctx.shadowColor = "#ffd700";
    ctx.shadowBlur = 8;
    ctx.fillText("LAP COMPLETE!", hudX + 12, hudY + 76);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // POSITION
  ctx.font = "bold 11px monospace";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText("POS", hudX + 130, hudY + 22);
  const posColors = [
    "#ffd700",
    "#c0c0c0",
    "#cd7f32",
    "#ffffff",
    "#ffffff",
    "#ffffff",
  ];
  ctx.font = "bold 30px monospace";
  ctx.fillStyle = posColors[playerPos - 1] || "#ffffff";
  if (playerPos <= 3) {
    ctx.shadowColor = posColors[playerPos - 1];
    ctx.shadowBlur = 10;
  }
  ctx.fillText(`P${playerPos}`, hudX + 130, hudY + 58);
  ctx.shadowBlur = 0;

  // SPEED
  ctx.font = "bold 11px monospace";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText(`${speedKmh} km/h`, hudX + 12, hudY + 88);

  // PLAYER NAME
  ctx.font = "bold 11px monospace";
  ctx.fillStyle = "rgba(0,255,128,0.7)";
  ctx.fillText("TITOO", hudX + 130, hudY + 88);

  // ── OVERTAKE! banner ──
  if (boostTimer > 0) {
    const fadeAlpha = Math.min(1, boostTimer / 20); // fade out in last 20 frames
    ctx.save();
    ctx.globalAlpha = fadeAlpha;
    ctx.textAlign = "center";

    // Glow backdrop
    ctx.shadowColor = "#ffd700";
    ctx.shadowBlur = 30;
    ctx.font = "bold 42px monospace";
    ctx.fillStyle = "#ffd700";
    ctx.fillText("OVERTAKE!", CANVAS_W / 2, 120);

    // Inner bright core
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#fffacd";
    ctx.fillText("OVERTAKE!", CANVAS_W / 2, 120);

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // ── FINAL LAP banner ──
  const isFinalLap = player.laps === TOTAL_LAPS - 1;
  if (isFinalLap) {
    const flashAlpha = 0.6 + 0.4 * Math.sin(Date.now() / 200);
    ctx.save();
    ctx.globalAlpha = flashAlpha;
    ctx.textAlign = "center";
    ctx.shadowColor = "#ff2200";
    ctx.shadowBlur = 28;
    ctx.font = "bold 36px monospace";
    ctx.fillStyle = "#ff4400";
    ctx.fillText("FINAL LAP", CANVAS_W / 2, 170);
    ctx.shadowColor = "#ffd700";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#ffd700";
    ctx.font = "bold 34px monospace";
    ctx.fillText("FINAL LAP", CANVAS_W / 2, 170);
    ctx.shadowBlur = 0;
    ctx.restore();
  }
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

// ── Confetti particle state ──────────────────────────────────────────────────
const _confetti: {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rot: number;
}[] = [];
(function initConfetti() {
  const colors = [
    "#ffd700",
    "#ff6b6b",
    "#00ff80",
    "#4dc3ff",
    "#ff8c00",
    "#c0c0c0",
  ];
  for (let i = 0; i < 80; i++) {
    _confetti.push({
      x: Math.random() * CANVAS_W,
      y: -Math.random() * CANVAS_H,
      vx: (Math.random() - 0.5) * 2.5,
      vy: 1.5 + Math.random() * 2.5,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 4 + Math.random() * 6,
      rot: Math.random() * Math.PI * 2,
    });
  }
})();

// ── Draw podium finish screen ─────────────────────────────────────────────────
function drawFinishScreen(
  ctx: CanvasRenderingContext2D,
  state: RaceState,
  alpha: number,
) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;

  // Dark overlay
  ctx.fillStyle = "rgba(2,4,12,0.88)";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Animate confetti
  for (const p of _confetti) {
    p.x += p.vx;
    p.y += p.vy;
    p.rot += 0.08;
    if (p.y > CANVAS_H + 20) {
      p.y = -20;
      p.x = Math.random() * CANVAS_W;
    }
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    ctx.restore();
  }

  // Title: PODIUM
  ctx.textAlign = "center";
  ctx.font = "bold 36px monospace";
  ctx.fillStyle = "#ffd700";
  ctx.shadowColor = "#ffd700";
  ctx.shadowBlur = 24;
  ctx.fillText("🏆 PODIUM", CANVAS_W / 2, 60);
  ctx.shadowBlur = 0;

  // Animation progress
  const progress = Math.min(1, (120 - state.finishTimer) / 80);
  const ease = 1 - (1 - progress) ** 3; // easeOut cubic

  // Podium data: [pos_in_sortedIdx, label, color, height, xCenter]
  // P1 center, P2 left, P3 right
  const podiumSlots = [
    {
      sortPos: 1,
      label: "P2",
      color: "#c0c0c0",
      height: 90,
      cx: CANVAS_W / 2 - 110,
    },
    {
      sortPos: 0,
      label: "P1",
      color: "#ffd700",
      height: 120,
      cx: CANVAS_W / 2,
    },
    {
      sortPos: 2,
      label: "P3",
      color: "#cd7f32",
      height: 70,
      cx: CANVAS_W / 2 + 110,
    },
  ];

  const baseY = CANVAS_H - 60;
  const platformW = 88;

  for (const slot of podiumSlots) {
    const carIdx = state.sortedIdx[slot.sortPos];
    if (carIdx === undefined) continue;
    const car = state.cars[carIdx];
    const isPlayer = car.isPlayer;

    const platformH = slot.height * ease;
    const platformY = baseY - platformH;

    // Platform glow for player
    if (isPlayer) {
      ctx.shadowColor = "#00ff80";
      ctx.shadowBlur = 20;
    } else {
      ctx.shadowBlur = 0;
    }

    // Platform body
    const grad = ctx.createLinearGradient(
      slot.cx - platformW / 2,
      platformY,
      slot.cx + platformW / 2,
      baseY,
    );
    grad.addColorStop(0, `${slot.color}cc`);
    grad.addColorStop(1, `${slot.color}44`);
    ctx.fillStyle = grad;
    ctx.fillRect(slot.cx - platformW / 2, platformY, platformW, platformH);

    // Platform border
    ctx.strokeStyle = slot.color;
    ctx.lineWidth = isPlayer ? 2.5 : 1.5;
    ctx.strokeRect(slot.cx - platformW / 2, platformY, platformW, platformH);
    ctx.shadowBlur = 0;

    if (ease < 0.3) continue;

    const nameY = platformY - 10;

    // Position label
    ctx.textAlign = "center";
    ctx.font = "bold 22px monospace";
    ctx.fillStyle = slot.color;
    ctx.shadowColor = slot.color;
    ctx.shadowBlur = 12;
    ctx.fillText(slot.label, slot.cx, nameY - 50);
    ctx.shadowBlur = 0;

    // Mini car indicator (colored circle with glow)
    ctx.beginPath();
    ctx.arc(slot.cx, nameY - 28, 12, 0, Math.PI * 2);
    ctx.fillStyle = car.color;
    ctx.shadowColor = car.glowColor;
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Driver name
    ctx.font = isPlayer ? "bold 13px monospace" : "12px monospace";
    ctx.fillStyle = isPlayer ? "#00ff80" : "rgba(255,255,255,0.9)";
    if (isPlayer) {
      ctx.shadowColor = "#00ff80";
      ctx.shadowBlur = 8;
    }
    ctx.fillText(car.name, slot.cx, nameY - 6);
    ctx.shadowBlur = 0;

    // Points inside platform
    const pts = F1_POINTS[slot.sortPos] || 0;
    ctx.font = "bold 11px monospace";
    ctx.fillStyle = slot.color;
    ctx.fillText(`${pts}pts`, slot.cx, platformY + Math.min(22, platformH - 6));
  }

  // Bottom note
  if (ease > 0.7) {
    const playerSortPos = state.sortedIdx.findIndex((i) => i === 0);
    const finalPts = F1_POINTS[playerSortPos] || 0;
    ctx.globalAlpha = alpha * Math.min(1, (ease - 0.7) / 0.3);
    ctx.textAlign = "center";
    ctx.font = "bold 12px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillText(
      `YOUR POINTS: ${finalPts} championship pts`,
      CANVAS_W / 2,
      CANVAS_H - 22,
    );
  }

  ctx.restore();
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
      width="170"
      height="160"
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

// ── Background Music Hook ────────────────────────────────────────────────────
function useBackgroundMusic() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const engineOscRef = useRef<OscillatorNode | null>(null);
  const beatIntervalRef = useRef<number>(0);
  const [isMuted, setIsMuted] = useState(false);
  const isPlayingRef = useRef(false);
  const isMutedRef = useRef(false);

  // Tyre screech nodes
  const screechGainRef = useRef<GainNode | null>(null);
  const screechSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const screechFilterRef = useRef<BiquadFilterNode | null>(null);

  const getCtx = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
      const master = audioCtxRef.current.createGain();
      master.gain.value = 0.18;
      master.connect(audioCtxRef.current.destination);
      masterGainRef.current = master;
    }
    return audioCtxRef.current;
  };

  const playBeat = (ctx: AudioContext, master: GainNode, time: number) => {
    // Kick drum
    const kick = ctx.createOscillator();
    const kickGain = ctx.createGain();
    kick.type = "sine";
    kick.frequency.setValueAtTime(150, time);
    kick.frequency.exponentialRampToValueAtTime(40, time + 0.12);
    kickGain.gain.setValueAtTime(0.9, time);
    kickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
    kick.connect(kickGain);
    kickGain.connect(master);
    kick.start(time);
    kick.stop(time + 0.15);

    // Hi-hat 1
    const hihat1 = ctx.createOscillator();
    const hhGain1 = ctx.createGain();
    const hhFilter1 = ctx.createBiquadFilter();
    hihat1.type = "square";
    hihat1.frequency.value = 8000;
    hhFilter1.type = "highpass";
    hhFilter1.frequency.value = 7000;
    hhGain1.gain.setValueAtTime(0.15, time + 0.125);
    hhGain1.gain.exponentialRampToValueAtTime(0.001, time + 0.175);
    hihat1.connect(hhFilter1);
    hhFilter1.connect(hhGain1);
    hhGain1.connect(master);
    hihat1.start(time + 0.125);
    hihat1.stop(time + 0.18);

    // Hi-hat 2
    const hihat2 = ctx.createOscillator();
    const hhGain2 = ctx.createGain();
    const hhFilter2 = ctx.createBiquadFilter();
    hihat2.type = "square";
    hihat2.frequency.value = 8000;
    hhFilter2.type = "highpass";
    hhFilter2.frequency.value = 7000;
    hhGain2.gain.setValueAtTime(0.12, time + 0.25);
    hhGain2.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
    hihat2.connect(hhFilter2);
    hhFilter2.connect(hhGain2);
    hhGain2.connect(master);
    hihat2.start(time + 0.25);
    hihat2.stop(time + 0.31);

    // Snare
    const snareBuffer = ctx.createBuffer(
      1,
      ctx.sampleRate * 0.1,
      ctx.sampleRate,
    );
    const snareData = snareBuffer.getChannelData(0);
    for (let i = 0; i < snareData.length; i++)
      snareData[i] = Math.random() * 2 - 1;
    const snare = ctx.createBufferSource();
    const snareGain = ctx.createGain();
    const snareFilter = ctx.createBiquadFilter();
    snare.buffer = snareBuffer;
    snareFilter.type = "bandpass";
    snareFilter.frequency.value = 2500;
    snareGain.gain.setValueAtTime(0.4, time + 0.25);
    snareGain.gain.exponentialRampToValueAtTime(0.001, time + 0.35);
    snare.connect(snareFilter);
    snareFilter.connect(snareGain);
    snareGain.connect(master);
    snare.start(time + 0.25);

    // Bass synth note
    const bassNotes = [55, 55, 73.4, 65.4, 55, 55, 61.7, 49];
    const beatIdx = Math.floor(time * 2) % bassNotes.length;
    const bass = ctx.createOscillator();
    const bassGain = ctx.createGain();
    const bassFilter = ctx.createBiquadFilter();
    bass.type = "sawtooth";
    bass.frequency.value = bassNotes[beatIdx];
    bassFilter.type = "lowpass";
    bassFilter.frequency.value = 400;
    bassFilter.Q.value = 2;
    bassGain.gain.setValueAtTime(0.5, time);
    bassGain.gain.exponentialRampToValueAtTime(0.001, time + 0.45);
    bass.connect(bassFilter);
    bassFilter.connect(bassGain);
    bassGain.connect(master);
    bass.start(time);
    bass.stop(time + 0.5);
  };

  const startEngine = (ctx: AudioContext, master: GainNode) => {
    if (engineOscRef.current) return;
    // Engine hum — layered oscillators
    const engine1 = ctx.createOscillator();
    const engine2 = ctx.createOscillator();
    const engineGain = ctx.createGain();
    const engineFilter = ctx.createBiquadFilter();
    engine1.type = "sawtooth";
    engine1.frequency.value = 85;
    engine2.type = "sawtooth";
    engine2.frequency.value = 170;
    engineFilter.type = "lowpass";
    engineFilter.frequency.value = 600;
    engineFilter.Q.value = 3;
    engineGain.gain.value = 0.22;
    engine1.connect(engineFilter);
    engine2.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engine1.start();
    engine2.start();
    engineOscRef.current = engine1;
    // slight detune for richness
    engine2.detune.value = 8;
  };

  const stopEngine = () => {
    if (engineOscRef.current) {
      try {
        engineOscRef.current.stop();
      } catch (_) {}
      engineOscRef.current = null;
    }
  };

  const startMusic = () => {
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;
    const ctx = getCtx();
    if (!masterGainRef.current) return;
    const master = masterGainRef.current;
    if (ctx.state === "suspended") ctx.resume();

    startEngine(ctx, master);

    const BPM = 160;
    const beatDur = 60 / BPM;
    let nextBeat = ctx.currentTime + 0.05;

    const scheduleBeat = () => {
      if (!isPlayingRef.current) return;
      const lookahead = 0.1;
      const scheduleAhead = 0.2;
      while (nextBeat < ctx.currentTime + scheduleAhead) {
        if (!isMutedRef.current) {
          playBeat(ctx, master, nextBeat);
        }
        nextBeat += beatDur;
      }
      beatIntervalRef.current = window.setTimeout(
        scheduleBeat,
        lookahead * 1000,
      );
    };
    scheduleBeat();
  };

  const stopMusic = () => {
    isPlayingRef.current = false;
    clearTimeout(beatIntervalRef.current);
    stopEngine();
  };

  const musicVolumeRef = useRef<number>(0.18);
  const sfxVolumeRef = useRef<number>(1.0);

  const toggleMute = () => {
    const newMuted = !isMutedRef.current;
    isMutedRef.current = newMuted;
    setIsMuted(newMuted);
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = newMuted ? 0 : musicVolumeRef.current;
    }
  };

  const setMusicVolume = (vol: number) => {
    // vol: 0-1
    musicVolumeRef.current = vol * 0.18;
    if (masterGainRef.current && !isMutedRef.current) {
      masterGainRef.current.gain.value = musicVolumeRef.current;
    }
  };

  const setSfxVolume = (vol: number) => {
    // vol: 0-1
    sfxVolumeRef.current = vol;
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: cleanup only runs on unmount
  useEffect(() => {
    return () => {
      stopMusic();
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    };
  }, []);

  const updateTyreScreech = (intensity: number) => {
    // intensity: 0 = silent, 1 = max screech
    if (isMutedRef.current || !audioCtxRef.current) {
      // If muted or no ctx, fade out any existing screech
      if (screechGainRef.current) {
        screechGainRef.current.gain.setTargetAtTime(
          0,
          audioCtxRef.current?.currentTime ?? 0,
          0.1,
        );
      }
      return;
    }
    const ctx = getCtx();
    const master = masterGainRef.current;
    if (!master) return;

    // Lazy-init screech nodes
    if (!screechSourceRef.current) {
      // White noise buffer (1 second, looped)
      const bufferSize = ctx.sampleRate;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer;
      source.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 1800;
      filter.Q.value = 3.5;

      const gain = ctx.createGain();
      gain.gain.value = 0;

      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start();

      screechSourceRef.current = source;
      screechFilterRef.current = filter;
      screechGainRef.current = gain;
    }

    const targetGain = intensity * 0.22 * sfxVolumeRef.current; // subtle under music
    const targetFreq = 1400 + intensity * 1200; // pitch shifts up with speed
    const now = ctx.currentTime;
    screechGainRef.current!.gain.setTargetAtTime(
      targetGain,
      now,
      intensity > 0.05 ? 0.06 : 0.15,
    );
    screechFilterRef.current!.frequency.setTargetAtTime(targetFreq, now, 0.08);
  };

  return {
    startMusic,
    stopMusic,
    toggleMute,
    isMuted,
    updateTyreScreech,
    setMusicVolume,
    setSfxVolume,
  };
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  onStateChange: (state: "idle" | "playing" | "gameover") => void;
  onScoreChange: (score: number, speedLevel: number, lives: number) => void;
  autoStart?: boolean;
  stage?: number;
  leaderboard?: ScoreEntry[];
  personalBest?: ScoreEntry | null;
  lbLoading?: boolean;
}

export default function F1Game({
  onStateChange,
  onScoreChange,
  autoStart,
  stage = 1,
  leaderboard = [],
  personalBest = null,
  lbLoading = false,
}: Props) {
  // Update module-level waypoints based on stage
  _WP = stage === 2 ? WAYPOINTS_STAGE2 : WAYPOINTS;
  N = _WP.length;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<RaceState>(createInitialState());
  const keysRef = useRef<Set<string>>(new Set());
  const steerIntensityRef = useRef<number>(1.0);
  const accelIntensityRef = useRef<number>(1.0);
  const rafRef = useRef<number>(0);
  const goTimerRef = useRef<number>(0); // frames to show GO!
  const finishCountRef = useRef({ val: 0 });
  const lapFlashRef = useRef<number>(0); // frames since last lap completed (for flash animation)
  const prevLapsRef = useRef<number>(0); // previous player lap count to detect increments

  // Background music
  const {
    startMusic,
    stopMusic,
    toggleMute,
    isMuted,
    updateTyreScreech,
    setMusicVolume,
    setSfxVolume,
  } = useBackgroundMusic();

  // Pause state
  const isPausedRef = useRef(false);
  const [isPaused, setIsPaused] = useState(false);

  // Settings state (persisted in localStorage)
  const [showSettings, setShowSettings] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem("f1_game_settings");
      if (saved)
        return JSON.parse(saved) as {
          musicVol: number;
          sfxVol: number;
          showFps: boolean;
        };
    } catch {}
    return { musicVol: 80, sfxVol: 80, showFps: false };
  });

  // Apply settings on mount and on change
  // biome-ignore lint/correctness/useExhaustiveDependencies: setMusicVolume/setSfxVolume are stable
  useEffect(() => {
    setMusicVolume(settings.musicVol / 100);
    setSfxVolume(settings.sfxVol / 100);
    localStorage.setItem("f1_game_settings", JSON.stringify(settings));
  }, [settings]);

  const updateSettings = (
    patch: Partial<{ musicVol: number; sfxVol: number; showFps: boolean }>,
  ) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  // FPS tracking
  const fpsRef = useRef<number>(60);
  const _lastFrameTimeRef = useRef<number>(0);
  const [fpsDisplay, setFpsDisplay] = useState(60);

  // Boost effect refs
  const boostTimerRef = useRef<number>(0);
  const prevSortedIdxRef = useRef<number[]>([0, 1, 2, 3, 4, 5]);
  const hasAutoStartedRef = useRef(false);

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
    startMusic();
  }, [onStateChange, startMusic]);

  useEffect(() => {
    if (autoStart && !hasAutoStartedRef.current) {
      hasAutoStartedRef.current = true;
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
      if (
        (e.key === "Escape" || e.key === "p" || e.key === "P") &&
        stateRef.current.phase === "racing"
      ) {
        const newPaused = !isPausedRef.current;
        isPausedRef.current = newPaused;
        setIsPaused(newPaused);
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
      const DEAD_ZONE = 4; // reduced for snappier response
      const MAX_DRAG = 50; // reduced travel distance for quicker full-intensity

      // ── Horizontal axis: left / right steering ──
      if (deltaX < -DEAD_ZONE) {
        const raw = Math.min(Math.abs(deltaX) - DEAD_ZONE, MAX_DRAG);
        const intensity = Math.min(0.3 + (raw / MAX_DRAG) * 0.7, 1.0); // 0.3 minimum to feel responsive
        steerIntensityRef.current = intensity;
        keysRef.current.add("ArrowLeft");
        keysRef.current.delete("ArrowRight");
        setWheelRotation((prev) => ({
          ...prev,
          z: -Math.round(intensity * 35),
        }));
      } else if (deltaX > DEAD_ZONE) {
        const raw = Math.min(deltaX - DEAD_ZONE, MAX_DRAG);
        const intensity = Math.min(0.3 + (raw / MAX_DRAG) * 0.7, 1.0);
        steerIntensityRef.current = intensity;
        keysRef.current.add("ArrowRight");
        keysRef.current.delete("ArrowLeft");
        setWheelRotation((prev) => ({
          ...prev,
          z: Math.round(intensity * 35),
        }));
      } else {
        steerIntensityRef.current = 1.0;
        keysRef.current.delete("ArrowLeft");
        keysRef.current.delete("ArrowRight");
        setWheelRotation((prev) => ({ ...prev, z: 0 }));
      }

      // ── Vertical axis: up = accelerate, down = brake ──
      if (deltaY < -DEAD_ZONE) {
        const raw = Math.min(Math.abs(deltaY) - DEAD_ZONE, MAX_DRAG);
        const intensity = Math.min(0.4 + (raw / MAX_DRAG) * 0.6, 1.0);
        accelIntensityRef.current = intensity;
        keysRef.current.add("ArrowUp");
        keysRef.current.delete("ArrowDown");
        setWheelRotation((prev) => ({
          ...prev,
          x: -Math.round(intensity * 25),
        }));
      } else if (deltaY > DEAD_ZONE) {
        const raw = Math.min(deltaY - DEAD_ZONE, MAX_DRAG);
        const intensity = Math.min(0.4 + (raw / MAX_DRAG) * 0.6, 1.0);
        accelIntensityRef.current = intensity;
        keysRef.current.add("ArrowDown");
        keysRef.current.delete("ArrowUp");
        setWheelRotation((prev) => ({
          ...prev,
          x: Math.round(intensity * 25),
        }));
      } else {
        accelIntensityRef.current = 1.0;
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
      steerIntensityRef.current = 1.0;
      accelIntensityRef.current = 1.0;
      keysRef.current.delete("ArrowLeft");
      keysRef.current.delete("ArrowRight");
      keysRef.current.delete("ArrowUp");
      keysRef.current.delete("ArrowDown");
    },
    [],
  );

  // Game loop
  const togglePause = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== "racing") return; // only pause during active race
    const newPaused = !isPausedRef.current;
    isPausedRef.current = newPaused;
    setIsPaused(newPaused);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: stopMusic is stable
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const loop = (timestamp: number) => {
      // If paused, skip all updates but keep requesting frames
      if (isPausedRef.current) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
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
          constrainToTrack(s.cars[i], _WP);
        }
        // Update player
        updatePlayer(
          player,
          keysRef.current,
          finishCountRef.current,
          steerIntensityRef.current,
          accelIntensityRef.current,
        );
        constrainToTrack(player, _WP);

        // Tyre screech: triggered by steering/braking at speed
        {
          const spd = Math.abs(player.speed);
          const maxSpd = player.maxSpeed || 6;
          const speedFactor = Math.min(spd / maxSpd, 1);
          const isTurning =
            keysRef.current.has("ArrowLeft") ||
            keysRef.current.has("ArrowRight");
          const isBraking = keysRef.current.has("ArrowDown");
          let screechIntensity = 0;
          if (speedFactor > 0.3) {
            if (isTurning)
              screechIntensity = Math.max(screechIntensity, speedFactor * 0.9);
            if (isBraking)
              screechIntensity = Math.max(screechIntensity, speedFactor * 0.7);
          }
          updateTyreScreech(screechIntensity);
        }

        // Sort positions
        s.sortedIdx = sortPositions(s.cars);
        const playerPos = s.sortedIdx.findIndex((i) => i === 0) + 1;
        const currentLap = Math.min(player.laps + 1, TOTAL_LAPS);
        const ptsForPos = F1_POINTS[playerPos - 1] || 0;
        s.playerPos = playerPos;
        s.currentLap = currentLap;

        // ── Detect lap increment ──
        if (player.laps > prevLapsRef.current) {
          lapFlashRef.current = 90; // flash for 1.5 seconds
          prevLapsRef.current = player.laps;
        }
        if (lapFlashRef.current > 0) lapFlashRef.current--;

        // ── Detect overtake (player position index improved) ──
        const prevPlayerSortedPos = prevSortedIdxRef.current.findIndex(
          (i) => i === 0,
        );
        const currPlayerSortedPos = s.sortedIdx.findIndex((i) => i === 0);
        if (currPlayerSortedPos < prevPlayerSortedPos) {
          // Player moved up in rankings — overtake!
          boostTimerRef.current = 90;
        }
        prevSortedIdxRef.current = [...s.sortedIdx];

        // Decrement boost timer
        if (boostTimerRef.current > 0) {
          boostTimerRef.current = Math.max(0, boostTimerRef.current - 1);
        }

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
          stopMusic();
        }
      }

      // ── DRAW ──
      const camX = player.x - CANVAS_W / 2;
      const camY = player.y - CANVAS_H / 2;

      drawBackground(ctx);
      drawAudience(ctx, camX, camY);
      drawTrack(ctx, camX, camY);
      drawStartLine(ctx, camX, camY);

      // Draw cars (sorted back-to-front by Y for visual layering)
      const drawOrder = [...s.cars].sort((a, b) => a.y - b.y);
      const boostActive = boostTimerRef.current > 0;
      for (const car of drawOrder) {
        drawCar(ctx, car, car.x - camX, car.y - camY, boostActive);
      }

      // HUD (fixed position, reset transforms)
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (s.phase === "racing" || s.phase === "finished") {
        drawHUD(
          ctx,
          s,
          player.speed,
          boostTimerRef.current,
          lapFlashRef.current,
        );
        drawMinimap(ctx, s.cars);
        drawRearView(ctx, s.cars, player);
      }

      if (s.phase === "countdown") {
        drawHUD(ctx, s, 0, 0, 0);
        drawMinimap(ctx, s.cars);
        drawRearView(ctx, s.cars, player);
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

      // Update FPS display every ~30 frames
      if (Math.round(timestamp / 500) !== Math.round((timestamp - 16) / 500)) {
        setFpsDisplay(fpsRef.current);
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [onStateChange, onScoreChange, stopMusic]);

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

      {/* Top-right controls */}
      <div
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          display: "flex",
          gap: 6,
          zIndex: 20,
        }}
      >
        {/* Settings Button */}
        <button
          type="button"
          onClick={() => setShowSettings(true)}
          data-ocid="game.settings_button"
          aria-label="Open settings"
          style={{
            background: "rgba(0,10,5,0.75)",
            border: "1px solid rgba(0,255,128,0.35)",
            borderRadius: "50%",
            width: 36,
            height: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            fontSize: 18,
            backdropFilter: "blur(4px)",
            boxShadow: "0 0 10px rgba(0,255,128,0.15)",
            color: "#fff",
            transition: "border-color 0.2s, box-shadow 0.2s",
          }}
        >
          ⚙️
        </button>

        {/* Mute/Unmute Button */}
        <button
          type="button"
          onClick={toggleMute}
          data-ocid="game.toggle"
          aria-label={isMuted ? "Unmute music" : "Mute music"}
          style={{
            background: "rgba(0,10,5,0.75)",
            border: "1px solid rgba(0,255,128,0.35)",
            borderRadius: "50%",
            width: 36,
            height: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            fontSize: 18,
            backdropFilter: "blur(4px)",
            boxShadow: "0 0 10px rgba(0,255,128,0.15)",
            color: "#fff",
            transition: "border-color 0.2s, box-shadow 0.2s",
          }}
        >
          {isMuted ? "🔇" : "🔊"}
        </button>
      </div>

      {/* Pause Button (only during racing) */}
      {stateRef.current.phase === "racing" && (
        <button
          type="button"
          onTouchStart={(e) => {
            e.preventDefault();
            togglePause();
          }}
          onClick={togglePause}
          data-ocid="game.pause_button"
          aria-label={isPaused ? "Resume game" : "Pause game"}
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            background: "rgba(0,10,5,0.75)",
            border: `1px solid ${isPaused ? "rgba(255,200,0,0.7)" : "rgba(0,255,128,0.35)"}`,
            borderRadius: "50%",
            width: 36,
            height: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            fontSize: 18,
            backdropFilter: "blur(4px)",
            boxShadow: `0 0 10px ${isPaused ? "rgba(255,200,0,0.3)" : "rgba(0,255,128,0.15)"}`,
            color: "#fff",
            zIndex: 20,
            transition: "border-color 0.2s, box-shadow 0.2s",
          }}
        >
          {isPaused ? "▶" : "⏸"}
        </button>
      )}

      {/* FPS Counter */}
      {settings.showFps && (
        <div
          style={{
            position: "absolute",
            bottom: 200,
            right: 8,
            background: "rgba(0,0,0,0.6)",
            color:
              fpsDisplay >= 55
                ? "#00ff80"
                : fpsDisplay >= 30
                  ? "#ffdd00"
                  : "#ff4444",
            fontFamily: "monospace",
            fontSize: 11,
            padding: "2px 6px",
            borderRadius: 4,
            zIndex: 20,
            pointerEvents: "none",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          {fpsDisplay} FPS
        </div>
      )}

      {/* Pause Overlay */}
      {isPaused && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,5,2,0.82)",
            backdropFilter: "blur(3px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 24,
            zIndex: 30,
            borderRadius: 8,
          }}
        >
          {/* PAUSED title */}
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 52,
              fontWeight: 900,
              color: "#ffd700",
              textShadow:
                "0 0 30px rgba(255,215,0,0.8), 0 0 60px rgba(255,215,0,0.4)",
              letterSpacing: 8,
            }}
          >
            ⏸ PAUSED
          </div>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 13,
              color: "rgba(0,255,128,0.5)",
              letterSpacing: 2,
            }}
          >
            ESC / P to resume
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              marginTop: 8,
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", gap: 16 }}>
              <button
                type="button"
                onTouchStart={(e) => {
                  e.preventDefault();
                  togglePause();
                }}
                onClick={togglePause}
                style={{
                  background: "rgba(0,255,128,0.12)",
                  border: "1.5px solid rgba(0,255,128,0.7)",
                  borderRadius: 8,
                  color: "#00ff80",
                  fontFamily: "monospace",
                  fontWeight: 700,
                  fontSize: 16,
                  padding: "10px 32px",
                  cursor: "pointer",
                  letterSpacing: 2,
                  boxShadow: "0 0 20px rgba(0,255,128,0.2)",
                  transition: "background 0.2s, box-shadow 0.2s",
                }}
              >
                ▶ RESUME
              </button>
              <button
                type="button"
                onClick={() => {
                  isPausedRef.current = false;
                  setIsPaused(false);
                  stateRef.current.phase = "idle";
                  stateRef.current = createInitialState();
                  finishCountRef.current = { val: 0 };
                  prevLapsRef.current = 0;
                  lapFlashRef.current = 0;
                  boostTimerRef.current = 0;
                  prevSortedIdxRef.current = [0, 1, 2, 3, 4, 5];
                  stopMusic();
                  onStateChange("idle");
                }}
                style={{
                  background: "rgba(255,60,60,0.1)",
                  border: "1.5px solid rgba(255,60,60,0.5)",
                  borderRadius: 8,
                  color: "#ff6060",
                  fontFamily: "monospace",
                  fontWeight: 700,
                  fontSize: 16,
                  padding: "10px 32px",
                  cursor: "pointer",
                  letterSpacing: 2,
                  transition: "background 0.2s",
                }}
              >
                ✕ QUIT
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowLeaderboard(true)}
              style={{
                background: "rgba(255,215,0,0.08)",
                border: "1.5px solid rgba(255,215,0,0.4)",
                borderRadius: 8,
                color: "#ffd700",
                fontFamily: "monospace",
                fontWeight: 700,
                fontSize: 14,
                padding: "8px 28px",
                cursor: "pointer",
                letterSpacing: 2,
                transition: "background 0.2s",
              }}
            >
              🏆 LEADERBOARD
            </button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div
          data-ocid="settings.dialog"
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,5,2,0.88)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 40,
            borderRadius: 8,
          }}
        >
          <div
            style={{
              background: "rgba(5,18,10,0.95)",
              border: "1.5px solid rgba(0,255,128,0.4)",
              borderRadius: 16,
              padding: "32px 36px",
              minWidth: 320,
              maxWidth: 400,
              boxShadow:
                "0 0 60px rgba(0,255,128,0.12), 0 0 120px rgba(0,0,0,0.8)",
              display: "flex",
              flexDirection: "column",
              gap: 24,
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 22,
                  fontWeight: 900,
                  color: "#00ff80",
                  letterSpacing: 3,
                  textShadow: "0 0 16px rgba(0,255,128,0.5)",
                }}
              >
                ⚙ SETTINGS
              </div>
              <button
                type="button"
                data-ocid="settings.close_button"
                onClick={() => setShowSettings(false)}
                aria-label="Close settings"
                style={{
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: "50%",
                  width: 30,
                  height: 30,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "rgba(255,255,255,0.6)",
                  fontSize: 16,
                  transition: "border-color 0.2s, color 0.2s",
                }}
              >
                ✕
              </button>
            </div>

            {/* Music Volume */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label
                htmlFor="music-vol"
                style={{
                  fontFamily: "monospace",
                  fontSize: 12,
                  color: "rgba(0,255,128,0.8)",
                  letterSpacing: 2,
                  textTransform: "uppercase",
                }}
              >
                🎵 Music Volume — {settings.musicVol}%
              </label>
              <input
                id="music-vol"
                type="range"
                min={0}
                max={100}
                value={settings.musicVol}
                data-ocid="settings.music_volume.input"
                onChange={(e) =>
                  updateSettings({ musicVol: Number(e.target.value) })
                }
                style={{
                  width: "100%",
                  accentColor: "#00ff80",
                  cursor: "pointer",
                }}
              />
            </div>

            {/* SFX Volume */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label
                htmlFor="sfx-vol"
                style={{
                  fontFamily: "monospace",
                  fontSize: 12,
                  color: "rgba(0,255,128,0.8)",
                  letterSpacing: 2,
                  textTransform: "uppercase",
                }}
              >
                🔊 SFX Volume — {settings.sfxVol}%
              </label>
              <input
                id="sfx-vol"
                type="range"
                min={0}
                max={100}
                value={settings.sfxVol}
                data-ocid="settings.sfx_volume.input"
                onChange={(e) =>
                  updateSettings({ sfxVol: Number(e.target.value) })
                }
                style={{
                  width: "100%",
                  accentColor: "#00ff80",
                  cursor: "pointer",
                }}
              />
            </div>

            {/* Show FPS Toggle */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <label
                htmlFor="show-fps"
                style={{
                  fontFamily: "monospace",
                  fontSize: 12,
                  color: "rgba(0,255,128,0.8)",
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                📊 Show FPS Counter
              </label>
              <button
                id="show-fps"
                type="button"
                role="switch"
                aria-checked={settings.showFps}
                data-ocid="settings.fps.toggle"
                onClick={() => updateSettings({ showFps: !settings.showFps })}
                style={{
                  width: 48,
                  height: 26,
                  borderRadius: 13,
                  background: settings.showFps
                    ? "rgba(0,255,128,0.3)"
                    : "rgba(255,255,255,0.08)",
                  border: `1.5px solid ${settings.showFps ? "rgba(0,255,128,0.7)" : "rgba(255,255,255,0.2)"}`,
                  position: "relative",
                  cursor: "pointer",
                  transition: "background 0.2s, border-color 0.2s",
                  padding: 0,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 3,
                    left: settings.showFps ? 24 : 3,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: settings.showFps
                      ? "#00ff80"
                      : "rgba(255,255,255,0.4)",
                    transition: "left 0.2s, background 0.2s",
                    boxShadow: settings.showFps
                      ? "0 0 8px rgba(0,255,128,0.6)"
                      : "none",
                  }}
                />
              </button>
            </div>

            {/* Close button */}
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              style={{
                background: "rgba(0,255,128,0.12)",
                border: "1.5px solid rgba(0,255,128,0.5)",
                borderRadius: 8,
                color: "#00ff80",
                fontFamily: "monospace",
                fontWeight: 700,
                fontSize: 14,
                padding: "10px 0",
                cursor: "pointer",
                letterSpacing: 2,
                marginTop: 4,
                transition: "background 0.2s",
              }}
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

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
              width: 100,
              gap: 2,
              textAlign: "center",
              fontFamily: "monospace",
              fontSize: 13,
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
                padding: 14,
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
              fontSize: 12,
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
              minWidth: 100,
              textAlign: "center",
            }}
          >
            {directionHint}
          </div>
        </div>
      </div>

      {/* Leaderboard Modal */}
      {showLeaderboard && (
        <div
          data-ocid="leaderboard.dialog"
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,5,2,0.92)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            borderRadius: 8,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowLeaderboard(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape" && e.target === e.currentTarget)
              setShowLeaderboard(false);
          }}
          tabIndex={-1}
        >
          <div
            style={{
              background: "rgba(3,12,6,0.97)",
              border: "1.5px solid rgba(0,255,128,0.35)",
              borderRadius: 16,
              padding: "28px 32px",
              minWidth: 340,
              maxWidth: 440,
              maxHeight: "85vh",
              overflowY: "auto",
              boxShadow:
                "0 0 80px rgba(0,255,128,0.08), 0 0 160px rgba(0,0,0,0.9)",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 20,
                  fontWeight: 900,
                  color: "#ffd700",
                  letterSpacing: 3,
                  textShadow: "0 0 20px rgba(255,215,0,0.6)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                🏆 HIGH SCORES
              </div>
              <button
                type="button"
                data-ocid="leaderboard.close_button"
                onClick={() => setShowLeaderboard(false)}
                aria-label="Close leaderboard"
                style={{
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: "50%",
                  width: 30,
                  height: 30,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "rgba(255,255,255,0.6)",
                  fontSize: 16,
                  transition: "border-color 0.2s",
                }}
              >
                ✕
              </button>
            </div>

            {/* Personal Best */}
            {personalBest && (
              <div
                style={{
                  background: "rgba(0,255,128,0.06)",
                  border: "1px solid rgba(0,255,128,0.25)",
                  borderRadius: 8,
                  padding: "8px 14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: 11,
                    color: "rgba(0,255,128,0.6)",
                    letterSpacing: 2,
                  }}
                >
                  ⭐ YOUR BEST
                </span>
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: 13,
                    fontWeight: 900,
                    color: "#00ff80",
                  }}
                >
                  {personalBest.name} —{" "}
                  {String(personalBest.score).padStart(6, "0")} pts
                </span>
              </div>
            )}

            {/* Scores list */}
            {lbLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[1, 2, 3, 4, 5].map((k) => (
                  <div
                    key={k}
                    style={{
                      height: 44,
                      borderRadius: 8,
                      background: "rgba(255,255,255,0.04)",
                      animation: "pulse 1.5s ease-in-out infinite",
                    }}
                  />
                ))}
              </div>
            ) : leaderboard.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🏆</div>
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: 12,
                    color: "rgba(255,255,255,0.3)",
                    letterSpacing: 2,
                  }}
                >
                  NO SCORES YET
                </div>
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: 11,
                    color: "rgba(255,255,255,0.18)",
                    marginTop: 6,
                  }}
                >
                  Be the first to set a record!
                </div>
              </div>
            ) : (
              <ol
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                }}
              >
                {leaderboard.slice(0, 10).map((entry, i) => {
                  const medals = ["🥇", "🥈", "🥉"];
                  const colors = ["#ffd700", "#c0c0c0", "#cd7f32"];
                  const glows = [
                    "rgba(255,215,0,0.3)",
                    "rgba(192,192,192,0.2)",
                    "rgba(205,127,50,0.2)",
                  ];
                  const bgs = [
                    "rgba(255,215,0,0.08)",
                    "rgba(192,192,192,0.06)",
                    "rgba(205,127,50,0.06)",
                  ];
                  const borders = [
                    "rgba(255,215,0,0.35)",
                    "rgba(192,192,192,0.25)",
                    "rgba(205,127,50,0.25)",
                  ];
                  const isTop3 = i < 3;
                  return (
                    <li
                      key={`lb-${entry.name}-${i}`}
                      data-ocid={`leaderboard.item.${i + 1}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 14px",
                        borderRadius: 8,
                        background: isTop3 ? bgs[i] : "rgba(255,255,255,0.02)",
                        border: `1px solid ${isTop3 ? borders[i] : "rgba(255,255,255,0.07)"}`,
                        boxShadow: isTop3 ? `0 0 12px ${glows[i]}` : "none",
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          textAlign: "center",
                          fontSize: isTop3 ? 18 : 12,
                          color: isTop3 ? colors[i] : "rgba(255,255,255,0.3)",
                          fontFamily: "monospace",
                          fontWeight: 700,
                        }}
                      >
                        {isTop3 ? medals[i] : `${i + 1}`}
                      </div>
                      <div
                        style={{
                          flex: 1,
                          fontFamily: "monospace",
                          fontSize: 13,
                          fontWeight: 700,
                          color: isTop3 ? colors[i] : "rgba(255,255,255,0.8)",
                          letterSpacing: 1,
                          textShadow: isTop3 ? `0 0 8px ${glows[i]}` : "none",
                        }}
                      >
                        {entry.name}
                      </div>
                      <div
                        style={{
                          fontFamily: "monospace",
                          fontSize: 14,
                          fontWeight: 900,
                          color: isTop3 ? colors[i] : "rgba(255,255,255,0.6)",
                          letterSpacing: 1,
                        }}
                      >
                        {String(entry.score).padStart(6, "0")}
                        <span
                          style={{ fontSize: 9, marginLeft: 3, opacity: 0.6 }}
                        >
                          pts
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
