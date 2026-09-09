import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Ara ilerleme "son giriş" göstergeleri için (BoyaciFlow/PlanFlow/ManagementFlow)
export function minutesAgo(iso) {
  if (!iso) return null;
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  return diff < 0 ? 0 : diff;
}
