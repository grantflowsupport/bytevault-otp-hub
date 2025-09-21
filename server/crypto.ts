import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const CRYPTO_SECRET_KEY = process.env.CRYPTO_SECRET_KEY!;

if (!CRYPTO_SECRET_KEY || CRYPTO_SECRET_KEY.length < 32) {
  throw new Error('CRYPTO_SECRET_KEY must be at least 32 characters long');
}

// Generate a 32-byte key from the secret
const key = createHash('sha256').update(CRYPTO_SECRET_KEY).digest();

export function encrypt(text: string): string {
  const iv = randomBytes(12); // 12 bytes for GCM
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(text, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  
  const authTag = cipher.getAuthTag();
  
  // Combine IV + authTag + encrypted data
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64');
}

export function decrypt(encryptedData: string): string {
  const combined = Buffer.from(encryptedData, 'base64');
  
  const iv = combined.subarray(0, 12);
  const authTag = combined.subarray(12, 28);
  const encrypted = combined.subarray(28);
  
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  
  return decrypted.toString('utf8');
}
