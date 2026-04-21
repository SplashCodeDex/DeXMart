type Bot = {
  user: { id: string };
  decodeJid: (jid: string) => string;
};

type RawMessage = {
  key: {
    remoteJid?: string | null;
    fromMe?: boolean;
    id?: string;
    participant?: string;
  };
  message?: Record<string, unknown>;
};

type QuotedMessage = {
  sender: string;
  stanzaId?: string;
};

type SerializedMessage = {
  key: RawMessage["key"];
  sender: string;
  chat: string;
  fromMe: boolean;
  id: string;
  quoted?: QuotedMessage;
};

export function serialize(bot: Bot, rawMsg: RawMessage): SerializedMessage {
  const key = rawMsg.key;
  const remoteJid = key.remoteJid ?? "";
  const fromMe = key.fromMe ?? false;

  const sender = key.participant ? key.participant : remoteJid;
  const chat = remoteJid;

  let quoted: QuotedMessage | undefined;
  const msgContent = rawMsg.message ?? {};
  for (const content of Object.values(msgContent)) {
    if (content && typeof content === "object" && "contextInfo" in content) {
      const ctx = (content as Record<string, unknown>).contextInfo as Record<string, unknown>;
      if (ctx?.quotedMessage) {
        quoted = {
          sender: (ctx.participant as string) ?? "",
          stanzaId: ctx.stanzaId as string | undefined,
        };
        break;
      }
    }
  }

  return {
    key,
    sender,
    chat,
    fromMe,
    id: key.id ?? "",
    quoted,
  };
}
