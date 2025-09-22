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
      // Robust normalization: remove separators, whitespace, and zero-width characters
      const normalized = secret
        .trim()
        .toUpperCase()
        .replace(/[\s\-_:]/g, '')  // Remove spaces, hyphens, underscores, colons
        .replace(/[\u200B-\u200D\uFEFF]/g, '')  // Remove zero-width characters
        .replace(/=+$/, '');  // Remove trailing padding
      
      console.log('TOTP validateSecret - original:', JSON.stringify(secret));
      console.log('TOTP validateSecret - normalized:', JSON.stringify(normalized));
      
      // Validate by attempting to generate a code (most reliable method)
      const defaults = TotpService.getDefaultConfig();
      authenticator.options = {
        digits: defaults.digits,
        step: defaults.period,  // otplib uses 'step' not 'period'
        algorithm: (defaults.algorithm || 'sha1').toLowerCase() as any,  // otplib needs lowercase
      };
      
      console.log('TOTP validateSecret - authenticator options:', authenticator.options);
      
      const testCode = authenticator.generate(normalized);
      console.log('TOTP validateSecret - generated test code:', testCode);
      
      const isValid = Boolean(testCode && testCode.length > 0);
      console.log('TOTP validateSecret - final result:', isValid);
      
      return isValid;
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