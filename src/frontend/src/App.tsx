import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  Crown,
  Flag,
  LogIn,
  LogOut,
  Medal,
  RotateCcw,
  Send,
  Star,
  Trophy,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { ScoreEntry } from "./backend.d";
import F1Game from "./components/RoadRacerGame";
import { useActor } from "./hooks/useActor";
import { useInternetIdentity } from "./hooks/useInternetIdentity";

type ScreenState = "start" | "playing" | "gameover";

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
}: {
  score: number;
  speedLevel: number;
  lives: number;
  stage?: number;
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
      <div
        className="px-2 py-0.5 rounded text-[10px] font-black tracking-widest"
        style={{
          background:
            stage === 2
              ? "oklch(0.65 0.18 55 / 0.3)"
              : "oklch(0.82 0.22 138 / 0.15)",
          border: `1px solid ${stage === 2 ? "oklch(0.65 0.18 55 / 0.6)" : "oklch(0.82 0.22 138 / 0.4)"}`,
          color: stage === 2 ? "oklch(0.82 0.18 55)" : "var(--neon-green)",
        }}
      >
        S{stage}
      </div>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<ScreenState>("start");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(1); // position
  const [speedLevel, setSpeedLevel] = useState(1); // lap
  const [playerName, setPlayerName] = useState("TITOO");
  const [scoreSubmitted, setScoreSubmitted] = useState(false);
  const [gameKey, setGameKey] = useState(0);
  const [stage, setStage] = useState(1);

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

  const handleGameStateChange = useCallback(
    (state: "idle" | "playing" | "gameover") => {
      if (state === "playing") {
        setScreen("playing");
      } else if (state === "gameover") {
        setScreen("gameover");
      }
    },
    [],
  );

  const handleScoreChange = useCallback(
    (s: number, level: number, liv: number) => {
      setScore(s);
      setSpeedLevel(level);
      setLives(liv);
    },
    [],
  );

  const handleStartPlaying = useCallback(() => {
    setScore(0);
    setLives(1);
    setSpeedLevel(1);
    setScoreSubmitted(false);
    setGameKey((k) => k + 1);
    setScreen("playing");
  }, []);

  const handleSubmitScore = useCallback(() => {
    const name = playerName.trim() || "TITOO";
    submitMutation.mutate({ name, scoreVal: score });
  }, [playerName, score, submitMutation]);

  const positionLabel =
    ["1st", "2nd", "3rd", "4th", "5th", "6th"][lives - 1] || `${lives}th`;

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
          />
          <F1Game
            key={gameKey}
            onStateChange={handleGameStateChange}
            onScoreChange={handleScoreChange}
            autoStart
            stage={stage}
            leaderboard={leaderboard as ScoreEntry[]}
            personalBest={personalBest as ScoreEntry | null}
            lbLoading={lbLoading}
          />
        </div>
      )}

      {/* ── START / GAME OVER SCREENS ── */}
      <AnimatePresence>
        {(screen === "start" || screen === "gameover") && (
          <motion.div
            key="overlay"
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

              {/* Race Finished card */}
              {screen === "gameover" && (
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
              )}

              {/* Start button */}
              {screen === "start" && (
                <motion.div
                  className="w-full"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                >
                  <Button
                    data-ocid="game.start_button"
                    onClick={handleStartPlaying}
                    className="w-full h-14 text-xl font-black neon-btn tracking-widest"
                    style={{
                      background: "oklch(0.82 0.22 138)",
                      color: "oklch(0.08 0.005 260)",
                    }}
                  >
                    <Flag className="w-5 h-5 mr-2" />
                    START RACE
                  </Button>
                  <p className="text-center text-xs text-muted-foreground mt-2">
                    {stage === 2
                      ? "Stage 2 · Complex Track"
                      : "3 laps · 5 AI opponents · Arrow keys / WASD"}
                  </p>
                </motion.div>
              )}

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
      </AnimatePresence>
    </div>
  );
}
