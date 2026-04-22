import { Metadata } from 'next';
import React from 'react';

import { SessionsListFeature } from '@/features/sessions/SessionsListFeature';

export const metadata: Metadata = {
  title: 'Sessions | DeXMart 2026',
  description: 'Manage and monitor your autonomous agent sessions.',
};

export default function SessionsPage(): React.JSX.Element {
  return <SessionsListFeature />;
}
