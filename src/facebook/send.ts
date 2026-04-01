import { FacebookCredentials, FacebookSendResult, FacebookSendPayload } from './types.js';

const FB_GRAPH_URL = 'https://graph.facebook.com/v20.0';

export async function sendMessageFacebook(
  target: string,
  content: string | { text?: string; attachment?: any },
  credentials: FacebookCredentials
): Promise<FacebookSendResult> {
  if (!credentials.pageAccessToken) {
    throw new Error('Facebook pageAccessToken is required to send messages.');
  }

  const pageId = credentials.pageId || 'me';
  const url = `${FB_GRAPH_URL}/${pageId}/messages?access_token=${credentials.pageAccessToken}`;

  const payload: FacebookSendPayload = {
    recipient: { id: target },
    message: typeof content === 'string' ? { text: content } : content,
    messaging_type: 'RESPONSE',
  };

  // Facebook Messenger text limit is 2000 characters. Implement chunking.
  const text = payload.message.text;
  if (text && text.length > 2000) {
    // Basic chunking by 2000 chars. 
    // A more robust implementation might split by newlines, but this fulfills the basic requirement.
    const chunks = text.match(/[\s\S]{1,2000}/g) || [];
    let lastResult: FacebookSendResult | null = null;
    
    for (const chunk of chunks) {
      payload.message.text = chunk;
      lastResult = await executeFacebookSend(url, payload);
    }
    return lastResult!;
  }

  return executeFacebookSend(url, payload);
}

async function executeFacebookSend(url: string, payload: FacebookSendPayload): Promise<FacebookSendResult> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Facebook API Error: ${JSON.stringify((data as any).error || data)}`);
  }

  return data as FacebookSendResult;
}
