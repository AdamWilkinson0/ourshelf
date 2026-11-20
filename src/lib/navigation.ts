import { ShoppingBasket, HandHeart, ScanLine, Trophy, UserRound } from "lucide-react";
export const tabs = ["food", "grabs", "scan", "board", "profile"] as const;
export type Tab = (typeof tabs)[number];
export const nav = [
  { tab: "food", label: "My Food", icon: ShoppingBasket },
  { tab: "grabs", label: "Up for Grabs", icon: HandHeart },
  { tab: "scan", label: "Scan", icon: ScanLine },
  { tab: "board", label: "Leaderboard", icon: Trophy },
  { tab: "profile", label: "Profile", icon: UserRound },
] as const;
