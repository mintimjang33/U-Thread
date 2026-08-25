import crypto from 'node:crypto';

// 크롬 익스텐션 연동 키(JWT, HS256) — 서명/검증을 직접 구현해서 별도 의존성 없이 처리한다.
// 세션 쿠키가 없는 크롬 익스텐션(크로스-오리진)이 벤치마킹 API를 호출할 때 이 토큰을 쓴다.
function base64url(input: Buffer | string) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function base64urlDecode(input: string) {
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function getSecret() {
  const secret = process.env.EXTENSION_JWT_SECRET;
  if (!secret) throw new Error('EXTENSION_JWT_SECRET 환경변수가 설정되어 있지 않습니다.');
  return secret;
}

const ONE_YEAR_SEC = 365 * 24 * 60 * 60;

export function issueExtensionToken(userId: string): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(JSON.stringify({ sub: userId, iat: now, exp: now + ONE_YEAR_SEC }));
  const signature = base64url(crypto.createHmac('sha256', getSecret()).update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${signature}`;
}

export function verifyExtensionToken(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expected = base64url(crypto.createHmac('sha256', getSecret()).update(`${header}.${payload}`).digest());
  if (signature !== expected) return null;
  try {
    const decoded = JSON.parse(base64urlDecode(payload).toString('utf-8'));
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded.sub || null;
  } catch {
    return null;
  }
}
