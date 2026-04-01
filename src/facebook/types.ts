export interface FacebookCredentials {
  pageAccessToken: string;
  appSecret?: string;
  verifyToken?: string;
  pageId?: string;
}

export interface FacebookSendResult {
  message_id: string;
  recipient_id: string;
}

export interface FacebookSendPayload {
  recipient: {
    id: string;
  };
  message: {
    text?: string;
    attachment?: any;
  };
  messaging_type?: 'RESPONSE' | 'UPDATE' | 'MESSAGE_TAG';
}
