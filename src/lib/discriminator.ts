/**
 * Discriminator utility for unique user identification
 * Similar to Discord's system: UserName#1234
 */

/**
 * Generates a 4-digit discriminator from a user ID
 * Uses the last 8 hex characters of the UUID (removes dashes)
 * This matches the SQL migration logic for consistency
 */
export function generateDiscriminator(userId: string): string {
  // Remove dashes and take last 8 characters
  const cleanId = userId.replace(/-/g, '');
  const lastChars = cleanId.slice(-8);

  // Convert hex to decimal and get last 4 digits
  let num = 0;
  try {
    num = parseInt(lastChars, 16);
  } catch {
    // Fallback: use character codes sum if hex conversion fails
    for (let i = 0; i < lastChars.length; i++) {
      num += lastChars.charCodeAt(i);
    }
  }

  return (num % 10000).toString().padStart(4, "0");
}

/**
 * Generates a full display name with discriminator
 * Format: "UserName#1234"
 */
export function generateDisplayName(userName: string, userId: string): string {
  const discriminator = generateDiscriminator(userId);
  return `${userName}#${discriminator}`;
}

/**
 * Extracts the base name from a display name
 * Returns the part before the # symbol
 */
export function extractBaseName(displayName: string): string {
  const parts = displayName.split("#");
  return parts[0];
}

/**
 * Validates if a display name has the correct format
 */
export function isValidDisplayName(displayName: string): boolean {
  const regex = /^.{1,50}#\d{4}$/;
  return regex.test(displayName);
}
