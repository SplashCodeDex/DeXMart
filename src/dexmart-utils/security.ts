import crypto from 'crypto';

/**
 * Validate WhatsApp webhook signature
 * @param {Object} body - Request body
 * @param {string} signature - X-Hub-Signature-256 header
 * @returns {boolean} - Whether signature is valid
 */
export function validateWhatsAppSignature(body: any, signature: string) {
  if (!signature || !process.env.WHATSAPP_APP_SECRET) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', process.env.WHATSAPP_APP_SECRET)
    .update(JSON.stringify(body))
    .digest('hex');

  const signatureHash = signature.replace('sha256=', '');

  return crypto.timingSafeEqual(
    Buffer.from(signatureHash, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

/**
 * Generate secure random token
 * @param {number} length - Token length
 * @returns {string} - Random token
 */
export function generateSecureToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash sensitive data
 * @param {string} data - Data to hash
 * @returns {string} - Hashed data
 */
export function hashData(data: string) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Validate API key format
 * @param {string} apiKey - API key to validate
 * @returns {boolean} - Whether API key format is valid
 */
export function validateApiKey(apiKey: string) {
  // WhatsApp API key format validation
  const whatsappApiKeyRegex = /^EAA[0-9A-Za-z]+$/;
  return whatsappApiKeyRegex.test(apiKey);
}
