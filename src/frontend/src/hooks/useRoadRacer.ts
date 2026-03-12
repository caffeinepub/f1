import { useCallback, useRef } from "react";

export type GameState = "idle" | "playing" | "gameover";

export interface Car {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  roofColor: string;
  lane: number;
  speed?: number;
}

export interface DashLine {
  y: number;
  lane: number;
}

export interface GameData {
  state: GameState;
  score: number;
  lives: number;
  speedLevel: number;
  playerCar: Car;
  obstacles: Car[];
  dashLines: DashLine[];
  roadScrollY: number;
  invincible: boolean;
  invincibleTimer: number;
  spawnTimer: number;
  scoreFloat: number;
}

export const CANVAS_WIDTH = 360;
export const CANVAS_HEIGHT = 600;
export const LANE_COUNT = 3;
const CAR_WIDTH = 50;
const CAR_HEIGHT = 90;
const OBSTACLE_WIDTH = 48;
const OBSTACLE_HEIGHT = 84;
const PLAYER_Y_OFFSET = 100; // from bottom
const BASE_SPEED = 4;
const SPEED_INCREMENT = 1.2; // noticeable speed boost per km
const SPEED_UP_INTERVAL = 10; // every 100 metres
const SPAWN_BASE_INTERVAL = 90; // frames
const INVINCIBILITY_FRAMES = 120;
const DASH_LINE_COUNT = 8;

// F1-inspired livery colors: body + wing/cockpit surround accent
const OBSTACLE_COLORS = [
  { body: "#e8002d", roof: "#a00020" }, // Ferrari red
  { body: "#0067ff", roof: "#003faa" }, // Williams/Alpine blue
  { body: "#ff8700", roof: "#b85e00" }, // McLaren papaya
  { body: "#ffffff", roof: "#aaaaaa" }, // Haas white
  { body: "#006f62", roof: "#004a42" }, // Aston Martin green
  { body: "#1e1e1e", roof: "#444444" }, // AlphaTauri dark
];

export const ROAD_LEFT_X = 40;
export const ROAD_WIDTH = CANVAS_WIDTH - 80;
export const LANE_WIDTH = ROAD_WIDTH / LANE_COUNT;

function getLaneX(lane: number): number {
  return ROAD_LEFT_X + lane * LANE_WIDTH + LANE_WIDTH / 2 - CAR_WIDTH / 2;
}

function getObstacleLaneX(lane: number): number {
  return ROAD_LEFT_X + lane * LANE_WIDTH + LANE_WIDTH / 2 - OBSTACLE_WIDTH / 2;
}

function makeInitialGameData(): GameData {
  const initDashLines: DashLine[] = [];
  for (let lane = 0; lane < LANE_COUNT - 1; lane++) {
    for (let i = 0; i < DASH_LINE_COUNT; i++) {
      initDashLines.push({
        lane,
        y: i * (CANVAS_HEIGHT / DASH_LINE_COUNT),
      });
    }
  }

  return {
    state: "idle",
    score: 0,
    lives: 3,
    speedLevel: 1,
    playerCar: {
      x: getLaneX(1),
      y: CANVAS_HEIGHT - PLAYER_Y_OFFSET - CAR_HEIGHT,
      width: CAR_WIDTH,
      height: CAR_HEIGHT,
      color: "#39ff14",
      roofColor: "#00cc00",
      lane: 1,
    },
    obstacles: [],
    dashLines: initDashLines,
    roadScrollY: 0,
    invincible: false,
    invincibleTimer: 0,
    spawnTimer: 0,
    scoreFloat: 0,
  };
}

