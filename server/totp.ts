import { authenticator } from 'otplib';
import { encrypt, decrypt } from './crypto.js';

interface TotpConfig {
  digits: number;
  period: number;
  algorithm: string;
}

export class TotpService {
  private static getDefaultConfig(): TotpConfig {
    return {
      digits: parseInt(process.env.TOTP_DEFAULT_DIGITS || '6'),
      period: parseInt(process.env.TOTP_DEFAULT_PERIOD || '30'),
      algorithm: process.env.TOTP_DEFAULT_ALGO || 'SHA1',
    };
  }

  /**
   * Encrypt a Base32 TOTP secret for storage
   */
  static encryptSecret(secret: string): string {
    return encrypt(secret);
  }

  /**
   * Decrypt a TOTP secret from storage
   */
  static decryptSecret(encryptedSecret: string): string {
    return decrypt(encryptedSecret);
  }

  /**
   * Generate a TOTP code from configuration
   */
  static generateCode(config: {
    secret_enc: string;
    digits?: number;
    period?: number;
    algorithm?: string;
  }): { code: string; valid_for_seconds: number } {
    const defaults = TotpService.getDefaultConfig();
    
    // Decrypt and clean the secret
    const decryptedSecret = TotpService.decryptSecret(config.secret_enc);
    const secret = TotpService.cleanSecret(decryptedSecret);
    
    // Configure authenticator
    authenticator.options = {
      digits: config.digits || defaults.digits,
      step: config.period || defaults.period,
      algorithm: (config.algorithm || defaults.algorithm).toLowerCase() as any,
    };

    // Generate the current code
    const code = authenticator.generate(secret);
    
    // Calculate how long this code is valid for
    const now = Math.floor(Date.now() / 1000);
    const period = config.period || defaults.period;
    const validForSeconds = period - (now % period);

    return {
      code,
      valid_for_seconds: validForSeconds,
    };
  }

  /**
   * Clean and normalize a TOTP secret to RFC 4648 Base32 format
   */
  static cleanSecret(secret: string): string {
    // Strict allowlist: only valid Base32 characters (A-Z, 2-7)
    const cleaned = secret
      .toUpperCase()
      .replace(/[^A-Z2-7]/g, '');  // Remove everything except valid Base32 chars
    
    console.error('TOTP cleanSecret - original:', JSON.stringify(secret));
    console.error('TOTP cleanSecret - cleaned:', JSON.stringify(cleaned));
    
    return cleaned;
  }

  /**
   * Validate a TOTP secret (Base32 format) - simplified validation
   */
  static validateSecret(secret: string): boolean {
    try {
      const cleaned = TotpService.cleanSecret(secret);
      
      // Check minimum length (Base32 secrets should be at least 16 chars)
      if (cleaned.length < 16) {
        console.error('TOTP validation failed: secret too short (', cleaned.length, 'chars)');
        return false;
      }
      
      console.error('TOTP validateSecret - cleaned secret length:', cleaned.length);
      return true;
    } catch (error) {
      console.error('TOTP validation error:', error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  /**
   * Generate a random TOTP secret (for testing)
   */
  static generateRandomSecret(): string {
    return authenticator.generateSecret();
  }
}