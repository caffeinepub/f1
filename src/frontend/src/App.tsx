import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock,
  Crown,
  Flag,
  Hash,
  Loader2,
  LogIn,
  LogOut,
  Medal,
  Plus,
  RotateCcw,
  Send,
  Share2,
  Star,
  Trophy,
  Users,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ScoreEntry } from "./backend.d";
import type { RoomState } from "./backend.d";
import F1Game from "./components/RoadRacerGame";
import { useActor } from "./hooks/useActor";
import { useInternetIdentity } from "./hooks/useInternetIdentity";

type ScreenState =
  | "start"
  | "playing"
  | "gameover"
  | "multiLobby"
  | "multiCreate"
  | "multiJoin"
  | "multiWaiting"
  | "multiResults";

const RANK_CONFIG = [
  {
    icon: Crown,
    label: "1ST",
    color: "var(--gold)",
    glow: "oklch(0.82 0.18 75 / 0.35)",
    border: "oklch(0.82 0.18 75 / 0.6)",
    bg: "oklch(0.14 0.03 75 / 0.4)",
    textClass: "rank-gold",
  },
  {
    icon: Medal,
    label: "2ND",
    color: "var(--silver)",
    glow: "oklch(0.72 0.02 260 / 0.35)",
    border: "oklch(0.72 0.02 260 / 0.6)",
    bg: "oklch(0.14 0.005 260 / 0.4)",
    textClass: "rank-silver",
  },
  {
    icon: Medal,
    label: "3RD",
    color: "var(--bronze)",
    glow: "oklch(0.65 0.12 55 / 0.35)",
    border: "oklch(0.65 0.12 55 / 0.6)",
    bg: "oklch(0.13 0.025 55 / 0.4)",
    textClass: "rank-bronze",
  },
];

