import DOMPurify from "dompurify";
import {
  MIN_NAME_LENGTH,
  MAX_NAME_LENGTH,
  USERNAME_REGEX,
  MAX_QUESTION_LENGTH,
  MAX_OPTION_LENGTH,
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

  // Length validation
  if (
    trimmed.length < MIN_NAME_LENGTH ||
    trimmed.length > MAX_NAME_LENGTH
  ) {
    return "";
  }

  // Character whitelist validation
  if (!USERNAME_REGEX.test(trimmed)) {
    return "";
  }

  // Remove any HTML/script content
  return sanitizeText(trimmed);
}

/**
 * Validates and sanitizes quiz question text.
 * Enforces maximum length constraints.
 */
export function sanitizeQuestionText(text: string): string {
  if (!text || typeof text !== "string") {
    return "";
  }

  const sanitized = sanitizeText(text);

  // Length validation
  if (sanitized.length > MAX_QUESTION_LENGTH) {
    return sanitized.substring(0, MAX_QUESTION_LENGTH);
  }

  return sanitized;
}

/**
 * Validates and sanitizes quiz option text.
 * Enforces maximum length constraints.
 */
export function sanitizeOptionText(text: string): string {
  if (!text || typeof text !== "string") {
    return "";
  }

  const sanitized = sanitizeText(text);

  // Length validation
  if (sanitized.length > MAX_OPTION_LENGTH) {
    return sanitized.substring(0, MAX_OPTION_LENGTH);
  }

  return sanitized;
}

/**
 * Validates that a value is a safe integer.
 * Returns null if invalid.
 */
export function sanitizeInteger(
  value: unknown,
  min?: number,
  max?: number,
): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return null;
  }

  if (min !== undefined && value < min) {
    return null;
  }

  if (max !== undefined && value > max) {
    return null;
  }

  return value;
}

/**
 * Validates that a value is a safe float number.
 * Returns null if invalid.
 */
export function sanitizeFloat(
  value: unknown,
  min?: number,
  max?: number,
): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  if (min !== undefined && value < min) {
    return null;
  }

  if (max !== undefined && value > max) {
    return null;
  }

  return value;
}

/**
 * Sanitizes a discriminator (4-digit numeric code).
 */
export function sanitizeDiscriminator(discriminator: string): string {
  if (!discriminator || typeof discriminator !== "string") {
    return "";
  }

  const sanitized = sanitizeText(discriminator);

  // Discriminators should be 4 digits (e.g., "1234")
  if (/^\d{4}$/.test(sanitized)) {
    return sanitized;
  }

  return "";
}
