import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth/auth-context';

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ');

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle">Profile</ThemedText>

        <ThemedView type="backgroundElement" style={styles.card}>
          <Field label="Email" value={user?.email ?? '—'} />
          <Field label="Name" value={fullName || '—'} />
          <Field label="User ID" value={user?.id ?? '—'} />
        </ThemedView>

        <Pressable
          accessibilityRole="button"
          onPress={logout}
          style={({ pressed }) => [styles.logoutButton, pressed && styles.logoutPressed]}>
          <ThemedText type="smallBold">Sign out</ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <ThemedView style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary">
        {label.toUpperCase()}
      </ThemedText>
      <ThemedText type="default">{value}</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.four,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.three,
  },
  field: {
    gap: Spacing.one,
  },
  logoutButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#3c87f7',
  },
  logoutPressed: {
    opacity: 0.7,
  },
});
