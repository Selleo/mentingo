import { Redirect, Stack } from 'expo-router';
import React from 'react';

import { useAuth } from '@/lib/auth/auth-context';

export default function AuthLayout() {
  const { status } = useAuth();

  if (status === 'loading') return null;
  if (status === 'authenticated') {
    return <Redirect href="/" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