export function useRoadRacer() {
  const gameDataRef = useRef<GameData>(makeInitialGameData());
  const stateRef = useRef<GameState>("idle");
  const keysRef = useRef<Set<string>>(new Set());
  const onStateChangeRef = useRef<((state: GameState) => void) | null>(null);
  const onScoreChangeRef = useRef<
    ((score: number, level: number, lives: number) => void) | null
  >(null);
  const rafRef = useRef<number>(0);

  const getGameData = useCallback(() => gameDataRef.current, []);

  const setOnStateChange = useCallback((cb: (state: GameState) => void) => {
    onStateChangeRef.current = cb;
  }, []);

  const setOnScoreChange = useCallback(
    (cb: (score: number, level: number, lives: number) => void) => {
      onScoreChangeRef.current = cb;
    },
    [],
  );

  const startGame = useCallback(() => {
    const gd = makeInitialGameData();
    gd.state = "playing";
    gameDataRef.current = gd;
    stateRef.current = "playing";
    onStateChangeRef.current?.("playing");
  }, []);

  const moveLeft = useCallback(() => {
    const gd = gameDataRef.current;
    if (gd.state !== "playing") return;
    if (gd.playerCar.lane > 0) {
      gd.playerCar.lane -= 1;
      gd.playerCar.x = getLaneX(gd.playerCar.lane);
    }
  }, []);

  const moveRight = useCallback(() => {
    const gd = gameDataRef.current;
    if (gd.state !== "playing") return;
    if (gd.playerCar.lane < LANE_COUNT - 1) {
      gd.playerCar.lane += 1;
      gd.playerCar.x = getLaneX(gd.playerCar.lane);
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.repeat) return;
      const key = e.key;
      if (!keysRef.current.has(key)) {
        keysRef.current.add(key);
        if (key === "ArrowLeft" || key === "a" || key === "A") {
          moveLeft();
          e.preventDefault();
        } else if (key === "ArrowRight" || key === "d" || key === "D") {
          moveRight();
          e.preventDefault();
        } else if (
          (key === " " || key === "Enter") &&
          stateRef.current !== "playing"
        ) {
          startGame();
          e.preventDefault();
        }
      }
    },
    [moveLeft, moveRight, startGame],
  );

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    keysRef.current.delete(e.key);
  }, []);

  const spawnObstacle = useCallback(() => {
    const gd = gameDataRef.current;
    // Pick random lane, avoid lane where player is if spawning many obstacles
    const lane = Math.floor(Math.random() * LANE_COUNT);
    const colorPick =
      OBSTACLE_COLORS[Math.floor(Math.random() * OBSTACLE_COLORS.length)];
    const speed =
      BASE_SPEED + (gd.speedLevel - 1) * SPEED_INCREMENT + Math.random() * 0.5;

    gd.obstacles.push({
      x: getObstacleLaneX(lane),
      y: -OBSTACLE_HEIGHT - 10,
      width: OBSTACLE_WIDTH,
      height: OBSTACLE_HEIGHT,
      color: colorPick.body,
      roofColor: colorPick.roof,
      lane,
      speed,
    });
  }, []);

  const checkCollision = useCallback((a: Car, b: Car): boolean => {
    const margin = 8; // forgiveness margin
    return (
      a.x + margin < b.x + b.width - margin &&
      a.x + a.width - margin > b.x + margin &&
      a.y + margin < b.y + b.height - margin &&
      a.y + a.height - margin > b.y + margin
    );
  }, []);

  const tick = useCallback(() => {
    const gd = gameDataRef.current;
    if (gd.state !== "playing") return;

    const currentSpeed = BASE_SPEED + (gd.speedLevel - 1) * SPEED_INCREMENT;

    // Update road scroll
    gd.roadScrollY =
      (gd.roadScrollY + currentSpeed) % (CANVAS_HEIGHT / DASH_LINE_COUNT);

    // Update dash lines
    for (const line of gd.dashLines) {
      line.y += currentSpeed;
      if (line.y > CANVAS_HEIGHT) {
        line.y -= CANVAS_HEIGHT;
      }
    }

    // Score increment
    gd.scoreFloat += currentSpeed * 0.05;
    const newScore = Math.floor(gd.scoreFloat / 10);
    if (newScore !== gd.score) {
      gd.score = newScore;
      // Speed level up every kilometre
      const newLevel = Math.floor(gd.score / SPEED_UP_INTERVAL) + 1;
      if (newLevel !== gd.speedLevel) {
        gd.speedLevel = newLevel;
      }
      onScoreChangeRef.current?.(gd.score, gd.speedLevel, gd.lives);
    }

    // Invincibility countdown
    if (gd.invincible) {
      gd.invincibleTimer--;
      if (gd.invincibleTimer <= 0) {
        gd.invincible = false;
      }
    }

    // Spawn obstacles
    gd.spawnTimer++;
    const spawnInterval = Math.max(
      30,
      SPAWN_BASE_INTERVAL - (gd.speedLevel - 1) * 8,
    );
    if (gd.spawnTimer >= spawnInterval) {
      gd.spawnTimer = 0;
      spawnObstacle();
      // Occasionally spawn 2 cars
      if (gd.speedLevel > 2 && Math.random() < 0.3) {
        spawnObstacle();
      }
    }

    // Update obstacles
    const obstacleSpeed = currentSpeed * 1.3;
    gd.obstacles = gd.obstacles.filter((obs) => {
      obs.y += obstacleSpeed;
      // Collision check
      if (!gd.invincible && checkCollision(gd.playerCar, obs)) {
        gd.lives--;
        gd.invincible = true;
        gd.invincibleTimer = INVINCIBILITY_FRAMES;
        onScoreChangeRef.current?.(gd.score, gd.speedLevel, gd.lives);
        if (gd.lives <= 0) {
          gd.state = "gameover";
          stateRef.current = "gameover";
          onStateChangeRef.current?.("gameover");
        }
        return false; // remove this obstacle on hit
      }
      return obs.y < CANVAS_HEIGHT + OBSTACLE_HEIGHT + 10;
    });
  }, [spawnObstacle, checkCollision]);

  const stopLoop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  const startLoop = useCallback(
    (renderFn: () => void) => {
      stopLoop();

      const loop = () => {
        tick();
        renderFn();
        if (stateRef.current === "playing") {
          rafRef.current = requestAnimationFrame(loop);
        }
      };

      rafRef.current = requestAnimationFrame(loop);
    },
    [tick, stopLoop],
  );

  return {
    gameDataRef,
    stateRef,
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
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    ROAD_LEFT_X,
    ROAD_WIDTH,
    LANE_WIDTH,
    LANE_COUNT,
  };
}
