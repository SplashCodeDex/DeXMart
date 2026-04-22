import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ChatActionRenderer } from './ChatActionRenderer';
import { ChatAction } from '../store';

// Mock the shared components
vi.mock('@/components/shared/ToolCallCard', () => ({
  ToolCallCard: ({ toolName, status }: any) => (
    <div data-testid="tool-call-card">
      <span>{toolName}</span>
      <span>{status}</span>
    </div>
  ),
}));

vi.mock('@/components/shared/ThinkingCard', () => ({
  ThinkingCard: ({ content, isStreaming }: any) => (
    <div data-testid="thinking-card">
      <span>{content}</span>
      {isStreaming && <span>Streaming</span>}
    </div>
  ),
}));

describe('ChatActionRenderer', () => {
  it('should render ToolCallCard for tool actions', () => {
    const action: ChatAction = {
      id: '1',
      type: 'tool',
      status: 'running',
      title: 'Get Weather',
      params: { location: 'London' },
      timestamp: Date.now(),
    };
    render(<ChatActionRenderer action={action} />);
    expect(screen.getByTestId('tool-call-card')).toBeDefined();
    expect(screen.getByText('Get Weather')).toBeDefined();
    expect(screen.getByText('running')).toBeDefined();
  });

  it('should render ThinkingCard for thinking actions', () => {
    const action: ChatAction = {
      id: '2',
      type: 'thinking',
      status: 'running',
      title: 'Thinking...',
      content: 'I am thinking about the weather',
      timestamp: Date.now(),
    };
    render(<ChatActionRenderer action={action} />);
    expect(screen.getByTestId('thinking-card')).toBeDefined();
    expect(screen.getByText('I am thinking about the weather')).toBeDefined();
  });
});
