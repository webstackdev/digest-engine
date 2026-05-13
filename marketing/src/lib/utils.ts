import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Dynamically combines CSS class names, preventing conflicts when
 * overriding Tailwind classes
 *
 * @param inputs CSS class names
 * @returns merged string of CSS class names
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
