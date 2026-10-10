import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isMuted, setMuted, sfx, subscribeSound, unlockAudio } from "@/game3d/audio";
import { CoinIcon } from "./art";
import { Debug } from "./debug";
import { PlayDock } from "./shared";
import { useTrial } from "./provider";

function Balance({ value, ready }: { value: number; ready: boolean }) {
  const [shown, setShown] = useState(value);
  const [bump, setBump] = useState(0);
  const from = useRef(value);
  const primed = useRef(false);
  useEffect(() => {
    if (!ready) return;
    if (!primed.current) {
      primed.current = true;
      from.current = value;
      setShown(value);
      return;
    }
    const a = from.current;
    if (value === a) return;
    if (value > a) setBump((n) => n + 1);
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / 650);
      const eased = 1 - Math.pow(1 - k, 3);
      const v = Math.round(a + (value - a) * eased);
      from.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ready]);
  return (
    <span
      key={bump}
      className={`balance ${bump > 0 ? "bump" : ""}`}
      aria-label={`Balance ${value} coins`}
    >
      <CoinIcon size={18} />
      <span className="num">{shown}</span>
      <span className="balance-unit">coins</span>
    </span>
  );
}

function SoundToggle() {
  const muted = useSyncExternalStore(subscribeSound, isMuted, () => false);
  return (
    <Button
      variant="ghost"
      size="icon"
      className="sound-toggle"
      aria-label={muted ? "Turn sound on" : "Turn sound off"}
      aria-pressed={!muted}
      onClick={() => {
        unlockAudio();
        setMuted(!muted);
        if (muted) window.setTimeout(() => sfx.ui(), 30);
      }}
    >
      {muted ? <VolumeX /> : <Volume2 />}
    </Button>
  );
}

export function AppShell({
  children,
  game = false,
  dock = false,
}: {
  children: ReactNode;
  game?: boolean;
  dock?: boolean;
}) {
  const { player, ready, storageError } = useTrial();
  const [debug, setDebug] = useState(false);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      unlockAudio();
      const el = e.target as HTMLElement | null;
      if (el?.closest("button, a, summary")) sfx.ui();
    };
    window.addEventListener("pointerdown", onDown, { capture: true });
    return () => window.removeEventListener("pointerdown", onDown, { capture: true });
  }, []);

  return (
    <div className={`app-frame ${game ? "is-game" : ""}`}>
      {!game && (
        <header className="app-header">
          <Link to="/" className="brand">
            <svg className="brand-mark" viewBox="0 0 30 34" fill="none" aria-hidden="true">
              <path d="M16 2L4 19H13L10 32L27 13H17L21 2Z" fill="currentColor" />
            </svg>
            Coin Catch
          </Link>
          <div className="header-right">
            <SoundToggle />
            <Balance value={player.balance} ready={ready} />
          </div>
        </header>
      )}
      {storageError && !game && (
        <div className="storage-warning">
          Your browser could not save this session. Progress may be lost on refresh.
        </div>
      )}
      {ready ? children : <div className="loading">Loading your rewards...</div>}
      {dock && !game && <PlayDock openDebug={() => setDebug(true)} />}
      {!game && !dock && (
        <button
          type="button"
          className="debug-fab"
          aria-label="Open debug and analytics"
          onClick={() => setDebug(true)}
        >
          Analytics
        </button>
      )}
      <Debug open={debug} onOpenChange={setDebug} />
    </div>
  );
}
