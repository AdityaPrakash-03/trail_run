export const CONFIG = {
  startingCoins: 0,
  coinsPerCatch: 5,
  hoodieCoins: 500,
  trialBonus: 50,
  trialMinSeconds: 15,
  roundSeconds: 30,
  hearts: 3,
  debugCoins: 100,
  eventCap: 2000,
  fallSpeedRamp: 0.2,
} as const;
export const MILESTONES = [25, 50, 75, 100] as const;
export type Colour = "Crimson" | "Navy";
export type Variant = "A" | "B";
export const REWARDS = [
  {
    id: "hoodie",
    name: "Everyday Streetwear Hoodie",
    short: "Hoodie",
    offer: "Redeem 500 coins for a Rs 1,499 hoodie voucher",
    cost: CONFIG.hoodieCoins,
    icon: "hoodie",
    code: "HOODIE",
  },
  {
    id: "food",
    name: "Food voucher",
    short: "Food voucher",
    offer: "Rs 150 off",
    cost: 150,
    icon: "food",
    code: "FOOD",
  },
  {
    id: "music",
    name: "Music app",
    short: "Music app",
    offer: "1 month free",
    cost: 300,
    icon: "music",
    code: "MUSIC",
  },
  {
    id: "earbuds",
    name: "Wireless earbuds discount",
    short: "Earbuds",
    offer: "Rs 500 off",
    cost: 800,
    icon: "earbuds",
    code: "EARBUDS",
  },
] as const;
export type RewardId = (typeof REWARDS)[number]["id"];
export const REWARD_IDS: RewardId[] = REWARDS.map((r) => r.id);
export const getReward = (id: RewardId | null) => REWARDS.find((r) => r.id === id);
