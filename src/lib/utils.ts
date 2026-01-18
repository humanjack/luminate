import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function estimateReadingTime(text: string, wordsPerMinute = 150): number {
  const words = text.trim().split(/\s+/).length;
  return Math.ceil((words / wordsPerMinute) * 60);
}

export function generateId(): string {
  return crypto.randomUUID();
}
