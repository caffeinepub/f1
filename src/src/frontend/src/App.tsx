import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  Heart,
  LogIn,
  LogOut,
  RotateCcw,
  Send,
  Trophy,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { ScoreEntry } from "./backend.d";
import F1Game from "./components/RoadRacerGame";
import { useActor } from "./hooks/useActor";
import { useInternetIdentity } from "./hooks/useInternetIdentity";

type ScreenState = "start" | "playing" | "gameover";

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
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-4 h-4 text-neon-green" />
        <span className="text-sm font-semibold tracking-widest uppercase text-neon-green">
          Leaderboard
        </span>
      </div>

      {personalBest && (
        <div className="mb-3 px-3 py-2 rounded-md bg-neon-green/10 border border-neon-green/30 flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Your Best</span>
          <span className="text-sm font-bold text-neon-green">
            {personalBest.name} — {personalBest.score.toString()}m
          </span>
        </div>
      )}

      <Table data-ocid="leaderboard.table">
        <TableHeader>
          <TableRow className="border-border/50">
            <TableHead className="text-muted-foreground text-xs w-10">
              #
            </TableHead>
            <TableHead className="text-muted-foreground text-xs">
              Player
            </TableHead>
            <TableHead className="text-muted-foreground text-xs text-right">
              Distance
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            (["sk-1", "sk-2", "sk-3", "sk-4", "sk-5"] as const).map((k) => (
              <TableRow key={k} className="border-border/30">
                <TableCell colSpan={3}>
                  <div className="h-4 bg-muted/30 rounded animate-pulse" />
                </TableCell>
              </TableRow>
            ))
          ) : scores.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={3}
                className="text-center text-muted-foreground text-sm py-6"
              >
                No scores yet — be the first!
              </TableCell>
            </TableRow>
          ) : (
            scores.slice(0, 10).map((entry, i) => {
              const rankClass =
                i === 0
                  ? "rank-gold"
                  : i === 1
                    ? "rank-silver"
                    : i === 2
                      ? "rank-bronze"
                      : "text-foreground/70";
              const ocidIndex = i + 1;
              return (
                <TableRow
                  key={`lb-${entry.name}-${i}`}
                  data-ocid={`leaderboard.item.${ocidIndex}`}
                  className="border-border/30 hover:bg-muted/20"
                >
                  <TableCell className={`font-bold text-sm ${rankClass}`}>
                    {i + 1}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {entry.name}
                  </TableCell>
                  <TableCell className="text-right text-sm font-mono text-neon-green">
                    {entry.score.toString()}m
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function HUD({
  score,
  lives,
  speedLevel,
}: {
  score: number;
  lives: number;
  speedLevel: number;
}) {
  return (
    <div
      className="w-full max-w-[360px] flex items-center justify-between px-3 py-2 rounded-t-lg"
      style={{
        background: "var(--hud-bg)",
        borderBottom: "1px solid oklch(0.82 0.22 138 / 0.3)",
      }}
    >
      {/* Score */}
      <div className="flex items-center gap-1.5">
        <ChevronRight className="w-3.5 h-3.5 text-neon-green" />
        <span className="text-neon-green font-bold text-sm font-mono tracking-wider">
          {score.toString().padStart(6, "0")}m
        </span>
      </div>

      {/* Speed Level */}
      <div className="flex items-center gap-1">
        <Zap className="w-3.5 h-3.5 text-yellow-400" />
        <span className="text-yellow-400 text-xs font-bold">
          LV.{speedLevel}
        </span>
      </div>

      {/* Lives */}
      <div className="flex items-center gap-1">
        {(["life-1", "life-2", "life-3"] as const).map((k, i) => (
          <Heart
            key={k}
            className={`w-4 h-4 transition-all duration-300 ${
              i < lives
                ? "fill-red-500 text-red-500"
                : "text-muted-foreground/30"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<ScreenState>("start");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [speedLevel, setSpeedLevel] = useState(1);
  const [playerName, setPlayerName] = useState("");
  const [scoreSubmitted, setScoreSubmitted] = useState(false);
  // Key used to remount the game component, forcing a fresh game
  const [gameKey, setGameKey] = useState(0);

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
    setLives(3);
    setSpeedLevel(1);
    setScoreSubmitted(false);
    setGameKey((k) => k + 1);
    setScreen("playing");
  }, []);

  const handleSubmitScore = useCallback(() => {
    const name = playerName.trim() || "Anonymous";
    submitMutation.mutate({ name, scoreVal: score });
  }, [playerName, score, submitMutation]);

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

      {/* Atmospheric background */}
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
          <HUD score={score} lives={lives} speedLevel={speedLevel} />
          <F1Game
            key={gameKey}
            onStateChange={handleGameStateChange}
            onScoreChange={handleScoreChange}
            autoStart
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
                  Race the night circuit
                </p>
              </motion.div>

              {/* Game Over card */}
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
                    Game Over
                  </p>
                  <p
                    className="text-4xl font-black glow-green"
                    style={{ color: "var(--neon-green)" }}
                  >
                    {score.toString().padStart(6, "0")}m
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Distance traveled
                  </p>

                  {/* Submit score area */}
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
                            Log in to save your score
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
                    onClick={handleStartPlaying}
                    variant="outline"
                    className="w-full mt-3 neon-btn border-neon-green/40 text-neon-green hover:bg-neon-green/10 font-bold"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Play Again
                  </Button>
                </motion.div>
              )}

              {/* Start button (start screen only) */}
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
                      letterSpacing: "0.1em",
                    }}
                  >
                    PLAY
                  </Button>
                  <p className="text-center text-xs text-muted-foreground mt-2">
                    Arrow keys / A·D to steer · Space or Enter to start
                  </p>
                </motion.div>
              )}

              {/* Auth */}
              <div className="flex justify-end w-full">
                {isLoggedIn ? (
                  <Button
                    onClick={clear}
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground text-xs"
                  >
                    <LogOut className="w-3 h-3 mr-1" />
                    Logout
                  </Button>
                ) : (
                  <Button
                    onClick={login}
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-neon-green text-xs"
                    disabled={isInitializing}
                  >
                    <LogIn className="w-3 h-3 mr-1" />
                    Login to save scores
                  </Button>
                )}
              </div>

              {/* Leaderboard */}
              <motion.div
                className="w-full rounded-xl p-4"
                style={{
                  background: "oklch(0.11 0.01 260 / 0.95)",
                  border: "1px solid oklch(0.22 0.025 260)",
                  backdropFilter: "blur(8px)",
                }}
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.5 }}
              >
                <Leaderboard
                  scores={leaderboard}
                  personalBest={personalBest}
                  isLoading={lbLoading || isFetching}
                />
              </motion.div>

              {/* Footer */}
              <p className="text-xs text-muted-foreground/50 text-center mt-2">
                © {new Date().getFullYear()}.{" "}
                <a
                  href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-neon-green transition-colors"
                >
                  Built with ♥ using caffeine.ai
                </a>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scanlines overlay */}
      <div className="fixed inset-0 scanlines pointer-events-none opacity-30" />
    </div>
  );
}
