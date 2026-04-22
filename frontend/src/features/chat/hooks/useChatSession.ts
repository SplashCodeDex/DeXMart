import { useGateway } from '@/lib/gateway/gateway-hooks';
import { useChatStore, ChatMessage, ChatAction } from '../store';
import { useCallback, useEffect } from 'react';

export function useChatSession(sessionKey: string = 'main') {
  const { rpc, status } = useGateway();
  const { 
    addMessage, 
    updateLastAssistantMessage, 
    upsertAction,
    setStreaming, 
    setError, 
    abort: storeAbort, 
    setAbortController 
  } = useChatStore();

  const sendMessage = useCallback(async (text: string) => {
    if (!rpc || !text.trim()) return;

    setError(null);
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    addMessage(userMsg);

    const runId = crypto.randomUUID();
    const controller = new AbortController();
    setAbortController(controller);

    try {
      setStreaming(true);
      await rpc.call('chat.send', {
        sessionKey,
        message: text,
        idempotencyKey: runId,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to send message');
      setStreaming(false);
      setAbortController(null);
    }
  }, [rpc, sessionKey, addMessage, setStreaming, setError, setAbortController]);

  const abort = useCallback(() => {
    if (rpc) {
      // Also notify backend
      rpc.call('chat.abort', { sessionKey }).catch(() => {});
    }
    storeAbort();
  }, [rpc, sessionKey, storeAbort]);

  useEffect(() => {
    if (!rpc) return;

    const unsubscribeChat = rpc.subscribe('chat', (payload) => {
      if (payload.state === 'delta') {
        const deltaText = typeof payload.message === 'string' 
          ? payload.message 
          : (payload.message as any)?.content?.[0]?.text || '';
        
        if (deltaText) {
          const state = useChatStore.getState();
          const lastMsg = state.messages[state.messages.length - 1];
          if (!lastMsg || lastMsg.role !== 'assistant' || lastMsg.runId !== payload.runId) {
            addMessage({
              id: payload.runId,
              role: 'assistant',
              content: deltaText,
              timestamp: Date.now(),
              runId: payload.runId,
            });
          } else {
            updateLastAssistantMessage(deltaText);
          }
        }
      } else if (payload.state === 'final') {
        setStreaming(false);
        setAbortController(null);
      } else if (payload.state === 'error') {
        setError(payload.errorMessage || 'Chat error');
        setStreaming(false);
        setAbortController(null);
      } else if (payload.state === 'aborted') {
        setStreaming(false);
        setAbortController(null);
      }
    });

    const unsubscribeAgent = rpc.subscribe('agent', (payload) => {
      const { stream, data, runId } = payload;
      
      if (stream === 'tool' || stream === 'item') {
        const statusMap: Record<string, ChatAction['status']> = {
          'start': 'running',
          'update': 'running',
          'end': 'success',
          'completed': 'success',
          'failed': 'error',
        };

        upsertAction(runId, {
          id: (data as any).itemId || `${runId}-${(data as any).kind || 'item'}`,
          type: (data as any).kind === 'tool' || stream === 'tool' ? 'tool' : 'thinking',
          status: statusMap[(data as any).phase] || statusMap[(data as any).status] || 'running',
          title: (data as any).title || (data as any).name || 'Agent Task',
          params: (data as any).params || (data as any).args,
          result: (data as any).result || (data as any).output,
          timestamp: payload.ts || Date.now(),
        });
      } else if (stream === 'thinking' && (data as any).text) {
        upsertAction(runId, {
          id: `${runId}-thinking`,
          type: 'thinking',
          status: 'running',
          title: 'Thinking',
          content: (data as any).text,
          timestamp: payload.ts || Date.now(),
        });
      }
    });

    return () => {
      unsubscribeChat();
      unsubscribeAgent();
    };
  }, [rpc, addMessage, updateLastAssistantMessage, upsertAction, setStreaming, setError, setAbortController]);

  return { sendMessage, abort, status };
}
