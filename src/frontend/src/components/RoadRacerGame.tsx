import { useCallback, useEffect, useRef } from "react";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  type Car,
  type GameData,
  LANE_COUNT,
  LANE_WIDTH,
  ROAD_LEFT_X,
  ROAD_WIDTH,
  useRoadRacer,
} from "../hooks/useRoadRacer";

interface RoadRacerGameProps {
  onStateChange: (state: "idle" | "playing" | "gameover") => void;
  onScoreChange: (score: number, level: number, lives: number) => void;
  autoStart?: boolean;
}

// ── F1 crowd palette: team colors + skin tones ──────────────────────────────
const CROWD_COLORS = [
  "#e8002d", // Ferrari red
  "#ff8000", // McLaren orange
  "#0067ff", // Williams blue
  "#006f62", // Mercedes teal
  "#3671c6", // Red Bull blue
  "#229971", // Aston Martin green
  "#e8002d", // Ferrari red (more weight)
  "#ffffff", // white shirt
  "#f5f0e8", // light skin
  "#c68642", // medium skin
  "#ffcc00", // yellow jersey
  "#9b59b6", // purple tifosi
  "#ff6b35", // orange fan
  "#1abc9c", // teal fan
];

const FLAG_COLORS = [
  ["#e8002d", "#ffffff"], // Italy
  ["#ff8000", "#000000"], // McLaren
  ["#0000cc", "#ffffff"], // Blue flag
  ["#ffdd00", "#000000"], // Germany
  ["#ffffff", "#e8002d"], // Red/White
  ["#00cc44", "#ffffff"], // Green flag
];

/** Simple seeded pseudo-random for deterministic crowd layout */
function seededRand(seed: number): number {
  let s = seed;
  s = (s ^ (s << 13)) & 0xffffffff;
  s = (s ^ (s >> 17)) & 0xffffffff;
  s = (s ^ (s << 5)) & 0xffffffff;
  return (s >>> 0) / 0xffffffff;
}

/**
 * Draws animated F1 crowd/audience in the off-road strips.
 * Left strip: x 0..ROAD_LEFT_X  (~60px)
 * Right strip: x ROAD_LEFT_X+ROAD_WIDTH..CANVAS_WIDTH  (~60px)
 */
