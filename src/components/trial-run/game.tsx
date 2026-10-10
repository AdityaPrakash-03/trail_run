import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Heart, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CONFIG, getReward } from "@/config";
import { track } from "@/analytics";
import { isMuted, setMuted, subscribeSound, unlockAudio, sfx } from "@/game3d/audio";
import type { RunnerStats } from "@/game3d/engine";
import { useTrial } from "./provider";
import { hasRedeemed } from "@/lib/trial-state";
import { CoinIcon } from "./art";
import { Progress } from "./shared";
import { Viewer3D } from "./viewer3d";

const FIRST_STATS: RunnerStats = {
  phase: "countdown",
  countdown: 3,
  catches: 0,
  hearts: CONFIG.hearts,
  seconds: CONFIG.roundSeconds,
  combo: 0,
  endedBy: null,
};

export function Game({ mode }: { mode: "trial" | "normal" }) {
  const { player, finishRun, ready } = useTrial();
  const navigate = useNavigate();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [started, setStarted] = useState(mode === "normal");
  const [stats, setStats] = useState<RunnerStats>(FIRST_STATS);
  const [flash, setFlash] = useState(0);
  const [pulse, setPulse] = useState(0);
  const [showGo, setShowGo] = useState(false);
  const [failed, setFailed] = useState(false);
  const muted = useSyncExternalStore(subscribeSound, isMuted, () => false);
  const finish = useRef(finishRun);
  finish.current = finishRun;
  const navigation = useRef(navigate);
  navigation.current = navigate;
  const completed = useRef(false);
  const firedStart = useRef(false);
  const seconds = useRef(0);
  const goal = getReward(player.goal);
  const startBalance = useRef(player.balance);
  const look = useRef(player.colour);
  const goalAtStart = useRef(player.goal);

  useEffect(() => {
    if (mode === "trial" && player.variant === "A") void navigate({ to: "/" });
  }, [mode, player.variant, navigate]);

  const introTracked = useRef(false);
  useEffect(() => {
    if (ready && mode === "trial" && player.variant === "B" && !introTracked.current) {
      introTracked.current = true;
      track("trial_intro_viewed", { reward_id: "hoodie" });
    }
  }, [ready, mode, player.variant]);

  useEffect(() => {
    if (!ready || !started || !canvas.current || (mode === "trial" && player.variant !== "B")) return;
    const node = canvas.current;
    let cancelled = false;
    let runner: { destroy(): void } | null = null;
    unlockAudio();
    import("@/game3d/engine")
      .then(({ createRunner }) => {
        if (cancelled) return;
        try {
          runner = createRunner({
            canvas: node,
            hoodie: mode === "trial" || (hasRedeemed(player, "hoodie") && player.equipped),
            colour: look.current,
            seconds: CONFIG.roundSeconds,
            hearts: CONFIG.hearts,
            fallRamp: CONFIG.fallSpeedRamp,
            reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
            onStats: (s) => {
              seconds.current = CONFIG.roundSeconds - s.seconds;
              setStats(s);
            },
            onHit: () => setFlash((n) => n + 1),
            onCatch: () => setPulse((n) => n + 1),
            onEnd: (r) => {
              if (completed.current) return;
              completed.current = true;
              finish.current({
                mode,
                catches: r.catches,
                duration: Number(r.duration.toFixed(2)),
                endedBy: r.endedBy,
              });
              void navigation.current({ to: mode === "trial" ? "/trial-result" : "/summary" });
            },
          });
          if (!firedStart.current) {
            firedStart.current = true;
            if (mode === "trial") track("trial_started", { reward_id: "hoodie", colour: look.current });
            else
              track("game_session_started", {
                goal_active: !!goalAtStart.current,
                goal_reward_id: goalAtStart.current,
              });
          }
        } catch {
          setFailed(true);
        }
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      runner?.destroy();
    };
  }, [started, mode, player.variant, player.equipped, player.vouchers.hoodie, ready]);

  useEffect(() => {
    if (stats.phase !== "run") return;
    setShowGo(true);
    const id = window.setTimeout(() => setShowGo(false), 800);
    return () => window.clearTimeout(id);
  }, [stats.phase]);

  function quit() {
    if (mode === "trial" && started && !completed.current) {
      track("trial_abandoned", {
        reward_id: "hoodie",
        seconds_played: Number(Math.max(0, seconds.current).toFixed(2)),
      });
      completed.current = true;
    }
    void navigate({ to: "/" });
  }

  const coins = stats.catches * CONFIG.coinsPerCatch;
  const goalNow = goal ? Math.min(startBalance.current + coins, goal.cost) : 0;

  return (
    <main className="game-screen" data-phase={stats.phase} data-mode={mode}>
      <canvas
        ref={canvas}
        className="game-canvas"
        tabIndex={0}
        aria-label="Coin Catch game. Drag or move the mouse to steer and catch falling coins. Arrow keys also steer. Avoid red spikes."
      />

      {flash > 0 && <div key={flash} className="hit-flash" aria-hidden="true" />}

      {started && !failed && (
        <div className="g-hud">
          <div className="g-row">
            <Button
              variant="ghost"
              size="icon"
              className="g-btn"
              aria-label={mode === "trial" ? "Quit trial" : "Quit run"}
              onClick={quit}
            >
              <ArrowLeft />
            </Button>
            <div
              className={`g-timer num ${stats.phase === "run" && stats.seconds <= 5 ? "low" : ""}`}
              role="timer"
              aria-label={`${stats.seconds} seconds left`}
            >
              {stats.phase === "countdown" ? CONFIG.roundSeconds : stats.seconds}
              <small>s</small>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="g-btn"
              aria-label={muted ? "Turn sound on" : "Turn sound off"}
              onClick={() => {
                unlockAudio();
                setMuted(!muted);
              }}
            >
              {muted ? <VolumeX /> : <Volume2 />}
            </Button>
          </div>
          <div className="g-row g-row2">
            <span className="g-hearts" aria-label={`${stats.hearts} hearts remaining`}>
              {Array.from({ length: CONFIG.hearts }, (_, i) => (
                <Heart
                  key={i}
                  size={22}
                  fill="currentColor"
                  className={i >= stats.hearts ? "heart-lost" : "heart-on"}
                />
              ))}
            </span>
            <span className="g-coins num" key={pulse} data-pulse={pulse > 0}>
              <CoinIcon size={20} />
              {coins}
              {stats.combo >= 3 && <em className="g-combo">x{stats.combo}</em>}
            </span>
          </div>
          {mode === "trial" ? (
            <div className="g-chip">Trial coins are not added</div>
          ) : (
            goal && (
              <div
                className="hud"
                aria-label={`Goal progress ${goalNow} of ${goal.cost}`}
                role="status"
              >
                <CoinIcon size={13} />
                <span className="hud-name">{goal.short}</span>
                <Progress balance={startBalance.current + coins} cost={goal.cost} />
                <span className="num">
                  {goalNow}/{goal.cost}
                </span>
              </div>
            )
          )}
        </div>
      )}

      {started && !failed && stats.phase === "countdown" && (
        <div className="g-center" aria-hidden="true">
          <div key={stats.countdown} className="g-count num">
            {stats.countdown}
          </div>
          <p>{mode === "trial" ? "Hoodie on. Steer to catch coins." : "Drag to steer. Dodge the red spikes."}</p>
        </div>
      )}
      {started && !failed && showGo && stats.phase === "run" && (
        <div className="g-center" aria-hidden="true">
          <div className="g-count g-go">GO</div>
        </div>
      )}
      {started && !failed && stats.phase === "end" && (
        <div className="g-center" aria-hidden="true">
          <div className="g-end">{stats.endedBy === "hearts" ? "OUT OF HEARTS" : "TIME"}</div>
        </div>
      )}

      {failed && (
        <div className="g-center g-fail">
          <h2>The 3D game could not start</h2>
          <p>This browser or device blocked WebGL. Try the latest Chrome, Edge or Safari.</p>
          <Button asChild>
            <Link to="/">Back to store</Link>
          </Button>
        </div>
      )}

      {!started && (
        <div className="trial-intro">
          <Viewer3D colour={player.colour} className="trial-intro-viewer" />
          <div className="eyebrow">COSMETIC ONLY</div>
          <h2 className="mt-2">Take it for a Trial Run.</h2>
          <p>
            Play one round wearing the hoodie. Trial coins are not added. You get a one-time{" "}
            {CONFIG.trialBonus} coin bonus if you play at least {CONFIG.trialMinSeconds} seconds.
          </p>
          <Button
            className="w-full mt-3"
            onClick={() => {
              unlockAudio();
              sfx.swoosh();
              setStarted(true);
            }}
          >
            Start trial
          </Button>
          <Button
            variant="ghost"
            className="w-full mt-2"
            asChild
            onClick={() => track("trial_declined", { reward_id: "hoodie" })}
          >
            <Link to="/">Not now</Link>
          </Button>
        </div>
      )}

      <span className="sr-only" role="status">
        {stats.seconds} seconds remaining, {coins} {mode === "trial" ? "trial coins, not added" : "coins earned"},{" "}
        {stats.hearts} hearts.
      </span>
    </main>
  );
}