function Leaderboard({
  scores,
  personalBest,
  isLoading,
}: {
  scores: ScoreEntry[];
  personalBest: ScoreEntry | null;
  isLoading: boolean;
}) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-center gap-2 mb-4">
        <Trophy className="w-4 h-4 text-neon-green" />
        <span
          className="text-sm font-black tracking-[0.3em] uppercase glow-green"
          style={{ color: "var(--neon-green)" }}
        >
          High Scores
        </span>
        <Trophy className="w-4 h-4 text-neon-green" />
      </div>

      {personalBest && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-4 px-3 py-2 rounded-lg flex justify-between items-center"
          style={{
            background: "oklch(0.82 0.22 138 / 0.08)",
            border: "1px solid oklch(0.82 0.22 138 / 0.3)",
          }}
        >
          <div className="flex items-center gap-2">
            <Star className="w-3.5 h-3.5 text-neon-green" />
            <span className="text-xs text-muted-foreground uppercase tracking-widest">
              Your Best
            </span>
          </div>
          <span
            className="text-sm font-black font-mono"
            style={{ color: "var(--neon-green)" }}
          >
            {personalBest.name} —{" "}
            {personalBest.score.toString().padStart(6, "0")} pts
          </span>
        </motion.div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((k) => (
            <Skeleton
              key={k}
              className="h-10 w-full rounded-lg"
              style={{ background: "oklch(0.16 0.015 260 / 0.6)" }}
            />
          ))}
        </div>
      ) : scores.length === 0 ? (
        <div data-ocid="leaderboard.empty_state" className="py-8 text-center">
          <Trophy
            className="w-8 h-8 mx-auto mb-2"
            style={{ color: "oklch(0.35 0.04 260)" }}
          />
          <p className="text-muted-foreground text-sm">No scores yet</p>
          <p className="text-muted-foreground/50 text-xs mt-1">
            Be the first to set a record!
          </p>
        </div>
      ) : (
        <ol data-ocid="leaderboard.table" className="space-y-1.5">
          {scores.slice(0, 10).map((entry, i) => {
            const isTop3 = i < 3;
            const cfg = isTop3 ? RANK_CONFIG[i] : null;
            const ocidIndex = i + 1;
            const RankIcon = cfg?.icon;

            return (
              <motion.li
                key={`lb-${entry.name}-${i}`}
                data-ocid={`leaderboard.item.${ocidIndex}`}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                className="relative flex items-center gap-3 px-3 py-2.5 rounded-lg"
                style={
                  isTop3
                    ? {
                        background: cfg!.bg,
                        border: `1px solid ${cfg!.border}`,
                        boxShadow: `0 0 12px ${cfg!.glow}, inset 0 0 8px ${cfg!.glow}`,
                      }
                    : {
                        background: "oklch(0.12 0.008 260 / 0.5)",
                        border: "1px solid oklch(0.22 0.02 260 / 0.5)",
                      }
                }
              >
                <div className="w-8 flex-shrink-0 flex items-center justify-center">
                  {isTop3 && RankIcon ? (
                    <RankIcon
                      className="w-5 h-5"
                      style={{ color: cfg!.color }}
                    />
                  ) : (
                    <span
                      className="text-xs font-bold tabular-nums"
                      style={{ color: "oklch(0.45 0.03 260)" }}
                    >
                      {i + 1}
                    </span>
                  )}
                </div>

                {isTop3 && (
                  <span
                    className="text-[10px] font-black tracking-widest w-6 flex-shrink-0"
                    style={{ color: cfg!.color }}
                  >
                    {cfg!.label}
                  </span>
                )}

                <span
                  className={`flex-1 text-sm font-semibold truncate ${
                    isTop3 ? cfg!.textClass : "text-foreground/70"
                  }`}
                >
                  {entry.name}
                </span>

                <span
                  className="text-sm font-black font-mono tabular-nums flex-shrink-0"
                  style={{
                    color: isTop3 ? cfg!.color : "var(--neon-green-dim)",
                    textShadow: isTop3 ? `0 0 8px ${cfg!.color}` : undefined,
                  }}
                >
                  {entry.score.toString().padStart(6, "0")}
                </span>

                {isTop3 && (
                  <div
                    className="absolute right-2 top-1 w-1 h-1 rounded-full"
                    style={{ background: cfg!.color, opacity: 0.6 }}
                  />
                )}
              </motion.li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

// Racing HUD — shown above the canvas while playing
function RaceHUD({
  score,
  speedLevel,
  lives,
  stage = 1,
  roomCode,
}: {
  score: number;
  speedLevel: number;
  lives: number;
  stage?: number;
  roomCode?: string;
}) {
  const posColors = [
    "#ffd700",
    "#c0c0c0",
    "#cd7f32",
    "#ffffff",
    "#ffffff",
    "#ffffff",
  ];
  const posColor = posColors[lives - 1] || "#ffffff";
  return (
    <div
      className="w-full max-w-[480px] flex items-center justify-between px-4 py-2 rounded-t-lg"
      style={{
        background: "oklch(0.08 0.01 260 / 0.95)",
        borderBottom: "1px solid oklch(0.82 0.22 138 / 0.25)",
      }}
    >
      <div className="flex items-center gap-1.5">
        <Flag className="w-3.5 h-3.5" style={{ color: "var(--neon-green)" }} />
        <span
          className="text-xs font-bold font-mono tracking-wider"
          style={{ color: "var(--neon-green)" }}
        >
          LAP {speedLevel}/{3}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <ChevronRight
          className="w-3.5 h-3.5"
          style={{ color: "var(--neon-green)" }}
        />
        <span
          className="text-xs font-bold font-mono tracking-wider"
          style={{ color: "var(--neon-green)" }}
        >
          {score.toString().padStart(4, "0")} PTS
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className="text-sm font-black font-mono"
          style={{ color: posColor }}
        >
          P{lives}
        </span>
      </div>
      {roomCode && (
        <div
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black tracking-widest"
          style={{
            background: "oklch(0.35 0.18 260 / 0.3)",
            border: "1px solid oklch(0.55 0.22 260 / 0.6)",
            color: "oklch(0.75 0.18 260)",
          }}
        >
          <Users className="w-2.5 h-2.5" />
          {roomCode}
        </div>
      )}
      <div
        className="px-2 py-0.5 rounded text-[10px] font-black tracking-widest"
        style={{
          background:
            stage === 2
              ? "oklch(0.65 0.18 55 / 0.3)"
              : "oklch(0.82 0.22 138 / 0.15)",
          border: `1px solid ${
            stage === 2
              ? "oklch(0.65 0.18 55 / 0.6)"
              : "oklch(0.82 0.22 138 / 0.4)"
          }`,
          color: stage === 2 ? "oklch(0.82 0.18 55)" : "var(--neon-green)",
        }}
      >
        S{stage}
      </div>
    </div>
  );
}

// ── Multiplayer Screens ───────────────────────────────────────────────────────

const multiPanelStyle = {
  background: "oklch(0.09 0.015 260 / 0.97)",
  border: "1px solid oklch(0.82 0.22 138 / 0.25)",
  backdropFilter: "blur(16px)",
};

function MultiLobby({
  onBack,
  onCreate,
  onJoin,
}: {
  onBack: () => void;
  onCreate: () => void;
  onJoin: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full flex flex-col gap-4"
    >
      <div className="text-center">
        <div
          className="inline-flex items-center gap-2 mb-2 px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase"
          style={{
            background: "oklch(0.35 0.18 260 / 0.2)",
            border: "1px solid oklch(0.55 0.22 260 / 0.4)",
            color: "oklch(0.75 0.18 260)",
          }}
        >
          <Users className="w-3 h-3" />
          Multiplayer
        </div>
        <h2
          className="text-2xl font-black tracking-tight"
          style={{ color: "var(--neon-green)" }}
        >
          Challenge Room
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Race against friends in real-time
        </p>
      </div>

      <button
        data-ocid="multi.create_button"
        type="button"
        onClick={onCreate}
        className="w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
        style={{
          background: "oklch(0.82 0.22 138 / 0.08)",
          border: "1px solid oklch(0.82 0.22 138 / 0.3)",
        }}
      >
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "oklch(0.82 0.22 138 / 0.15)" }}
        >
          <Plus className="w-6 h-6" style={{ color: "var(--neon-green)" }} />
        </div>
        <div>
          <p
            className="font-black text-base tracking-wide"
            style={{ color: "var(--neon-green)" }}
          >
            CREATE ROOM
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Get a code and invite friends
          </p>
        </div>
        <ChevronRight
          className="ml-auto w-5 h-5"
          style={{ color: "oklch(0.45 0.1 138)" }}
        />
      </button>

      <button
        data-ocid="multi.join_button"
        type="button"
        onClick={onJoin}
        className="w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
        style={{
          background: "oklch(0.35 0.18 260 / 0.08)",
          border: "1px solid oklch(0.55 0.22 260 / 0.3)",
        }}
      >
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "oklch(0.35 0.18 260 / 0.15)" }}
        >
          <Hash className="w-6 h-6" style={{ color: "oklch(0.75 0.18 260)" }} />
        </div>
        <div>
          <p
            className="font-black text-base tracking-wide"
            style={{ color: "oklch(0.75 0.18 260)" }}
          >
            JOIN ROOM
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Enter a room code to join
          </p>
        </div>
        <ChevronRight
          className="ml-auto w-5 h-5"
          style={{ color: "oklch(0.45 0.1 260)" }}
        />
      </button>

      <Button
        data-ocid="multi.back_button"
        variant="ghost"
        onClick={onBack}
        className="w-full text-muted-foreground"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Menu
      </Button>
    </motion.div>
  );
}

function MultiCreate({
  actor,
  isFetching,
  onBack,
  onStart,
}: {
  actor: any;
  isFetching: boolean;
  onBack: () => void;
  onStart: (roomCode: string) => void;
}) {
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!actor || isFetching || creating || roomCode) return;
    setCreating(true);
    actor
      .createRoom()
      .then((code: string) => {
        setRoomCode(code);
        setCreating(false);
      })
      .catch(() => {
        setCreating(false);
        toast.error("Failed to create room");
        onBack();
      });
  }, [actor, isFetching, creating, roomCode, onBack]);

  useEffect(() => {
    if (!roomCode || !actor) return;
    const poll = () => {
      actor
        .getRoomState(roomCode)
        .then((state: RoomState) => setRoomState(state))
        .catch(() => {});
    };
    poll();
    pollRef.current = setInterval(poll, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [roomCode, actor]);

  const handleCopy = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const players = roomState?.players ?? [];
  const canStart = players.length >= 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full flex flex-col gap-4"
    >
      <div className="text-center">
        <h2
          className="text-xl font-black tracking-tight"
          style={{ color: "var(--neon-green)" }}
        >
          YOUR ROOM
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Share this code with friends
        </p>
      </div>

      {creating || !roomCode ? (
        <div
          className="flex flex-col items-center justify-center gap-3 py-8 rounded-xl"
          style={multiPanelStyle}
        >
          <Loader2
            className="w-8 h-8 animate-spin"
            style={{ color: "var(--neon-green)" }}
          />
          <p className="text-sm text-muted-foreground">Creating room...</p>
        </div>
      ) : (
        <>
          {/* Room code display */}
          <div className="rounded-xl p-5 text-center" style={multiPanelStyle}>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">
              Room Code
            </p>
            <p
              className="text-5xl font-black tracking-[0.2em] font-mono glow-green"
              style={{ color: "var(--neon-green)" }}
            >
              {roomCode}
            </p>
            <button
              data-ocid="multi.create.share_button"
              type="button"
              onClick={handleCopy}
              className="mt-3 flex items-center gap-1.5 mx-auto px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-80"
              style={{
                background: "oklch(0.82 0.22 138 / 0.12)",
                border: "1px solid oklch(0.82 0.22 138 / 0.3)",
                color: "var(--neon-green)",
              }}
            >
              {copied ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Copied!
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" /> Copy Code
                </>
              )}
            </button>
          </div>

          {/* Player list */}
          <div className="rounded-xl p-4" style={multiPanelStyle}>
            <div className="flex items-center gap-2 mb-3">
              <Users
                className="w-4 h-4"
                style={{ color: "oklch(0.6 0.12 260)" }}
              />
              <span className="text-xs font-bold tracking-widest uppercase text-muted-foreground">
                Players Waiting ({players.length})
              </span>
            </div>
            {players.length === 0 ? (
              <div
                data-ocid="multi.create.empty_state"
                className="flex items-center gap-2 text-xs text-muted-foreground/60 py-2"
              >
                <Clock className="w-3.5 h-3.5 animate-pulse" />
                Waiting for players to join...
              </div>
            ) : (
              <ul className="space-y-2">
                {players.map((p, i) => (
                  <li
                    key={p.id?.toString() ?? i}
                    data-ocid={`multi.create.item.${i + 1}`}
                    className="flex items-center gap-2 text-sm"
                  >
                    <CheckCircle2
                      className="w-4 h-4"
                      style={{ color: "var(--neon-green)" }}
                    />
                    <span className="font-semibold text-foreground">
                      {p.name}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Button
            data-ocid="multi.create.start_button"
            onClick={() => onStart(roomCode)}
            disabled={!canStart}
            className="w-full h-12 font-black tracking-widest neon-btn"
            style={{
              background: canStart
                ? "oklch(0.82 0.22 138)"
                : "oklch(0.25 0.04 260)",
              color: canStart
                ? "oklch(0.08 0.005 260)"
                : "oklch(0.45 0.03 260)",
            }}
          >
            <Flag className="w-4 h-4 mr-2" />
            START RACE
          </Button>

          {!canStart && (
            <p className="text-xs text-center text-muted-foreground -mt-2">
              Need at least 1 other player to start
            </p>
          )}
        </>
      )}

      <Button
        data-ocid="multi.create.back_button"
        variant="ghost"
        onClick={onBack}
        className="text-muted-foreground"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </Button>
    </motion.div>
  );
}

function MultiJoin({
  actor,
  onBack,
  onJoined,
}: {
  actor: any;
  onBack: () => void;
  onJoined: (roomCode: string, playerName: string) => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("TITOO");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  const handleJoin = async () => {
    const trimCode = code.trim().toUpperCase();
    const trimName = name.trim() || "RACER";
    if (trimCode.length !== 6) {
      setError("Room code must be 6 characters");
      return;
    }
    if (!actor) {
      setError("Not connected to network");
      return;
    }
    setError("");
    setJoining(true);
    try {
      const active = await actor.isRoomActive(trimCode);
      if (!active) {
        setError("Room not found or already closed");
        setJoining(false);
        return;
      }
      await actor.joinRoom(trimCode, trimName);
      onJoined(trimCode, trimName);
    } catch {
      setError("Failed to join room. Please try again.");
      setJoining(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full flex flex-col gap-4"
    >
      <div className="text-center">
        <h2
          className="text-xl font-black tracking-tight"
          style={{ color: "oklch(0.75 0.18 260)" }}
        >
          JOIN ROOM
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Enter the room code from your host
        </p>
      </div>

      <div
        className="rounded-xl p-4 flex flex-col gap-3"
        style={multiPanelStyle}
      >
        <div>
          <label
            htmlFor="join-code"
            className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5 block"
          >
            Room Code
          </label>
          <Input
            id="join-code"
            data-ocid="multi.join.code_input"
            placeholder="ABC123"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            className="text-center text-xl font-black font-mono tracking-[0.3em] h-12"
            style={{
              background: "oklch(0.06 0.01 260 / 0.8)",
              border: "1px solid oklch(0.55 0.22 260 / 0.4)",
              color: "oklch(0.75 0.18 260)",
            }}
            maxLength={6}
          />
        </div>
        <div>
          <label
            htmlFor="join-name"
            className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5 block"
          >
            Your Name
          </label>
          <Input
            id="join-name"
            data-ocid="multi.join.name_input"
            placeholder="RACER"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 15))}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            className="text-center font-bold tracking-wider"
            style={{
              background: "oklch(0.06 0.01 260 / 0.8)",
              border: "1px solid oklch(0.35 0.08 260 / 0.4)",
            }}
          />
        </div>

        {error && (
          <p
            data-ocid="multi.join.error_state"
            className="text-xs text-center"
            style={{ color: "oklch(0.65 0.2 25)" }}
          >
            {error}
          </p>
        )}

        <Button
          data-ocid="multi.join.submit_button"
          onClick={handleJoin}
          disabled={joining || code.length !== 6}
          className="w-full h-11 font-black tracking-widest"
          style={{
            background: "oklch(0.55 0.22 260)",
            color: "#fff",
          }}
        >
          {joining ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Hash className="w-4 h-4 mr-2" />
          )}
          {joining ? "Joining..." : "JOIN ROOM"}
        </Button>
      </div>

      <Button
        data-ocid="multi.join.back_button"
        variant="ghost"
        onClick={onBack}
        className="text-muted-foreground"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </Button>
    </motion.div>
  );
}

function MultiWaiting({
  roomCode,
  playerName,
  onRaceStart,
}: {
  roomCode: string;
  playerName: string;
  onRaceStart: () => void;
}) {
  const [countdown, setCountdown] = useState(5);
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          if (!calledRef.current) {
            calledRef.current = true;
            onRaceStart();
          }
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [onRaceStart]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="w-full flex flex-col items-center gap-5"
    >
      <div className="text-center">
        <h2
          className="text-xl font-black tracking-tight"
          style={{ color: "var(--neon-green)" }}
        >
          RACE STARTING
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Room{" "}
          <span
            className="font-black font-mono"
            style={{ color: "var(--neon-green)" }}
          >
            {roomCode}
          </span>{" "}
          · Racing as{" "}
          <span className="font-bold text-foreground">{playerName}</span>
        </p>
      </div>

      <div
        className="rounded-2xl p-8 flex flex-col items-center gap-3"
        style={multiPanelStyle}
      >
        <p className="text-xs text-muted-foreground uppercase tracking-widest">
          Starting in
        </p>
        <motion.p
          key={countdown}
          initial={{ scale: 1.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-8xl font-black font-mono"
          style={{
            color: countdown <= 2 ? "oklch(0.65 0.2 25)" : "var(--neon-green)",
            textShadow:
              countdown <= 2
                ? "0 0 40px oklch(0.65 0.2 25 / 0.6)"
                : "0 0 40px oklch(0.82 0.22 138 / 0.6)",
          }}
        >
          {countdown}
        </motion.p>
        <p className="text-xs text-muted-foreground">Get ready to race!</p>
      </div>
    </motion.div>
  );
}

function MultiResults({
  actor,
  roomCode,
  myName,
  onPlayAgain,
  onExit,
}: {
  actor: any;
  roomCode: string;
  myName: string;
  onPlayAgain: () => void;
  onExit: () => void;
}) {
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!actor || !roomCode) return;
    const poll = () => {
      actor
        .getRoomState(roomCode)
        .then((state: RoomState) => setRoomState(state))
        .catch(() => {});
    };
    poll();
    pollRef.current = setInterval(poll, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [actor, roomCode]);

  const players = roomState?.players ?? [];
  const sorted = [...players].sort((a, b) => {
    const scoreA = a.score ? Number(a.score) : 0;
    const scoreB = b.score ? Number(b.score) : 0;
    return scoreB - scoreA;
  });
  const allFinished = roomState?.allFinished ?? false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full flex flex-col gap-4"
    >
      <div className="text-center">
        <h2
          className="text-2xl font-black tracking-tight"
          style={{ color: "var(--neon-green)" }}
        >
          ROOM RESULTS
        </h2>
        <p className="text-xs text-muted-foreground mt-1 font-mono">
          Room {roomCode}
        </p>
      </div>

      {!allFinished && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{
            background: "oklch(0.82 0.18 75 / 0.08)",
            border: "1px solid oklch(0.82 0.18 75 / 0.25)",
            color: "oklch(0.82 0.18 75)",
          }}
        >
          <Clock className="w-3.5 h-3.5 animate-pulse flex-shrink-0" />
          Waiting for other players to finish...
        </div>
      )}

      <div className="rounded-xl overflow-hidden" style={multiPanelStyle}>
        <div
          className="grid grid-cols-4 gap-2 px-4 py-2 text-[10px] font-black tracking-widest uppercase"
          style={{
            borderBottom: "1px solid oklch(0.22 0.02 260 / 0.5)",
            color: "oklch(0.45 0.03 260)",
          }}
        >
          <span>Rank</span>
          <span className="col-span-2">Player</span>
          <span className="text-right">Score</span>
        </div>

        {sorted.length === 0 ? (
          <div
            data-ocid="multi.results.empty_state"
            className="py-8 text-center text-sm text-muted-foreground"
          >
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
            Loading results...
          </div>
        ) : (
          <ul>
            {sorted.map((p, i) => {
              const isMe = p.name === myName;
              const score = p.score ? Number(p.score) : null;
              const rankConfig = i < 3 ? RANK_CONFIG[i] : null;
              return (
                <li
                  key={p.id?.toString() ?? i}
                  data-ocid={`multi.results.item.${i + 1}`}
                  className="grid grid-cols-4 gap-2 px-4 py-3 items-center"
                  style={{
                    background: isMe
                      ? "oklch(0.82 0.22 138 / 0.08)"
                      : i % 2 === 0
                        ? "oklch(0.08 0.01 260 / 0.4)"
                        : "transparent",
                    borderLeft: isMe
                      ? "3px solid oklch(0.82 0.22 138 / 0.7)"
                      : "3px solid transparent",
                  }}
                >
                  <span
                    className="text-sm font-black"
                    style={{
                      color: rankConfig
                        ? rankConfig.color
                        : "oklch(0.45 0.03 260)",
                    }}
                  >
                    #{i + 1}
                  </span>
                  <span
                    className="col-span-2 text-sm font-semibold truncate flex items-center gap-1"
                    style={{
                      color: isMe ? "var(--neon-green)" : "oklch(0.8 0.02 260)",
                    }}
                  >
                    {isMe && <Star className="w-3 h-3 flex-shrink-0" />}
                    {p.name}
                    {!p.hasFinished && (
                      <Clock
                        className="w-3 h-3 ml-1 animate-pulse flex-shrink-0"
                        style={{ color: "oklch(0.6 0.1 75)" }}
                      />
                    )}
                  </span>
                  <span
                    className="text-right text-sm font-black font-mono"
                    style={{
                      color: rankConfig
                        ? rankConfig.color
                        : "var(--neon-green-dim)",
                    }}
                  >
                    {score !== null
                      ? score.toString().padStart(6, "0")
                      : "------"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Button
        data-ocid="multi.results.playagain_button"
        onClick={onPlayAgain}
        className="w-full h-11 font-black neon-btn tracking-widest"
        style={{
          background: "oklch(0.82 0.22 138)",
          color: "oklch(0.08 0.005 260)",
        }}
      >
        <RotateCcw className="w-4 h-4 mr-2" />
        PLAY AGAIN
      </Button>
      <Button
        data-ocid="multi.results.exit_button"
        variant="outline"
        onClick={onExit}
        className="w-full border-border/50 text-muted-foreground"
      >
        EXIT TO MENU
      </Button>
    </motion.div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState<ScreenState>("start");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(1); // position
  const [speedLevel, setSpeedLevel] = useState(1); // lap
  const [playerName, setPlayerName] = useState("TITOO");
  const [scoreSubmitted, setScoreSubmitted] = useState(false);
  const [gameKey, setGameKey] = useState(0);
  const [stage, setStage] = useState(1);

  // Multiplayer state
  const [multiRoomCode, setMultiRoomCode] = useState("");
  const [multiPlayerName, setMultiPlayerName] = useState("TITOO");
  const [multiScoreSubmitted, setMultiScoreSubmitted] = useState(false);

  const { actor, isFetching } = useActor();
  const { identity, login, clear, isInitializing } = useInternetIdentity();
  const queryClient = useQueryClient();

  const isLoggedIn = !!identity;

  const { data: leaderboard = [], isLoading: lbLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getLeaderboard();
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 30_000,
  });

  const { data: personalBest = null } = useQuery({
    queryKey: ["personalBest"],
    queryFn: async () => {
      if (!actor || !isLoggedIn) return null;
      return actor.getPersonalBest();
    },
    enabled: !!actor && !isFetching && isLoggedIn,
  });

  const submitMutation = useMutation({
    mutationFn: async ({
      name,
      scoreVal,
    }: { name: string; scoreVal: number }) => {
      if (!actor) throw new Error("Not connected");
      await actor.submitScore(name, BigInt(scoreVal));
    },
    onSuccess: () => {
      setScoreSubmitted(true);
      toast.success("Score submitted! 🏆");
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["personalBest"] });
    },
    onError: () => {
      toast.error("Failed to submit score. Please try again.");
    },
  });

  // Submit multiplayer room score
  const submitMultiScore = useCallback(
    async (finalScore: number) => {
      if (!actor || !multiRoomCode || multiScoreSubmitted) return;
      setMultiScoreSubmitted(true);
      try {
        await actor.submitRaceScore(
          multiRoomCode,
          BigInt(finalScore),
          BigInt(Date.now()),
        );
      } catch {
        // silently ignore — results screen will just show no score
      }
    },
    [actor, multiRoomCode, multiScoreSubmitted],
  );

  const handleGameStateChange = useCallback(
    (state: "idle" | "playing" | "gameover") => {
      if (state === "playing") {
        setScreen("playing");
      } else if (state === "gameover") {
        if (multiRoomCode) {
          setScreen("multiResults");
        } else {
          setScreen("gameover");
        }
      }
    },
    [multiRoomCode],
  );

  const handleScoreChange = useCallback(
    (s: number, level: number, liv: number) => {
      setScore(s);
      setSpeedLevel(level);
      setLives(liv);
    },
    [],
  );

  // When a multiplayer race ends, auto-submit the score
  const handleMultiGameStateChange = useCallback(
    (state: "idle" | "playing" | "gameover") => {
      if (state === "playing") {
        setScreen("playing");
      } else if (state === "gameover") {
        setScreen("multiResults");
      }
    },
    [],
  );

  const handleMultiScoreChange = useCallback(
    (s: number, level: number, liv: number) => {
      setScore(s);
      setSpeedLevel(level);
      setLives(liv);
      // Auto-submit at race end (level === TOTAL_LAPS means race done)
      if (level === 3 && multiRoomCode && !multiScoreSubmitted) {
        submitMultiScore(s);
      }
    },
    [multiRoomCode, multiScoreSubmitted, submitMultiScore],
  );

  const handleStartPlaying = useCallback(() => {
    setScore(0);
    setLives(1);
    setSpeedLevel(1);
    setScoreSubmitted(false);
    setGameKey((k) => k + 1);
    setScreen("playing");
  }, []);

  const handleStartMultiRace = useCallback(() => {
    setScore(0);
    setLives(1);
    setSpeedLevel(1);
    setMultiScoreSubmitted(false);
    setGameKey((k) => k + 1);
    setScreen("playing");
  }, []);

  const handleSubmitScore = useCallback(() => {
    const name = playerName.trim() || "TITOO";
    submitMutation.mutate({ name, scoreVal: score });
  }, [playerName, score, submitMutation]);

  const positionLabel =
    ["1st", "2nd", "3rd", "4th", "5th", "6th"][lives - 1] || `${lives}th`;

  const isMultiRace = screen === "playing" && !!multiRoomCode;

  return (
    <div
      className="game-wrapper relative min-h-dvh select-none"
      style={{ fontFamily: "Outfit, sans-serif" }}
    >
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "oklch(0.13 0.01 260)",
            border: "1px solid oklch(0.22 0.025 260)",
            color: "oklch(0.95 0.02 100)",
          },
        }}
      />

      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 0%, oklch(0.2 0.05 220 / 0.3), transparent)",
        }}
      />

      {/* ── PLAYING SCREEN ── */}
      {screen === "playing" && (
        <div className="flex flex-col items-center justify-center min-h-dvh py-2">
          <RaceHUD
            score={score}
            lives={lives}
            speedLevel={speedLevel}
            stage={stage}
            roomCode={multiRoomCode || undefined}
          />
          <F1Game
            key={gameKey}
            onStateChange={
              isMultiRace ? handleMultiGameStateChange : handleGameStateChange
            }
            onScoreChange={
              isMultiRace ? handleMultiScoreChange : handleScoreChange
            }
            autoStart
            stage={stage}
            leaderboard={leaderboard as ScoreEntry[]}
            personalBest={personalBest as ScoreEntry | null}
            lbLoading={lbLoading}
          />
        </div>
      )}

      {/* ── OVERLAYS: start / gameover / multi screens ── */}
      <AnimatePresence mode="wait">
        {screen === "start" && (
          <motion.div
            key="start"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 flex flex-col items-center justify-start min-h-dvh overflow-y-auto py-4"
          >
            <div className="flex flex-col items-center w-full max-w-sm px-4 pt-4 pb-8 gap-5">
              {/* Title */}
              <motion.div
                className="text-center"
                initial={{ y: -30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              >
                <h1
                  className="text-7xl font-black tracking-tight glow-green"
                  style={{
                    color: "var(--neon-green)",
                    letterSpacing: "0.06em",
                  }}
                >
                  F1
                </h1>
                <p className="text-muted-foreground text-xs mt-1 tracking-widest uppercase">
                  3-Lap Circuit Race
                </p>
              </motion.div>

              {/* Start button */}
              <motion.div
                className="w-full flex flex-col gap-2"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
                <Button
                  data-ocid="game.start_button"
                  onClick={() => {
                    setMultiRoomCode("");
                    handleStartPlaying();
                  }}
                  className="w-full h-14 text-xl font-black neon-btn tracking-widest"
                  style={{
                    background: "oklch(0.82 0.22 138)",
                    color: "oklch(0.08 0.005 260)",
                  }}
                >
                  <Flag className="w-5 h-5 mr-2" />
                  START RACE
                </Button>
                <Button
                  data-ocid="game.multiplayer_button"
                  onClick={() => setScreen("multiLobby")}
                  className="w-full h-12 font-black tracking-widest"
                  style={{
                    background: "oklch(0.35 0.18 260 / 0.25)",
                    border: "1px solid oklch(0.55 0.22 260 / 0.5)",
                    color: "oklch(0.75 0.18 260)",
                  }}
                >
                  <Users className="w-4 h-4 mr-2" />
                  MULTIPLAYER
                </Button>
                <p className="text-center text-xs text-muted-foreground mt-1">
                  {stage === 2
                    ? "Stage 2 · Complex Track"
                    : "3 laps · 5 AI opponents · Arrow keys / WASD"}
                </p>
              </motion.div>

              {/* Login/out */}
              <div className="flex items-center justify-between w-full">
                {isLoggedIn ? (
                  <>
                    <span className="text-xs text-muted-foreground">
                      Logged in
                    </span>
                    <Button
                      data-ocid="auth.logout_button"
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground"
                      onClick={() => {
                        clear();
                      }}
                    >
                      <LogOut className="w-3 h-3 mr-1" />
                      Logout
                    </Button>
                  </>
                ) : (
                  <Button
                    data-ocid="auth.login_button"
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground ml-auto"
                    onClick={login}
                    disabled={isInitializing}
                  >
                    <LogIn className="w-3 h-3 mr-1" />
                    Login to save scores
                  </Button>
                )}
              </div>

              {/* Leaderboard */}
              <motion.div
                className="w-full"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.5 }}
              >
                <Leaderboard
                  scores={leaderboard as ScoreEntry[]}
                  personalBest={personalBest as ScoreEntry | null}
                  isLoading={lbLoading}
                />
              </motion.div>

              {/* Footer */}
              <p className="text-xs text-muted-foreground/40 text-center mt-2">
                © {new Date().getFullYear()}. Built with love using{" "}
                <a
                  href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(typeof window !== "undefined" ? window.location.hostname : "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-muted-foreground/70"
                >
                  caffeine.ai
                </a>
              </p>
            </div>
          </motion.div>
        )}

        {screen === "gameover" && (
          <motion.div
            key="gameover"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 flex flex-col items-center justify-start min-h-dvh overflow-y-auto py-4"
          >
            <div className="flex flex-col items-center w-full max-w-sm px-4 pt-4 pb-8 gap-5">
              {/* Title */}
              <div className="text-center">
                <h1
                  className="text-7xl font-black tracking-tight glow-green"
                  style={{
                    color: "var(--neon-green)",
                    letterSpacing: "0.06em",
                  }}
                >
                  F1
                </h1>
              </div>

              {/* Race Finished card */}
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-full rounded-xl p-4 text-center"
                style={{
                  background: "oklch(0.13 0.01 260 / 0.97)",
                  border: "1px solid oklch(0.82 0.22 138 / 0.4)",
                  backdropFilter: "blur(12px)",
                }}
              >
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">
                  Race Finished
                </p>
                <p
                  className="text-4xl font-black glow-green"
                  style={{ color: "var(--neon-green)" }}
                >
                  {score.toString().padStart(4, "0")} pts
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Finished {positionLabel} — F1 Championship Points
                </p>

                {!scoreSubmitted ? (
                  <div className="mt-4 flex flex-col gap-2">
                    {isLoggedIn ? (
                      <>
                        <Input
                          data-ocid="game.name_input"
                          placeholder="Enter your name..."
                          value={playerName}
                          onChange={(e) => setPlayerName(e.target.value)}
                          onKeyDown={(e) =>
                            e.key === "Enter" && handleSubmitScore()
                          }
                          maxLength={20}
                          className="text-center bg-muted/30 border-border/50 text-sm"
                        />
                        <Button
                          data-ocid="game.submit_button"
                          onClick={handleSubmitScore}
                          disabled={submitMutation.isPending}
                          className="w-full neon-btn font-bold"
                          style={{
                            background: "oklch(0.82 0.22 138)",
                            color: "oklch(0.08 0.005 260)",
                          }}
                        >
                          {submitMutation.isPending ? (
                            "Submitting..."
                          ) : (
                            <>
                              <Send className="w-4 h-4 mr-1" />
                              Submit Score
                            </>
                          )}
                        </Button>
                      </>
                    ) : (
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-2">
                          Log in to save your championship points
                        </p>
                        <Button
                          onClick={login}
                          disabled={isInitializing}
                          variant="outline"
                          size="sm"
                          className="border-neon-green/40 text-neon-green hover:bg-neon-green/10"
                        >
                          <LogIn className="w-3.5 h-3.5 mr-1.5" />
                          Login
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-3 text-neon-green text-sm font-bold flex items-center justify-center gap-1.5">
                    <Trophy className="w-4 h-4" />
                    Score saved!
                  </div>
                )}

                <Button
                  data-ocid="game.playagain_button"
                  onClick={() => {
                    setStage(1);
                    setMultiRoomCode("");
                    handleStartPlaying();
                  }}
                  variant="outline"
                  className="w-full mt-3 neon-btn border-neon-green/40 text-neon-green hover:bg-neon-green/10 font-bold"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Race Again
                </Button>
                {stage === 1 && (
                  <Button
                    data-ocid="game.nextstage_button"
                    onClick={() => {
                      setStage(2);
                      setMultiRoomCode("");
                      handleStartPlaying();
                    }}
                    className="w-full mt-1 font-bold"
                    style={{
                      background:
                        "linear-gradient(135deg, oklch(0.65 0.18 55), oklch(0.72 0.2 75))",
                      color: "oklch(0.08 0.005 260)",
                    }}
                  >
                    <Trophy className="w-4 h-4 mr-2" />
                    Next Stage →
                  </Button>
                )}
              </motion.div>

              {/* Leaderboard */}
              <motion.div
                className="w-full"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.5 }}
              >
                <Leaderboard
                  scores={leaderboard as ScoreEntry[]}
                  personalBest={personalBest as ScoreEntry | null}
                  isLoading={lbLoading}
                />
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* ── MULTIPLAYER SCREENS ── */}
        {(screen === "multiLobby" ||
          screen === "multiCreate" ||
          screen === "multiJoin" ||
          screen === "multiWaiting" ||
          screen === "multiResults") && (
          <motion.div
            key="multi-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 flex flex-col items-center justify-start min-h-dvh overflow-y-auto py-4"
          >
            <div className="flex flex-col items-center w-full max-w-sm px-4 pt-4 pb-8 gap-5">
              {/* Header */}
              <div className="text-center">
                <h1
                  className="text-5xl font-black tracking-tight glow-green"
                  style={{
                    color: "var(--neon-green)",
                    letterSpacing: "0.06em",
                  }}
                >
                  F1
                </h1>
              </div>

              <AnimatePresence mode="wait">
                {screen === "multiLobby" && (
                  <MultiLobby
                    key="lobby"
                    onBack={() => setScreen("start")}
                    onCreate={() => setScreen("multiCreate")}
                    onJoin={() => setScreen("multiJoin")}
                  />
                )}
                {screen === "multiCreate" && (
                  <MultiCreate
                    key="create"
                    actor={actor}
                    isFetching={isFetching}
                    onBack={() => setScreen("multiLobby")}
                    onStart={(code) => {
                      setMultiRoomCode(code);
                      setMultiPlayerName("TITOO");
                      setStage(1);
                      handleStartMultiRace();
                    }}
                  />
                )}
                {screen === "multiJoin" && (
                  <MultiJoin
                    key="join"
                    actor={actor}
                    onBack={() => setScreen("multiLobby")}
                    onJoined={(code, name) => {
                      setMultiRoomCode(code);
                      setMultiPlayerName(name);
                      setScreen("multiWaiting");
                    }}
                  />
                )}
                {screen === "multiWaiting" && (
                  <MultiWaiting
                    key="waiting"
                    roomCode={multiRoomCode}
                    playerName={multiPlayerName}
                    onRaceStart={() => {
                      setStage(1);
                      handleStartMultiRace();
                    }}
                  />
                )}
                {screen === "multiResults" && (
                  <MultiResults
                    key="results"
                    actor={actor}
                    roomCode={multiRoomCode}
                    myName={multiPlayerName || "TITOO"}
                    onPlayAgain={() => {
                      setMultiRoomCode("");
                      setScreen("multiLobby");
                    }}
                    onExit={() => {
                      setMultiRoomCode("");
                      setScreen("start");
                    }}
                  />
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
