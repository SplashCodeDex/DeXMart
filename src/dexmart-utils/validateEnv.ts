import logger from './logger.js';

/**
 * Environment Variable Validation
 * Validates required environment variables on startup
 * 2026 Edition - Production Safety
 */

interface EnvValidationRule {
  name: string;
  required: boolean;
  defaultValue?: string;
  validator?: (value: string) => boolean;
  description: string;
}

const envRules: EnvValidationRule[] = [
  // Firebase Configuration
  {
    name: 'FIREBASE_SERVICE_ACCOUNT_PATH',
    required: false,
    description: 'Path to Firebase service account JSON file'
  },
  {
    name: 'FIREBASE_PROJECT_ID',
    required: false,
    description: 'Firebase project ID for database and authentication'
  },
  {
    name: 'FIREBASE_CLIENT_EMAIL',
    required: false,
    description: 'Firebase service account client email'
  },
  {
    name: 'FIREBASE_PRIVATE_KEY',
    required: false,
    description: 'Firebase service account private key'
  },

  // Google AI Configuration
  {
    name: 'GOOGLE_GEMINI_API_KEY',
    required: true,
    description: 'Google Gemini AI API key for AI features'
  },

  // Server Configuration
  {
    name: 'PORT',
    required: false,
    defaultValue: '3001',
    validator: (value) => !isNaN(parseInt(value)) && parseInt(value) > 0 && parseInt(value) < 65536,
    description: 'Server port number'
  },
  {
    name: 'NODE_ENV',
    required: false,
    defaultValue: 'development',
    validator: (value) => ['development', 'production', 'test'].includes(value),
    description: 'Node environment (development, production, test)'
  },

  // JWT Configuration
  {
    name: 'JWT_SECRET',
    required: true,
    validator: (value) => value.length >= 32,
    description: 'JWT secret key (minimum 32 characters)'
  },

  // Stripe Configuration (optional but recommended for production)
  {
    name: 'STRIPE_SECRET_KEY',
    required: false,
    description: 'Stripe secret key for payment processing'
  },
  {
    name: 'STRIPE_WEBHOOK_SECRET',
    required: false,
    description: 'Stripe webhook secret for secure webhook verification'
  },

  // Redis Configuration (optional)
  {
    name: 'REDIS_URL',
    required: false,
    description: 'Redis connection URL for caching'
  },

  // Rate Limiting
  {
    name: 'RATE_LIMIT_AI_REQ',
    required: false,
    defaultValue: '10',
    validator: (value) => !isNaN(parseInt(value)) && parseInt(value) > 0,
    description: 'AI requests rate limit per window'
  },

  // Baileys Configuration
  {
    name: 'USE_BAILEYS_DIRECT',
    required: false,
    defaultValue: 'false',
    validator: (value) => ['true', 'false'].includes(value.toLowerCase()),
    description: 'Use Baileys direct connection mode'
  }
];

interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  missingRequired: string[];
  invalidValues: string[];
}

/**
 * Validate all environment variables
 */
export function validateEnvironment(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const missingRequired: string[] = [];
  const invalidValues: string[] = [];

  logger.info('🔍 Validating environment variables...');

  for (const rule of envRules) {
    const value = process.env[rule.name];

    // Check if required variable is missing
    if (rule.required && !value) {
      const error = `Missing required environment variable: ${rule.name} - ${rule.description}`;
      errors.push(error);
      missingRequired.push(rule.name);
      logger.error(`❌ ${error}`);
      continue;
    }

    // Set default value if not provided
    if (!value && rule.defaultValue) {
      process.env[rule.name] = rule.defaultValue;
      warnings.push(`Using default value for ${rule.name}: ${rule.defaultValue}`);
      logger.warn(`⚠️  ${rule.name} not set, using default: ${rule.defaultValue}`);
      continue;
    }

    // Validate value if validator is provided
    if (value && rule.validator) {
      if (!rule.validator(value)) {
        const error = `Invalid value for ${rule.name}: ${value} - ${rule.description}`;
        errors.push(error);
        invalidValues.push(rule.name);
        logger.error(`❌ ${error}`);
        continue;
      }
    }

    // Log successful validation
    if (value) {
      const displayValue = rule.name.toLowerCase().includes('key') || rule.name.toLowerCase().includes('secret')
        ? '***[REDACTED]***'
        : value;
      logger.info(`✅ ${rule.name}: ${displayValue}`);
    }
  }

  // Custom multi-variable dependency checks
  const hasFirebasePath = !!process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const hasFirebaseVars = !!(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);

  if (!hasFirebasePath && !hasFirebaseVars) {
    const error = 'Missing Firebase credentials. Provide either FIREBASE_SERVICE_ACCOUNT_PATH or (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY)';
    errors.push(error);
    logger.error(`❌ ${error}`);
  }

  // Log warnings for optional but recommended variables
  const productionWarnings = [];
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.STRIPE_SECRET_KEY) {
      productionWarnings.push('STRIPE_SECRET_KEY not set - payment processing will be disabled');
    }
    if (!process.env.REDIS_URL) {
      productionWarnings.push('REDIS_URL not set - using in-memory cache (not recommended for production)');
    }
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      productionWarnings.push('STRIPE_WEBHOOK_SECRET not set - webhook verification will fail');
    }
  }

  if (productionWarnings.length > 0) {
    logger.warn('⚠️  Production warnings:');
    productionWarnings.forEach(warning => {
      logger.warn(`   - ${warning}`);
      warnings.push(warning);
    });
  }

  const success = errors.length === 0;

  if (success) {
    logger.info('✅ Environment validation passed!');
  } else {
    logger.error('❌ Environment validation failed!');
    logger.error(`   Missing required variables: ${missingRequired.join(', ')}`);
    if (invalidValues.length > 0) {
      logger.error(`   Invalid values: ${invalidValues.join(', ')}`);
    }
  }

  return {
    success,
    errors,
    warnings,
    missingRequired,
    invalidValues
  };
}

/**
 * Validate and throw if validation fails (for startup)
 */
export function validateEnvironmentOrThrow(): void {
  const result = validateEnvironment();

  if (!result.success) {
    const errorMessage = `
╔════════════════════════════════════════════════════════════════╗
║           ENVIRONMENT VALIDATION FAILED                        ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║  The application cannot start due to missing or invalid        ║
║  environment variables. Please check your .env file.           ║
║                                                                ║
╠════════════════════════════════════════════════════════════════╣
║  ERRORS:                                                       ║
${result.errors.map(e => `║  - ${e.padEnd(60)} ║`).join('\n')}
║                                                                ║
╠════════════════════════════════════════════════════════════════╣
║  REQUIRED VARIABLES:                                           ║
${envRules.filter(r => r.required).map(r => `║  - ${r.name.padEnd(30)} ${r.description.substring(0, 28).padEnd(28)} ║`).join('\n')}
╚════════════════════════════════════════════════════════════════╝
`;
    console.error(errorMessage);
    throw new Error('Environment validation failed. Application cannot start.');
  }

  if (result.warnings.length > 0) {
    logger.warn(`Environment validation passed with ${result.warnings.length} warning(s)`);
  }
}

export default validateEnvironmentOrThrow;
