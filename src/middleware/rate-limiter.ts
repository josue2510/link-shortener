import type { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  message: string;
  code: string;
}

interface RateLimitResult {
  isLimited: boolean;
  remaining: number;
  resetAt: number;
}

const CLEANUP_INTERVAL_MS = 60_000;

export class RateLimiterStore {
  private readonly entries = new Map<string, RateLimitEntry>();
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(windowMs: number, maxRequests: number) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.startCleanup();
  }

  check(key: string): RateLimitResult {
    const now = Date.now();
    const entry = this.entries.get(key);

    if (!entry || now >= entry.resetAt) {
      const resetAt = now + this.windowMs;
      this.entries.set(key, { count: 1, resetAt });
      return {
        isLimited: false,
        remaining: this.maxRequests - 1,
        resetAt,
      };
    }

    entry.count += 1;

    if (entry.count > this.maxRequests) {
      return {
        isLimited: true,
        remaining: 0,
        resetAt: entry.resetAt,
      };
    }

    return {
      isLimited: false,
      remaining: this.maxRequests - entry.count,
      resetAt: entry.resetAt,
    };
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.entries) {
        if (now >= entry.resetAt) {
          this.entries.delete(key);
        }
      }
    }, CLEANUP_INTERVAL_MS);

    // Allow the process to exit even if the timer is still running
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

export function createRateLimiter(options: RateLimiterOptions) {
  const store = new RateLimiterStore(options.windowMs, options.maxRequests);

  function rateLimiterMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const key = req.ip ?? 'unknown';
    const result = store.check(key);

    res.setHeader('X-RateLimit-Limit', options.maxRequests);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader(
      'X-RateLimit-Reset',
      Math.ceil(result.resetAt / 1000),
    );

    if (result.isLimited) {
      const retryAfterSec = Math.ceil(
        (result.resetAt - Date.now()) / 1000,
      );
      res.setHeader('Retry-After', retryAfterSec);

      res.status(429).json({
        success: false,
        error: {
          message: options.message,
          code: options.code,
        },
      });
      return;
    }

    next();
  }

  return rateLimiterMiddleware;
}

export const globalRateLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 100,
  message: 'Too many requests, please try again later',
  code: 'RATE_LIMIT_EXCEEDED',
});

export const createLinkRateLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 10,
  message: 'Too many link creation requests, please try again later',
  code: 'CREATION_RATE_LIMIT_EXCEEDED',
});
