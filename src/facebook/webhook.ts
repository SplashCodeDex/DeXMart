import * as crypto from 'node:crypto';

/**
 * Validates the X-Hub-Signature-256 header sent by Facebook.
 * @param payload The raw stringified request body
 * @param signatureHeader The value of the X-Hub-Signature-256 header
 * @param appSecret The Facebook App Secret
 * @returns boolean true if valid
 */
export function validateFacebookSignature(payload: string, signatureHeader: string | string[] | undefined, appSecret: string): boolean {
  if (!signatureHeader || typeof signatureHeader !== 'string' || !signatureHeader.startsWith('sha256=')) {
    return false;
  }

  try {
    const expectedHash = crypto.createHmac('sha256', appSecret).update(payload).digest('hex');
    const expectedSignature = `sha256=${expectedHash}`;
    
    // Use timingSafeEqual to prevent timing attacks
    const a = Buffer.from(signatureHeader);
    const b = Buffer.from(expectedSignature);
    
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (err) {
    return false;
  }
}

/**
 * Handles the webhook setup challenge from Meta.
 * @param mode hub.mode from query
 * @param token hub.verify_token from query
 * @param challenge hub.challenge from query
 * @param myVerifyToken The verify token configured in DeXMart
 * @returns The challenge string if valid, null otherwise
 */
export function handleFacebookChallenge(mode: any, token: any, challenge: any, myVerifyToken: string): string | null {
  if (mode === 'subscribe' && token === myVerifyToken) {
    return String(challenge);
  }
  return null;
}

/**
 * Normalizes the nested Meta webhook payload into a flat array of messaging events.
 * @param body The parsed JSON body of the webhook
 * @returns Array of messaging events
 */
export function normalizeFacebookEvents(body: any): any[] {
  const events: any[] = [];
  if (body?.object === 'page' && Array.isArray(body.entry)) {
    for (const entry of body.entry) {
      if (Array.isArray(entry.messaging)) {
        for (const event of entry.messaging) {
          events.push(event);
        }
      }
    }
  }
  return events;
}
