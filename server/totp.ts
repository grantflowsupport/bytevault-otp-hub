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
    
    // Decrypt the secret
    const secret = TotpService.decryptSecret(config.secret_enc);
    
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
   * Validate a TOTP secret (Base32 format)
   */
  static validateSecret(secret: string): boolean {
    try {
      // Check if it's valid Base32
      const base32Regex = /^[A-Z2-7]+=*$/i;
      if (!base32Regex.test(secret)) {
        return false;
      }
      
      // Try to generate a code to ensure it works
      authenticator.options = TotpService.getDefaultConfig() as any;
      const testCode = authenticator.generate(secret);
      
      return testCode.length > 0;
    } catch (error) {
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