function drawCrowd(ctx: CanvasRenderingContext2D, _scrollY: number): void {
  ctx.save();

  const ROW_H = 14; // vertical spacing between crowd rows
  const COL_W = 9; // horizontal spacing between people
  const HEAD_R = 3; // head circle radius
  const BODY_H = 5; // body rectangle height
  const BODY_W = 5; // body rectangle width

  // How many rows to cover the full canvas + 1 extra for seamless scroll
  const totalRows = Math.ceil(CANVAS_HEIGHT / ROW_H) + 2;
  const scrollOffset = 0;

  // grandstand backdrop — slightly lighter dark tone to hint at tiers
  ctx.fillStyle = "#0d1520";
  ctx.fillRect(0, 0, ROAD_LEFT_X, CANVAS_HEIGHT);
  ctx.fillRect(
    ROAD_LEFT_X + ROAD_WIDTH,
    0,
    CANVAS_WIDTH - (ROAD_LEFT_X + ROAD_WIDTH),
    CANVAS_HEIGHT,
  );

  // Subtle horizontal grandstand tier lines
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  for (let t = 0; t < totalRows; t++) {
    const ty = t * ROW_H * 2 - scrollOffset - ROW_H;
    ctx.beginPath();
    ctx.moveTo(0, ty);
    ctx.lineTo(ROAD_LEFT_X, ty);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ROAD_LEFT_X + ROAD_WIDTH, ty);
    ctx.lineTo(CANVAS_WIDTH, ty);
    ctx.stroke();
  }

  // ── Draw spectators ────────────────────────────────────────────────────────
  for (let row = -1; row < totalRows; row++) {
    const rowY = row * ROW_H - scrollOffset;
    // Stagger alternate rows by half column width
    const stagger = row % 2 === 0 ? 0 : COL_W * 0.5;

    // ── Left strip ──────────────────────────────────────────────────────────
    const leftCols = Math.floor(ROAD_LEFT_X / COL_W) + 1;
    for (let col = 0; col < leftCols; col++) {
      const px = col * COL_W + stagger;
      if (px > ROAD_LEFT_X - 2) continue; // don't bleed onto curb

      const seed = row * 97 + col * 31;
      const colorIdx = Math.floor(seededRand(seed) * CROWD_COLORS.length);
      const bodyColor = CROWD_COLORS[colorIdx];
      const skinTone = seededRand(seed + 7) > 0.5 ? "#f5d5b8" : "#c68642";
      const hasFlag = seededRand(seed + 13) > 0.82;

      // Body
      ctx.fillStyle = bodyColor;
      ctx.fillRect(px - BODY_W / 2, rowY, BODY_W, BODY_H);

      // Head
      ctx.fillStyle = skinTone;
      ctx.beginPath();
      ctx.arc(px, rowY - HEAD_R, HEAD_R, 0, Math.PI * 2);
      ctx.fill();

      // Flag (small waving rectangle on a stick)
      if (hasFlag) {
        const flagPair =
          FLAG_COLORS[Math.floor(seededRand(seed + 3) * FLAG_COLORS.length)];
        const flutter = 0;
        const stickX = px + 3;
        const stickTopY = rowY - HEAD_R * 2 - 8;
        // Stick
        ctx.strokeStyle = "rgba(200,200,200,0.6)";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(stickX, rowY - HEAD_R);
        ctx.lineTo(stickX, stickTopY);
        ctx.stroke();
        // Flag top stripe
        ctx.fillStyle = flagPair[0];
        ctx.beginPath();
        ctx.moveTo(stickX, stickTopY);
        ctx.lineTo(stickX + 5 + flutter, stickTopY + 2);
        ctx.lineTo(stickX + 5 + flutter * 0.6, stickTopY + 4);
        ctx.lineTo(stickX, stickTopY + 4);
        ctx.closePath();
        ctx.fill();
        // Flag bottom stripe
        ctx.fillStyle = flagPair[1];
        ctx.beginPath();
        ctx.moveTo(stickX, stickTopY + 4);
        ctx.lineTo(stickX + 5 + flutter * 0.6, stickTopY + 4);
        ctx.lineTo(stickX + 5 + flutter * 0.3, stickTopY + 7);
        ctx.lineTo(stickX, stickTopY + 7);
        ctx.closePath();
        ctx.fill();
      }
    }

    // ── Right strip ─────────────────────────────────────────────────────────
    const rightStart = ROAD_LEFT_X + ROAD_WIDTH;
    const rightWidth = CANVAS_WIDTH - rightStart;
    const rightCols = Math.floor(rightWidth / COL_W) + 1;
    for (let col = 0; col < rightCols; col++) {
      const px = rightStart + col * COL_W + stagger;
      if (px > CANVAS_WIDTH - 2) continue;

      const seed = row * 113 + col * 53 + 500;
      const colorIdx = Math.floor(seededRand(seed) * CROWD_COLORS.length);
      const bodyColor = CROWD_COLORS[colorIdx];
      const skinTone = seededRand(seed + 7) > 0.5 ? "#f5d5b8" : "#c68642";
      const hasFlag = seededRand(seed + 13) > 0.82;

      // Body
      ctx.fillStyle = bodyColor;
      ctx.fillRect(px - BODY_W / 2, rowY, BODY_W, BODY_H);

      // Head
      ctx.fillStyle = skinTone;
      ctx.beginPath();
      ctx.arc(px, rowY - HEAD_R, HEAD_R, 0, Math.PI * 2);
      ctx.fill();

      // Flag
      if (hasFlag) {
        const flagPair =
          FLAG_COLORS[Math.floor(seededRand(seed + 3) * FLAG_COLORS.length)];
        const flutter = 0;
        const stickX = px + 3;
        const stickTopY = rowY - HEAD_R * 2 - 8;
        ctx.strokeStyle = "rgba(200,200,200,0.6)";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(stickX, rowY - HEAD_R);
        ctx.lineTo(stickX, stickTopY);
        ctx.stroke();
        ctx.fillStyle = flagPair[0];
        ctx.beginPath();
        ctx.moveTo(stickX, stickTopY);
        ctx.lineTo(stickX + 5 + flutter, stickTopY + 2);
        ctx.lineTo(stickX + 5 + flutter * 0.6, stickTopY + 4);
        ctx.lineTo(stickX, stickTopY + 4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = flagPair[1];
        ctx.beginPath();
        ctx.moveTo(stickX, stickTopY + 4);
        ctx.lineTo(stickX + 5 + flutter * 0.6, stickTopY + 4);
        ctx.lineTo(stickX + 5 + flutter * 0.3, stickTopY + 7);
        ctx.lineTo(stickX, stickTopY + 7);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  ctx.restore();
}

/**
 * Draws a top-down F1 car facing upward (nose at top, tail at bottom).
 * All cars — player and AI — face the same direction.
 */
function drawF1Car(ctx: CanvasRenderingContext2D, car: Car, alpha = 1): void {
  ctx.save();
  ctx.globalAlpha = alpha;

  const { x, y, width: w, height: h, color, roofColor } = car;
  const isPlayer = color === "#39ff14";

  const cx = x + w / 2;

  // nose at top edge, tail at bottom edge — same for all cars
  const nose = y;
  const tail = y + h;

  // ── proportional measurements ───────────────────────────────────────────────
  const bodyW = w * 0.36;
  const bodyX = x + (w - bodyW) / 2;

  // Sidepod rectangles (longer, with air intake detail)
  const podW = w * 0.19;
  const podH = h * 0.32;
  const podY = nose + h * 0.27;
  const podLeftX = x + w * 0.03;
  const podRightX = x + w - podW - w * 0.03;

  // Front wing
  const fwY = nose + h * 0.03;
  const fwH = h * 0.05;
  const fwW = w * 0.9;
  const fwX = x + (w - fwW) / 2;

  // Rear wing
  const rwY = tail - h * 0.1;
  const rwH = h * 0.07;
  const rwW = w * 0.92;
  const rwX = x + (w - rwW) / 2;

  // Nose cone
  const noseTipY = nose;
  const noseBaseY = nose + h * 0.2;

  // Cockpit oval
  const cpW = bodyW * 0.62;
  const cpH = h * 0.16;
  const cpX = cx;
  const cpY = nose + h * 0.4;

  // Engine cover / airbox bump position
  const airboxY = nose + h * 0.52;
  const airboxH = h * 0.12;
  const airboxW = bodyW * 0.55;

  // Wheels
  const wheelR = w * 0.135;
  const fwWheelY = nose + h * 0.22;
  const rwWheelY = tail - h * 0.22;
  const wheelLX = x + w * 0.04 + wheelR;
  const wheelRX = x + w - w * 0.04 - wheelR;

  // ── PLAYER: multi-layer neon glow ───────────────────────────────────────────
  if (isPlayer) {
    // Outer diffuse glow
    ctx.shadowColor = "#39ff14";
    ctx.shadowBlur = 40;
    ctx.strokeStyle = "#39ff14";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(bodyX - 4, noseBaseY - 4, bodyW + 8, tail - noseBaseY + 4);
    ctx.shadowBlur = 24;
    ctx.strokeRect(bodyX - 2, noseBaseY - 2, bodyW + 4, tail - noseBaseY + 2);
    ctx.shadowBlur = 0;
  }

  // ── side pods ───────────────────────────────────────────────────────────────
  ctx.fillStyle = color;
  if (isPlayer) {
    ctx.shadowColor = "#39ff14";
    ctx.shadowBlur = 12;
  }
  ctx.beginPath();
  ctx.roundRect(podLeftX, podY, podW, podH, 3);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(podRightX, podY, podW, podH, 3);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Air intake detail on sidepods (small dark cut)
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.beginPath();
  ctx.roundRect(
    podLeftX + podW * 0.15,
    podY + podH * 0.2,
    podW * 0.65,
    podH * 0.3,
    2,
  );
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(
    podRightX + podW * 0.2,
    podY + podH * 0.2,
    podW * 0.65,
    podH * 0.3,
    2,
  );
  ctx.fill();

  // Sidepod highlight
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.beginPath();
  ctx.roundRect(podLeftX + 2, podY + 2, podW * 0.5, 3, 1);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(podRightX + podW * 0.5 - 2, podY + 2, podW * 0.5, 3, 1);
  ctx.fill();

  // ── main body (monocoque) ───────────────────────────────────────────────────
  if (isPlayer) {
    ctx.shadowColor = "#39ff14";
    ctx.shadowBlur = 16;
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(bodyX, noseBaseY, bodyW, tail - noseBaseY - h * 0.06, 4);
  ctx.fill();
  ctx.shadowBlur = 0;

  // ── nose cone (longer, more tapered) ────────────────────────────────────────
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, noseTipY);
  ctx.lineTo(cx - bodyW * 0.48, noseBaseY);
  ctx.lineTo(cx + bodyW * 0.48, noseBaseY);
  ctx.closePath();
  ctx.fill();

  // Nose cone center stripe
  const noseStripeColor = isPlayer
    ? "rgba(0,0,0,0.3)"
    : "rgba(255,255,255,0.12)";
  ctx.fillStyle = noseStripeColor;
  ctx.beginPath();
  ctx.moveTo(cx, noseTipY + 2);
  ctx.lineTo(cx - bodyW * 0.1, noseBaseY);
  ctx.lineTo(cx + bodyW * 0.1, noseBaseY);
  ctx.closePath();
  ctx.fill();

  // ── front wing ──────────────────────────────────────────────────────────────
  ctx.fillStyle = roofColor;
  ctx.beginPath();
  ctx.roundRect(fwX, fwY, fwW, fwH, 2);
  ctx.fill();

  // Front wing cascade flaps (thin lines for detail)
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(fwX + fwW * 0.2, fwY);
  ctx.lineTo(fwX + fwW * 0.2, fwY + fwH);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(fwX + fwW * 0.8, fwY);
  ctx.lineTo(fwX + fwW * 0.8, fwY + fwH);
  ctx.stroke();

  // Front wing endplates
  ctx.fillStyle = roofColor;
  ctx.fillRect(fwX, fwY, 3, fwH + 5);
  ctx.fillRect(fwX + fwW - 3, fwY, 3, fwH + 5);

  // ── rear wing ───────────────────────────────────────────────────────────────
  ctx.fillStyle = roofColor;
  ctx.beginPath();
  ctx.roundRect(rwX, rwY, rwW, rwH, 2);
  ctx.fill();

  // Rear wing DRS beam
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.roundRect(rwX + rwW * 0.1, rwY + rwH * 0.5, rwW * 0.8, rwH * 0.22, 1);
  ctx.fill();

  // Rear wing DRS endplates
  ctx.fillStyle = roofColor;
  ctx.fillRect(rwX, rwY - 3, 3, rwH + 6);
  ctx.fillRect(rwX + rwW - 3, rwY - 3, 3, rwH + 6);

  // ── cockpit (open top) ──────────────────────────────────────────────────────
  ctx.fillStyle = roofColor;
  ctx.beginPath();
  ctx.ellipse(cpX, cpY, cpW / 2 + 3, cpH / 2 + 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(5,8,20,0.92)";
  ctx.beginPath();
  ctx.ellipse(cpX, cpY, cpW / 2, cpH / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  // Helmet
  ctx.fillStyle = "rgba(200,220,255,0.55)";
  ctx.beginPath();
  ctx.ellipse(cpX, cpY - cpH * 0.08, cpW * 0.28, cpH * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── HALO device (thin curved bar above cockpit) ──────────────────────────────
  if (isPlayer) {
    ctx.strokeStyle = "rgba(180,255,160,0.7)";
    ctx.lineWidth = 2;
  } else {
    ctx.strokeStyle = "rgba(200,200,220,0.5)";
    ctx.lineWidth = 1.5;
  }
  // HALO: two arms meeting at a center post above the cockpit
  const haloY = cpY - cpH * 0.15;
  const haloArmSpread = cpW * 0.55;
  const haloCenterY = cpY - cpH * 0.55;
  ctx.beginPath();
  ctx.moveTo(cpX - haloArmSpread, haloY);
  ctx.quadraticCurveTo(
    cpX - haloArmSpread * 0.3,
    haloCenterY,
    cpX,
    haloCenterY - 2,
  );
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cpX + haloArmSpread, haloY);
  ctx.quadraticCurveTo(
    cpX + haloArmSpread * 0.3,
    haloCenterY,
    cpX,
    haloCenterY - 2,
  );
  ctx.stroke();
  // HALO center post
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cpX, haloY + cpH * 0.05);
  ctx.lineTo(cpX, haloCenterY - 2);
  ctx.stroke();

  // ── engine cover / airbox bump ───────────────────────────────────────────────
  const airboxGrad = ctx.createLinearGradient(
    cx - airboxW / 2,
    airboxY,
    cx + airboxW / 2,
    airboxY,
  );
  if (isPlayer) {
    airboxGrad.addColorStop(0, "rgba(0,200,0,0.0)");
    airboxGrad.addColorStop(0.5, "rgba(80,255,80,0.25)");
    airboxGrad.addColorStop(1, "rgba(0,200,0,0.0)");
  } else {
    airboxGrad.addColorStop(0, "rgba(255,255,255,0.0)");
    airboxGrad.addColorStop(0.5, "rgba(255,255,255,0.12)");
    airboxGrad.addColorStop(1, "rgba(255,255,255,0.0)");
  }
  ctx.fillStyle = airboxGrad;
  ctx.beginPath();
  ctx.ellipse(
    cx,
    airboxY + airboxH / 2,
    airboxW / 2,
    airboxH / 2,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  // Airbox intake (dark oval at top of engine cover)
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.beginPath();
  ctx.ellipse(cx, airboxY, airboxW * 0.3, airboxH * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── exhaust pipes at rear ────────────────────────────────────────────────────
  const exhaustY = tail - h * 0.1;
  const exhaustR = w * 0.025;
  const exhaustOffsetX = bodyW * 0.28;
  // Left exhaust
  ctx.fillStyle = "#2a2a2a";
  ctx.beginPath();
  ctx.arc(cx - exhaustOffsetX, exhaustY, exhaustR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = isPlayer ? "rgba(255,160,0,0.7)" : "rgba(255,100,0,0.5)";
  ctx.beginPath();
  ctx.arc(cx - exhaustOffsetX, exhaustY, exhaustR * 0.55, 0, Math.PI * 2);
  ctx.fill();
  // Right exhaust
  ctx.fillStyle = "#2a2a2a";
  ctx.beginPath();
  ctx.arc(cx + exhaustOffsetX, exhaustY, exhaustR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = isPlayer ? "rgba(255,160,0,0.7)" : "rgba(255,100,0,0.5)";
  ctx.beginPath();
  ctx.arc(cx + exhaustOffsetX, exhaustY, exhaustR * 0.55, 0, Math.PI * 2);
  ctx.fill();

  // ── racing stripe ───────────────────────────────────────────────────────────
  const stripeColor = isPlayer ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.18)";
  ctx.fillStyle = stripeColor;
  const stripeW = bodyW * 0.18;
  ctx.fillRect(
    cx - stripeW / 2,
    noseBaseY + h * 0.04,
    stripeW,
    tail - noseBaseY - h * 0.16,
  );

  // ── body highlight ──────────────────────────────────────────────────────────
  const grad = ctx.createLinearGradient(bodyX, 0, bodyX + bodyW, 0);
  grad.addColorStop(0, "rgba(0,0,0,0.2)");
  grad.addColorStop(0.3, "rgba(255,255,255,0.14)");
  grad.addColorStop(0.7, "rgba(255,255,255,0.07)");
  grad.addColorStop(1, "rgba(0,0,0,0.2)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(bodyX, noseBaseY, bodyW, tail - noseBaseY - h * 0.06, 4);
  ctx.fill();

  // ── wheels ──────────────────────────────────────────────────────────────────
  const wheelColor = "#1a1830";
  const rimColor = isPlayer ? "#3a5a3a" : "#555570";
  const spokeCount = 5;

  const wheelPositions: [number, number, boolean][] = [
    [wheelLX, fwWheelY, true],
    [wheelRX, fwWheelY, true],
    [wheelLX, rwWheelY, false],
    [wheelRX, rwWheelY, false],
  ];

  for (const [wx, wy, isFront] of wheelPositions) {
    // Tyre shadow
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.arc(wx + 1, wy + 1, wheelR, 0, Math.PI * 2);
    ctx.fill();

    // Tyre
    ctx.fillStyle = wheelColor;
    ctx.beginPath();
    ctx.arc(wx, wy, wheelR, 0, Math.PI * 2);
    ctx.fill();

    // Tyre tread arcs
    ctx.strokeStyle = "rgba(80,80,100,0.7)";
    ctx.lineWidth = 1;
    const treadCount = 6;
    for (let t = 0; t < treadCount; t++) {
      const tAngle = (t / treadCount) * Math.PI * 2;
      const tAngleEnd = tAngle + ((Math.PI * 2) / treadCount) * 0.6;
      ctx.beginPath();
      ctx.arc(wx, wy, wheelR * 0.88, tAngle, tAngleEnd);
      ctx.stroke();
    }

    // Rim
    ctx.fillStyle = rimColor;
    ctx.beginPath();
    ctx.arc(wx, wy, wheelR * 0.56, 0, Math.PI * 2);
    ctx.fill();

    // Spokes (5 spokes as lines from center)
    const spokeColor = isPlayer
      ? "rgba(100,255,100,0.65)"
      : "rgba(180,180,210,0.6)";
    ctx.strokeStyle = spokeColor;
    ctx.lineWidth = isPlayer ? 1.5 : 1.2;
    for (let s = 0; s < spokeCount; s++) {
      const sAngle = (s / spokeCount) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(
        wx + Math.cos(sAngle) * wheelR * 0.12,
        wy + Math.sin(sAngle) * wheelR * 0.12,
      );
      ctx.lineTo(
        wx + Math.cos(sAngle) * wheelR * 0.52,
        wy + Math.sin(sAngle) * wheelR * 0.52,
      );
      ctx.stroke();
    }

    // Center hub
    ctx.fillStyle = isPlayer ? "#39ff14" : "#888899";
    ctx.beginPath();
    ctx.arc(wx, wy, wheelR * 0.14, 0, Math.PI * 2);
    ctx.fill();

    // Rim highlight
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.arc(
      wx - wheelR * 0.15,
      wy - wheelR * 0.15,
      wheelR * 0.22,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    // Brake duct detail on front wheels
    if (isFront) {
      ctx.strokeStyle = isPlayer
        ? "rgba(100,255,100,0.4)"
        : "rgba(200,200,220,0.3)";
      ctx.lineWidth = 1;
      // Small arc on outer face = brake duct scoop
      ctx.beginPath();
      ctx.arc(wx, wy, wheelR * 0.72, -Math.PI * 0.6, Math.PI * 0.6);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(wx, wy, wheelR * 0.82, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.stroke();
    }
  }

  // ── suspension arms ─────────────────────────────────────────────────────────
  const suspColor = isPlayer
    ? "rgba(80,200,80,0.45)"
    : "rgba(160,160,180,0.35)";
  ctx.strokeStyle = suspColor;
  ctx.lineWidth = 1;
  // Front left suspension
  ctx.beginPath();
  ctx.moveTo(bodyX, noseBaseY + h * 0.06);
  ctx.lineTo(wheelLX + wheelR * 0.5, fwWheelY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(bodyX, noseBaseY + h * 0.1);
  ctx.lineTo(wheelLX + wheelR * 0.5, fwWheelY);
  ctx.stroke();
  // Front right suspension
  ctx.beginPath();
  ctx.moveTo(bodyX + bodyW, noseBaseY + h * 0.06);
  ctx.lineTo(wheelRX - wheelR * 0.5, fwWheelY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(bodyX + bodyW, noseBaseY + h * 0.1);
  ctx.lineTo(wheelRX - wheelR * 0.5, fwWheelY);
  ctx.stroke();
  // Rear left suspension
  ctx.beginPath();
  ctx.moveTo(bodyX, tail - h * 0.14);
  ctx.lineTo(wheelLX + wheelR * 0.5, rwWheelY);
  ctx.stroke();
  // Rear right suspension
  ctx.beginPath();
  ctx.moveTo(bodyX + bodyW, tail - h * 0.14);
  ctx.lineTo(wheelRX - wheelR * 0.5, rwWheelY);
  ctx.stroke();

  // ── player neon glow outline (final pass) ────────────────────────────────────
  if (isPlayer) {
    // Inner crisp glow line
    ctx.shadowColor = "#39ff14";
    ctx.shadowBlur = 14;
    ctx.strokeStyle = "#39ff14";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(
      bodyX - 1,
      noseBaseY - 1,
      bodyW + 2,
      tail - noseBaseY - h * 0.06 + 2,
      4,
    );
    ctx.stroke();
    // Nose cone glow
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(cx, noseTipY);
    ctx.lineTo(cx - bodyW * 0.48, noseBaseY);
    ctx.lineTo(cx + bodyW * 0.48, noseBaseY);
    ctx.closePath();
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

function renderFrame(ctx: CanvasRenderingContext2D, gd: GameData): void {
  const { playerCar, obstacles, dashLines, invincible, invincibleTimer } = gd;

  // Background — asphalt night
  ctx.fillStyle = "#0a0d14";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // ── Crowd / audience in the off-road strips ──────────────────────────────
  drawCrowd(ctx, gd.roadScrollY);

  // Side curbs (off-road) — drawn on top of crowd, within curb zone only
  const leftCurbX = ROAD_LEFT_X - 20;
  const rightCurbX = ROAD_LEFT_X + ROAD_WIDTH;

  // Curb stripes (animated)
  const stripeH = 30;
  const stripeCount = Math.ceil(CANVAS_HEIGHT / stripeH) + 2;
  const stripeOffset = gd.roadScrollY % (stripeH * 2);
  for (let i = -1; i < stripeCount; i++) {
    const sy = i * stripeH * 2 + stripeOffset;
    if (i % 2 === 0) {
      ctx.fillStyle = "#e74c3c";
    } else {
      ctx.fillStyle = "#f5f5f5";
    }
    ctx.fillRect(leftCurbX, sy, 18, stripeH);
    ctx.fillRect(rightCurbX + 2, sy, 18, stripeH);
  }

  // Road surface
  ctx.fillStyle = "#1a1f2e";
  ctx.fillRect(ROAD_LEFT_X, 0, ROAD_WIDTH, CANVAS_HEIGHT);

  // Road edge lines
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(ROAD_LEFT_X, 0);
  ctx.lineTo(ROAD_LEFT_X, CANVAS_HEIGHT);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ROAD_LEFT_X + ROAD_WIDTH, 0);
  ctx.lineTo(ROAD_LEFT_X + ROAD_WIDTH, CANVAS_HEIGHT);
  ctx.stroke();

  // Lane dividers (dashed)
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 2;
  ctx.setLineDash([30, 20]);
  for (let lane = 0; lane < LANE_COUNT - 1; lane++) {
    const lx = ROAD_LEFT_X + (lane + 1) * LANE_WIDTH;
    const laneLines = dashLines.filter((d) => d.lane === lane);
    for (const line of laneLines) {
      ctx.beginPath();
      ctx.moveTo(lx, line.y);
      ctx.lineTo(lx, line.y + 30);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);

  // Draw obstacles
  for (const obs of obstacles) {
    drawF1Car(ctx, obs, 1);
  }

  // Draw player car (flicker when invincible)
  const shouldFlicker = invincible && Math.floor(invincibleTimer / 8) % 2 === 0;
  if (!shouldFlicker) {
    drawF1Car(ctx, playerCar, 1);
  } else {
    drawF1Car(ctx, playerCar, 0.4);
  }

  // Vignette overlay
  const vignette = ctx.createRadialGradient(
    CANVAS_WIDTH / 2,
    CANVAS_HEIGHT / 2,
    CANVAS_HEIGHT * 0.2,
    CANVAS_WIDTH / 2,
    CANVAS_HEIGHT / 2,
    CANVAS_HEIGHT * 0.75,
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

export default function RoadRacerGame({
  onStateChange,
  onScoreChange,
  autoStart = false,
}: RoadRacerGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    gameDataRef,
    getGameData,
    startGame,
    moveLeft,
    moveRight,
    handleKeyDown,
    handleKeyUp,
    startLoop,
    stopLoop,
    setOnStateChange,
    setOnScoreChange,
  } = useRoadRacer();

  const leftPressedRef = useRef(false);
  const rightPressedRef = useRef(false);
  const touchRepeatRef = useRef<number>(0);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    renderFrame(ctx, getGameData());
  }, [getGameData]);

  const handleStartOrRestart = useCallback(() => {
    startGame();
    startLoop(render);
  }, [startGame, startLoop, render]);

  // Register callbacks
  useEffect(() => {
    setOnStateChange((state) => {
      onStateChange(state);
      if (state !== "playing") {
        stopLoop();
      }
    });
    setOnScoreChange(onScoreChange);
  }, [
    onStateChange,
    onScoreChange,
    setOnStateChange,
    setOnScoreChange,
    stopLoop,
  ]);

  // Keyboard listeners
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  // Initial render and optional auto-start — intentionally runs once on mount
  // biome-ignore lint/correctness/useExhaustiveDependencies: run once on mount only
  useEffect(() => {
    render();
    if (autoStart) {
      handleStartOrRestart();
    }
  }, []);

  // Touch handlers for left/right buttons
  const startTouchLeft = useCallback(() => {
    leftPressedRef.current = true;
    moveLeft();
    touchRepeatRef.current = window.setInterval(() => {
      if (leftPressedRef.current) moveLeft();
    }, 150);
  }, [moveLeft]);

  const stopTouchLeft = useCallback(() => {
    leftPressedRef.current = false;
    clearInterval(touchRepeatRef.current);
  }, []);

  const startTouchRight = useCallback(() => {
    rightPressedRef.current = true;
    moveRight();
    touchRepeatRef.current = window.setInterval(() => {
      if (rightPressedRef.current) moveRight();
    }, 150);
  }, [moveRight]);

  const stopTouchRight = useCallback(() => {
    rightPressedRef.current = false;
    clearInterval(touchRepeatRef.current);
  }, []);

  return (
    <div className="flex flex-col items-center gap-0">
      <canvas
        ref={canvasRef}
        data-ocid="game.canvas_target"
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        tabIndex={0}
        className="block focus:outline-none"
        style={{
          maxWidth: "100%",
          maxHeight: "calc(100dvh - 160px)",
          imageRendering: "pixelated",
        }}
        onClick={() => {
          const gd = gameDataRef.current;
          if (gd.state !== "playing") {
            handleStartOrRestart();
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            const gd = gameDataRef.current;
            if (gd.state !== "playing") handleStartOrRestart();
          }
        }}
      />

      {/* Touch controls */}
      <div className="flex gap-4 mt-3 w-full max-w-[360px] px-4">
        <button
          type="button"
          data-ocid="game.left_button"
          className="touch-btn flex-1 h-16 text-4xl font-bold"
          onPointerDown={(e) => {
            e.preventDefault();
            startTouchLeft();
          }}
          onPointerUp={stopTouchLeft}
          onPointerLeave={stopTouchLeft}
          onPointerCancel={stopTouchLeft}
          aria-label="Move left"
        >
          ←
        </button>
        <button
          type="button"
          data-ocid="game.right_button"
          className="touch-btn flex-1 h-16 text-4xl font-bold"
          onPointerDown={(e) => {
            e.preventDefault();
            startTouchRight();
          }}
          onPointerUp={stopTouchRight}
          onPointerLeave={stopTouchRight}
          onPointerCancel={stopTouchRight}
          aria-label="Move right"
        >
          →
        </button>
      </div>
    </div>
  );
}

export { CANVAS_WIDTH, CANVAS_HEIGHT };
