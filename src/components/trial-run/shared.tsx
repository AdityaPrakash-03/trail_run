import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, Gamepad2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CONFIG, getReward, type RewardId } from "@/config";
import { hasRedeemed } from "@/lib/trial-state";
import { useTrial } from "./provider";
import { CoinIcon } from "./art";
export function Progress({ balance, cost }: { balance: number; cost: number }) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-label="Reward progress"
      aria-valuenow={Math.min(balance, cost)}
      aria-valuemin={0}
      aria-valuemax={cost}
    >
      <div
        className="progress-fill"
        ref={(el) => {
          if (el) el.style.width = `${Math.min(100, (balance / cost) * 100)}%`;
        }}
      />
      <i className="tick t25" />
      <i className="tick t50" />
      <i className="tick t75" />
    </div>
  );
}
export function ColourPicker() {
  const { player, setColour } = useTrial();
  return (
    <div className="swatches">
      <Button
        variant="swatch"
        className="swatch crimson"
        aria-label="Crimson"
        aria-pressed={player.colour === "Crimson"}
        onClick={() => setColour("Crimson")}
      />
      <Button
        variant="swatch"
        className="swatch navy"
        aria-label="Navy"
        aria-pressed={player.colour === "Navy"}
        onClick={() => setColour("Navy")}
      />
      <span className="swatch-caption">{player.colour}</span>
    </div>
  );
}
export function Back({ label = "Reward store" }: { label?: string }) {
  return (
    <div className="back-row">
      <Button variant="ghost" size="icon" asChild>
        <Link to="/" aria-label="Back to reward store">
          <ArrowLeft />
        </Link>
      </Button>
      <span>{label}</span>
    </div>
  );
}
export function GoalProgress({ id = "hoodie" }: { id?: RewardId }) {
  const { player } = useTrial();
  const reward = getReward(id);
  if (!reward) return null;
  return (
    <>
      <div className="progress-row">
        <span className="coin-label">
          <CoinIcon />
          {reward.cost} coins
        </span>
        <span className="text-muted-foreground">
          {Math.min(player.balance, reward.cost)} / {reward.cost}
        </span>
      </div>
      <Progress balance={player.balance} cost={reward.cost} />
      <p className="progress-caption">
        {hasRedeemed(player, id)
          ? "Redeemed"
          : player.balance >= reward.cost
            ? "You can redeem now"
            : `${reward.cost - player.balance} coins to go`}
      </p>
    </>
  );
}
export function RewardActions({ source }: { source: "store_card" | "details" }) {
  const { player, saveGoal } = useTrial();
  const navigate = useNavigate();
  const eligible = player.balance >= CONFIG.hoodieCoins;
  return (
    <div className="button-stack">
      {hasRedeemed(player, "hoodie") ? (
        <Button disabled>
          <Check />
          Redeemed
        </Button>
      ) : eligible && source === "details" ? (
        <Button onClick={() => navigate({ to: "/redeem", search: { reward: "hoodie" } })}>
          Redeem
          <ArrowRight />
        </Button>
      ) : (
        <>
          {player.variant === "B" && (
            <Button onClick={() => navigate({ to: "/trial" })}>
              <Gamepad2 />
              Try it in play
              <ArrowRight className="ml-auto" />
            </Button>
          )}
          <Button
            variant={player.variant === "B" ? "outline" : "default"}
            onClick={() => saveGoal("hoodie", source)}
          >
            {player.goal === "hoodie" ? (
              <>
                <Check />
                Saved as your goal
              </>
            ) : (
              "Save as goal"
            )}
          </Button>
        </>
      )}
    </div>
  );
}
export function PlayDock({ openDebug }: { openDebug: () => void }) {
  return (
    <div className="play-dock">
      <div className="dock-row">
        <Button variant="default" size="lg" className="play-button" asChild>
          <Link to="/play">
            <Gamepad2 />
            Play
            <ArrowRight className="ml-auto" />
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open debug and analytics"
          title="Debug and analytics"
          onClick={openDebug}
        >
          <Settings />
        </Button>
      </div>
      <p className="dock-note">30-second rounds. Coins carry over to your goal.</p>
    </div>
  );
}
export function Terms() {
  return (
    <ul className="terms">
      <li>Valid 30 days after redemption</li>
      <li>One voucher per player</li>
      <li>Size selected at checkout</li>
      <li>Delivery in 7 to 10 days</li>
      <li>Non-transferable</li>
    </ul>
  );
}
