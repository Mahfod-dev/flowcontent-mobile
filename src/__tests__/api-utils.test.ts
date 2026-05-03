/**
 * Tests for JWT utility functions extracted from api.ts
 */

// Re-implement the pure functions here for unit testing
// (they are module-private in api.ts)

function decodeJwtPayload(token: string): { exp?: number; sub?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (payload.length % 4) payload += '=';
    const json = atob(payload);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function isTokenExpiringSoon(token: string, bufferSeconds = 60): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return false;
  return payload.exp * 1000 < Date.now() + bufferSeconds * 1000;
}

// Build a fake JWT with a given exp
function buildFakeJwt(payload: Record<string, any>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fakesig`;
}

describe('decodeJwtPayload', () => {
  it('decodes a valid JWT payload', () => {
    const token = buildFakeJwt({ sub: 'user-123', exp: 1700000000 });
    const result = decodeJwtPayload(token);
    expect(result).toEqual({ sub: 'user-123', exp: 1700000000 });
  });

  it('returns null for malformed tokens', () => {
    expect(decodeJwtPayload('not-a-jwt')).toBeNull();
    expect(decodeJwtPayload('')).toBeNull();
    expect(decodeJwtPayload('a.b')).toBeNull();
  });

  it('returns null for invalid base64', () => {
    expect(decodeJwtPayload('a.!!!.c')).toBeNull();
  });
});

describe('isTokenExpiringSoon', () => {
  it('returns true when token expires within buffer', () => {
    const expIn30s = Math.floor(Date.now() / 1000) + 30;
    const token = buildFakeJwt({ exp: expIn30s });
    expect(isTokenExpiringSoon(token, 60)).toBe(true);
  });

  it('returns false when token has plenty of time', () => {
    const expIn2h = Math.floor(Date.now() / 1000) + 7200;
    const token = buildFakeJwt({ exp: expIn2h });
    expect(isTokenExpiringSoon(token, 60)).toBe(false);
  });

  it('returns true when token is already expired', () => {
    const expPast = Math.floor(Date.now() / 1000) - 100;
    const token = buildFakeJwt({ exp: expPast });
    expect(isTokenExpiringSoon(token, 60)).toBe(true);
  });

  it('returns false when no exp claim', () => {
    const token = buildFakeJwt({ sub: 'user' });
    expect(isTokenExpiringSoon(token)).toBe(false);
  });
});
