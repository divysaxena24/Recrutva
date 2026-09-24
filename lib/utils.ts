import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format and sanitize resume URLs for reliable PDF rendering across browsers.
 * Converts legacy Cloudinary image URLs by inserting `fl_attachment/` or raw resource paths
 * to prevent "Failed to load PDF document" browser errors.
 */
export function getValidResumeUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Fix legacy Cloudinary image upload URLs for PDFs/DOCs
  if (trimmed.includes("res.cloudinary.com") && trimmed.includes("/image/upload/")) {
    if (!trimmed.includes("fl_attachment")) {
      return trimmed.replace("/image/upload/", "/image/upload/fl_attachment/");
    }
  }

  return trimmed;
}
