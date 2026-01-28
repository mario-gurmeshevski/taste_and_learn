/**
 * Custom cookie storage adapter for Supabase Auth
 * Uses cookies instead of localStorage for better mobile browser compatibility
 *
 * Follows Supabase's official storage adapter pattern:
 * https://supabase.com/docs/guides/auth/sessions/pkce-flow
 */

const COOKIE_NAME_PREFIX = 'sb-';
const COOKIE_OPTIONS = {
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 1 week in seconds
  sameSite: 'Lax' as const,
  secure: window.location.protocol === 'https:',
};

/**
 * Get a cookie value by name
 */
function getCookie(name: string): string | null {
  const matches = document.cookie.match(
    new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)')
  );
  return matches ? decodeURIComponent(matches[1]) : null;
}

/**
 * Set a cookie value with options
 */
function setCookie(name: string, value: string): void {
  let cookieString = `${name}=${encodeURIComponent(value)}`;

  if (COOKIE_OPTIONS.maxAge) {
    cookieString += `; max-age=${COOKIE_OPTIONS.maxAge}`;
  }

  if (COOKIE_OPTIONS.path) {
    cookieString += `; path=${COOKIE_OPTIONS.path}`;
  }

  if (COOKIE_OPTIONS.sameSite) {
    cookieString += `; samesite=${COOKIE_OPTIONS.sameSite}`;
  }

  if (COOKIE_OPTIONS.secure) {
    cookieString += '; secure';
  }

  document.cookie = cookieString;
}

/**
 * Delete a cookie by name
 */
function deleteCookie(name: string): void {
  document.cookie = `${name}=; path=/; max-age=0`;
}

/**
 * Custom storage adapter using cookies
 * Implements Supabase's StorageAdapter interface
 */
export const cookieStorageAdapter = {
  getItem: (key: string): string | null => {
    try {
      return getCookie(`${COOKIE_NAME_PREFIX}${key}`);
    } catch (error) {
      console.error('Error reading from cookie:', error);
      return null;
    }
  },

  setItem: (key: string, value: string): void => {
    try {
      setCookie(`${COOKIE_NAME_PREFIX}${key}`, value);
    } catch (error) {
      console.error('Error writing to cookie:', error);
    }
  },

  removeItem: (key: string): void => {
    try {
      deleteCookie(`${COOKIE_NAME_PREFIX}${key}`);
    } catch (error) {
      console.error('Error removing cookie:', error);
    }
  },
};
