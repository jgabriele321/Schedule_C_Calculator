import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount)
}

export function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateString))
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes"
  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

export function getCategoryColor(category: string): string {
  const colors = {
    advertising: "bg-blue-900/60 text-blue-300",
    "car-expenses": "bg-green-900/60 text-green-300",
    equipment: "bg-purple-900/60 text-purple-300",
    insurance: "bg-orange-900/60 text-orange-300",
    meals: "bg-red-900/60 text-red-300",
    "office-supplies": "bg-yellow-900/60 text-yellow-300",
    software: "bg-indigo-900/60 text-indigo-300",
    travel: "bg-pink-900/60 text-pink-300",
    utilities: "bg-gray-800/60 text-gray-300",
    uncategorized: "bg-slate-800/60 text-slate-300",
  }
  return colors[category] || "bg-gray-800/60 text-gray-300"
}

export function getTypeColor(type: "expense" | "income"): string {
  return type === "expense" ? "bg-red-900/60 text-red-300" : "bg-green-900/60 text-green-300"
}
