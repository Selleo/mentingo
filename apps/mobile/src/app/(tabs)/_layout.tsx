import { Redirect, type Href } from 'expo-router';
import React from 'react';

import AppTabs from '@/components/app-tabs';
import { useAuth } from '@/lib/auth/auth-context';

export default function TabsLayout() {
  const { status } = useAuth();

  if (status === 'loading') return null;
  if (status !== 'authenticated') {
    return <Redirect href={'/login' as Href} />;
  }

  return <AppTabs />;
}
