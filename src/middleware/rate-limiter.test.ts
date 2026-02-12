import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { RateLimiterStore, createRateLimiter } from './rate-limiter.js';
import type { Request, Response, NextFunction } from 'express';

describe('RateLimiterStore', () => {
  let store: RateLimiterStore;

  afterEach(() => {
    store?.destroy();
  });

  it('should allow requests under the limit', () => {
    store = new RateLimiterStore(60_000, 5);

    const result = store.check('192.168.1.1');

    assert.equal(result.isLimited, false);
    assert.equal(result.remaining, 4);
    assert.ok(result.resetAt > Date.now());
  });

  it('should decrement remaining count on each request', () => {
    store = new RateLimiterStore(60_000, 3);

    const first = store.check('192.168.1.1');
    const second = store.check('192.168.1.1');
    const third = store.check('192.168.1.1');

    assert.equal(first.remaining, 2);
    assert.equal(second.remaining, 1);
    assert.equal(third.remaining, 0);
    assert.equal(third.isLimited, false);
  });

  it('should block requests over the limit', () => {
    store = new RateLimiterStore(60_000, 2);

    store.check('192.168.1.1');
    store.check('192.168.1.1');
    const result = store.check('192.168.1.1');

    assert.equal(result.isLimited, true);
    assert.equal(result.remaining, 0);
  });

  it('should track different keys independently', () => {
    store = new RateLimiterStore(60_000, 1);

    store.check('192.168.1.1');
    const blockedResult = store.check('192.168.1.1');
    const otherResult = store.check('192.168.1.2');

    assert.equal(blockedResult.isLimited, true);
    assert.equal(otherResult.isLimited, false);
    assert.equal(otherResult.remaining, 0);
  });

  it('should reset after the time window expires', () => {
    store = new RateLimiterStore(100, 1);

    store.check('192.168.1.1');
    const blockedResult = store.check('192.168.1.1');
    assert.equal(blockedResult.isLimited, true);

    // Wait for window to expire
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const resetResult = store.check('192.168.1.1');
        assert.equal(resetResult.isLimited, false);
        assert.equal(resetResult.remaining, 0);
        resolve();
      }, 150);
    });
  });
});

describe('createRateLimiter middleware', () => {
  function createMockReq(ip = '127.0.0.1'): Request {
    return { ip } as unknown as Request;
  }

  function createMockRes(): Response & {
    headers: Record<string, string | number>;
    statusCode: number;
    body: unknown;
  } {
    const res = {
      headers: {} as Record<string, string | number>,
      statusCode: 200,
      body: null as unknown,
      setHeader(name: string, value: string | number) {
        res.headers[name] = value;
        return res;
      },
      status(code: number) {
        res.statusCode = code;
        return res;
      },
      json(data: unknown) {
        res.body = data;
        return res;
      },
    };
    return res as unknown as Response & {
      headers: Record<string, string | number>;
      statusCode: number;
      body: unknown;
    };
  }

  it('should call next() when under the limit', () => {
    const middleware = createRateLimiter({
      windowMs: 60_000,
      maxRequests: 5,
      message: 'Rate limited',
      code: 'RATE_LIMITED',
    });

    const req = createMockReq();
    const res = createMockRes();
    let nextCalled = false;
    const next: NextFunction = (() => {
      nextCalled = true;
    }) as NextFunction;

    middleware(req, res, next);

    assert.equal(nextCalled, true);
    assert.equal(res.headers['X-RateLimit-Limit'], 5);
    assert.equal(res.headers['X-RateLimit-Remaining'], 4);
    assert.ok(res.headers['X-RateLimit-Reset']);
  });

  it('should return 429 when over the limit', () => {
    const middleware = createRateLimiter({
      windowMs: 60_000,
      maxRequests: 2,
      message: 'Too many requests',
      code: 'RATE_LIMIT_EXCEEDED',
    });

    const req = createMockReq();
    const res = createMockRes();
    const next: NextFunction = (() => {}) as NextFunction;

    middleware(req, res, next);
    middleware(req, res, next);

    // Third request should be blocked
    const blockedRes = createMockRes();
    let nextCalledOnBlocked = false;
    const blockedNext: NextFunction = (() => {
      nextCalledOnBlocked = true;
    }) as NextFunction;

    middleware(req, blockedRes, blockedNext);

    assert.equal(nextCalledOnBlocked, false);
    assert.equal(blockedRes.statusCode, 429);
    assert.deepEqual(blockedRes.body, {
      success: false,
      error: {
        message: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
      },
    });
    assert.equal(blockedRes.headers['X-RateLimit-Remaining'], 0);
    assert.ok(blockedRes.headers['Retry-After']);
  });

  it('should set rate limit headers on every response', () => {
    const middleware = createRateLimiter({
      windowMs: 60_000,
      maxRequests: 10,
      message: 'Rate limited',
      code: 'RATE_LIMITED',
    });

    const req = createMockReq();
    const res = createMockRes();
    const next: NextFunction = (() => {}) as NextFunction;

    middleware(req, res, next);

    assert.equal(res.headers['X-RateLimit-Limit'], 10);
    assert.equal(res.headers['X-RateLimit-Remaining'], 9);
    assert.equal(typeof res.headers['X-RateLimit-Reset'], 'number');
  });

  it('should use req.ip as the identifier key', () => {
    const middleware = createRateLimiter({
      windowMs: 60_000,
      maxRequests: 1,
      message: 'Rate limited',
      code: 'RATE_LIMITED',
    });

    const next: NextFunction = (() => {}) as NextFunction;

    // First IP exhausts its limit
    const req1 = createMockReq('10.0.0.1');
    middleware(req1, createMockRes(), next);
    const blockedRes = createMockRes();
    middleware(req1, blockedRes, next);
    assert.equal(blockedRes.statusCode, 429);

    // Second IP still has its full allowance
    const req2 = createMockReq('10.0.0.2');
    const allowedRes = createMockRes();
    let nextCalled = false;
    const allowedNext: NextFunction = (() => {
      nextCalled = true;
    }) as NextFunction;
    middleware(req2, allowedRes, allowedNext);
    assert.equal(nextCalled, true);
    assert.equal(allowedRes.headers['X-RateLimit-Remaining'], 0);
  });
});
