import { Metadata } from 'next';
import React from 'react';

import { SessionDetailFeature } from '@/features/sessions/SessionDetailFeature';

interface SessionPageProps {
  params: Promise<{
    id: string;
  }>;
}

export const metadata: Metadata = {
  title: 'Session Detail | DeXMart 2026',
  description: 'Detailed view of an autonomous agent session.',
};

export default async function SessionPage({ params }: SessionPageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  return <SessionDetailFeature sessionId={id} />;
}
