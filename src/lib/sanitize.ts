import DOMPurify from "dompurify";
import {
  MIN_NAME_LENGTH,
  MAX_NAME_LENGTH,
  USERNAME_REGEX,
} from "../config/constants";

export function sanitizeText(text: string): string {
  if (!text) return "";
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
}

export function sanitizeTextArray(items: string[]): string[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => sanitizeText(item));
}

export function sanitizeUsername(name: string): string {
  if (!name || typeof name !== "string") {
    return "";
  }

  const trimmed = name.trim();

  if (
    trimmed.length < MIN_NAME_LENGTH ||
    trimmed.length > MAX_NAME_LENGTH
  ) {
    return "";
  }

  if (!USERNAME_REGEX.test(trimmed)) {
    return "";
  }

  return sanitizeText(trimmed);
}

/**
 * Sanitizes a discriminator (4-digit numeric code).
 */
export function sanitizeDiscriminator(discriminator: string): string {
  if (!discriminator || typeof discriminator !== "string") {
    return "";
  }

  const sanitized = sanitizeText(discriminator);

  if (/^\d{4}$/.test(sanitized)) {
    return sanitized;
  }

  return "";
}
