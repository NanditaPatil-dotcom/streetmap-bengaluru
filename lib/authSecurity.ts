export const PASSWORD_RULES_MESSAGE =
  "Password must be 12-128 characters and include uppercase, lowercase, a number, and a symbol.";

const EMAIL_MAX_LENGTH = 254;
const NAME_MAX_LENGTH = 80;
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX_ATTEMPTS = 8;
const emailRule = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordRule =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,128}$/;

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const attempts = new Map<string, RateLimitEntry>();

export function normalizeEmail(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLowerCase();
}

export function isValidEmail(value: string) {
  return value.length > 0 && value.length <= EMAIL_MAX_LENGTH && emailRule.test(value);
}

export function normalizeName(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\s+/g, " ").slice(0, NAME_MAX_LENGTH);
}

export function isValidPassword(value: unknown) {
  return (
    typeof value === "string" &&
    value.length >= PASSWORD_MIN_LENGTH &&
    value.length <= PASSWORD_MAX_LENGTH &&
    passwordRule.test(value)
  );
}

export function getClientIp(req: Request) {
  const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = req.headers.get("x-real-ip")?.trim();

  return forwardedFor || realIp || "unknown";
}

export function isRateLimited(key: string) {
  const now = Date.now();

  for (const [entryKey, entry] of attempts.entries()) {
    if (entry.resetAt <= now) {
      attempts.delete(entryKey);
    }
  }

  const current = attempts.get(key);

  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + AUTH_WINDOW_MS });
    return false;
  }

  current.count += 1;
  return current.count > AUTH_MAX_ATTEMPTS;
}

export function clearRateLimit(key: string) {
  attempts.delete(key);
}
