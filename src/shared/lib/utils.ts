import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merges class names, letting a later Tailwind class win over an earlier one.
 *
 * `clsx` resolves the conditionals; `twMerge` then drops any class a later one
 * overrides, so a caller can pass `className` and expect it to take effect
 * rather than losing to a default it collides with.
 *
 * @param inputs Class names, arrays or conditional objects, in order.
 * @returns One class string with the collisions resolved.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
