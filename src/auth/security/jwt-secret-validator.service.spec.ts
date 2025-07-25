import { Test, TestingModule } from '@nestjs/testing';
import { JwtSecretValidatorService } from './jwt-secret-validator.service';

describe('JwtSecretValidatorService', () => {
  let service: JwtSecretValidatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JwtSecretValidatorService],
    }).compile();

    service = module.get<JwtSecretValidatorService>(JwtSecretValidatorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateJwtSecret', () => {
    it('should reject empty or null secrets', () => {
      const result1 = service.validateJwtSecret('');
      const result2 = service.validateJwtSecret(null as any);
      const result3 = service.validateJwtSecret(undefined as any);

      expect(result1.isValid).toBe(false);
      expect(result2.isValid).toBe(false);
      expect(result3.isValid).toBe(false);
    });

    it('should reject secrets that are too short', () => {
      const shortSecret = 'abc123'; // 6 caractères
      const result = service.validateJwtSecret(shortSecret);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('Secret trop court'));
    });

    it('should reject known weak secrets', () => {
      const weakSecrets = [
        'secret',
        'mysecret',
        'your-256-bit-secret',
        'jwt_secret'
      ];

      weakSecrets.forEach(secret => {
        const result = service.validateJwtSecret(secret);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(expect.stringContaining('Secret faible détecté'));
      });
    });

    it('should reject secrets with low entropy', () => {
      const lowEntropySecret = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'; // 34 a's
      const result = service.validateJwtSecret(lowEntropySecret);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('Entropie trop faible'));
    });

    it('should accept strong secrets', () => {
      const strongSecret = 'MySecureJwtSecret123!@#$%^&*()_+ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnop';
      const result = service.validateJwtSecret(strongSecret);

      expect(result.isValid).toBe(true);
      expect(result.strength).toBe('excellent');
      expect(result.score).toBeGreaterThan(80);
    });

    it('should calculate entropy correctly', () => {
      const uniformSecret = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#';
      const result = service.validateJwtSecret(uniformSecret);

      expect(result.entropy).toBeGreaterThan(4.0);
    });

    it('should provide warnings for medium strength secrets', () => {
      const mediumSecret = 'MyJwtSecret123456789012345678901234567890'; // Assez long mais pas de caractères spéciaux
      const result = service.validateJwtSecret(mediumSecret);

      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should provide recommendations for improvement', () => {
      const weakButValidSecret = 'MyJwtSecretThatIsLongEnoughButNotVeryStrong123456789012345';
      const result = service.validateJwtSecret(weakButValidSecret);

      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('generateSecureSecret', () => {
    it('should generate secrets of the correct length', () => {
      const secret32 = service.generateSecureSecret(32);
      const secret64 = service.generateSecureSecret(64);
      const secret128 = service.generateSecureSecret(128);

      expect(secret32.length).toBe(32);
      expect(secret64.length).toBe(64);
      expect(secret128.length).toBe(128);
    });

    it('should generate different secrets each time', () => {
      const secret1 = service.generateSecureSecret(64);
      const secret2 = service.generateSecureSecret(64);

      expect(secret1).not.toBe(secret2);
    });

    it('should generate secrets that pass validation', () => {
      const secret = service.generateSecureSecret(64);
      const validation = service.validateJwtSecret(secret);

      expect(validation.isValid).toBe(true);
      expect(validation.strength).toBe('excellent');
    });

    it('should include different character types', () => {
      const secret = service.generateSecureSecret(64);

      expect(secret).toMatch(/[a-z]/); // lowercase
      expect(secret).toMatch(/[A-Z]/); // uppercase
      expect(secret).toMatch(/\d/); // digits
      expect(secret).toMatch(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/); // special chars
    });
  });

  describe('security scoring', () => {
    it('should give higher scores to stronger secrets', () => {
      const weakSecret = 'myweaksecret1234567890123456789012';
      const strongSecret = 'MyStr0ng!JWT$ecr3t#2024@Pr0ducti0n&Security*Test!@#$%^&*()_+';

      const weakResult = service.validateJwtSecret(weakSecret);
      const strongResult = service.validateJwtSecret(strongSecret);

      expect(strongResult.score).toBeGreaterThan(weakResult.score);
    });

    it('should categorize strength correctly', () => {
      const generatedExcellent = service.generateSecureSecret(64);
      const resultExcellent = service.validateJwtSecret(generatedExcellent);
      
      expect(resultExcellent.strength).toBe('excellent');
    });
  });

  describe('edge cases', () => {
    it('should handle secrets with only special characters', () => {
      const specialOnlySecret = '!@#$%^&*()_+!@#$%^&*()_+!@#$%^&*()_+!@#$%^&*()_+';
      const result = service.validateJwtSecret(specialOnlySecret);

      // Should be valid but with warnings about lack of diversity
      expect(result.isValid || result.warnings.length > 0).toBe(true);
    });

    it('should handle very long secrets', () => {
      const veryLongSecret = service.generateSecureSecret(128);
      const result = service.validateJwtSecret(veryLongSecret);

      expect(result.isValid).toBe(true);
      expect(result.strength).toBe('excellent');
    });

    it('should detect repetitive patterns', () => {
      const repetitiveSecret = 'abcabcabcabcabcabcabcabcabcabcabcabc'; // 33 chars
      const result = service.validateJwtSecret(repetitiveSecret);

      expect(result.warnings.some(w => w.includes('Pattern faible'))).toBe(true);
    });
  });
});