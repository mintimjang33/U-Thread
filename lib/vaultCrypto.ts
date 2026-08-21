import crypto from 'node:crypto';

// BYOK Vault용 AES-256-GCM 암호화. 원본 사이트가 광고하는 "AES-256 암호화 저장"을 실제로 구현한다.
// VAULT_MASTER_KEY는 32바이트를 base64로 인코딩한 값이어야 한다 (openssl rand -base64 32로 생성).
function getMasterKey(): Buffer {
  const key = process.env.VAULT_MASTER_KEY;
  if (!key) throw new Error('VAULT_MASTER_KEY 환경변수가 필요합니다.');
  const buf = Buffer.from(key, 'base64');
  if (buf.length !== 32) throw new Error('VAULT_MASTER_KEY는 32바이트(base64)여야 합니다.');
  return buf;
}

export function encryptVaultValue(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getMasterKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // iv(12) + authTag(16) + ciphertext, 전부 base64로 이어붙여서 문자열 하나로 저장
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decryptVaultValue(payload: string): string {
  const raw = Buffer.from(payload, 'base64');
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', getMasterKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
