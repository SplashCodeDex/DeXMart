import React from 'react';
import { ChatAction } from '../store';
import { ToolCallCard } from '@/components/shared/ToolCallCard';
import { ThinkingCard } from '@/components/shared/ThinkingCard';

interface ChatActionRendererProps {
  action: ChatAction;
  isStreaming?: boolean;
}

export function ChatActionRenderer({ action, isStreaming }: ChatActionRendererProps) {
  if (action.type === 'tool') {
    return (
      <ToolCallCard
        toolName={action.title}
        params={action.params}
        result={action.result}
        status={action.status as any}
        defaultOpen={action.status === 'error'}
        className="my-2"
      />
    );
  }

  if (action.type === 'thinking') {
    return (
      <ThinkingCard
        content={action.content || action.title}
        isStreaming={action.status === 'running'}
        defaultOpen={true}
        className="my-2"
      />
    );
  }

  return null;
}
