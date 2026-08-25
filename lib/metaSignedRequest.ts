import crypto from 'node:crypto';

// Meta가 제거/삭제 콜백에 POST하는 signed_request(payload.signature, base64url + HMAC-SHA256)를 검증/파싱한다.
// 참고: https://developers.facebook.com/docs/reference/login/signed-request/
function base64urlDecode(input: string) {
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

export function parseSignedRequest(signedRequest: string, appSecret: string): { user_id?: string; [key: string]: unknown } | null {
  const parts = signedRequest.split('.');
  if (parts.length !== 2) return null;
  const [encodedSig, encodedPayload] = parts;

  const expectedSig = crypto
    .createHmac('sha256', appSecret)
    .update(encodedPayload)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  if (expectedSig !== encodedSig) return null;

  try {
    return JSON.parse(base64urlDecode(encodedPayload).toString('utf-8'));
  } catch {
    return null;
  }
}
