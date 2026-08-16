import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit, resetRateLimits, clientIp } from './rate-limit';

beforeEach(() => resetRateLimits());

describe('checkRateLimit', () => {
  it('allows up to the limit, then blocks within the window', () => {
    const key = 'ip:1.2.3.4';
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true);
    }
    const blocked = checkRateLimit(key, 3, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it('is the backstop against sessionId rotation (keyed on IP, not session)', () => {
    // The same IP hitting the limit is blocked regardless of any session id.
    const key = 'chat:9.9.9.9';
    for (let i = 0; i < 5; i++) checkRateLimit(key, 5, 60_000);
    expect(checkRateLimit(key, 5, 60_000).allowed).toBe(false);
  });

  it('tracks separate windows per key', () => {
    checkRateLimit('a', 1, 60_000);
    expect(checkRateLimit('a', 1, 60_000).allowed).toBe(false);
    expect(checkRateLimit('b', 1, 60_000).allowed).toBe(true);
  });
});

describe('clientIp', () => {
  it('reads the first x-forwarded-for entry', () => {
    const req = new Request('http://x', { headers: { 'x-forwarded-for': '5.6.7.8, 1.1.1.1' } });
    expect(clientIp(req)).toBe('5.6.7.8');
  });
  it('falls back to a shared bucket when no ip header', () => {
    expect(clientIp(new Request('http://x'))).toBe('unknown');
  });
});
