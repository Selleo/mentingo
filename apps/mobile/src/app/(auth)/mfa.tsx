import { isAxiosError } from 'axios';
import { Redirect, type Href } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth/auth-context';

export default function MfaScreen() {
  const { status, verifyMFA } = useAuth();
  const [otp, setOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status !== 'mfaPending') {
    return <Redirect href={'/login' as Href} />;
  }

  async function handleSubmit() {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await verifyMFA(otp.trim());
    } catch (e) {
      const message = isAxiosError(e)
        ? ((e.response?.data as { message?: string })?.message ?? e.message)
        : e instanceof Error
          ? e.message
          : 'MFA verification failed';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.form}>
          <ThemedText type="title" style={styles.title}>
            Two-step verification
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary">
            Enter the 6-digit code from your authenticator app.
          </ThemedText>

          <ThemedView type="backgroundElement" style={styles.field}>
            <TextInput
              autoCapitalize="none"
              autoComplete="one-time-code"
              autoCorrect={false}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="123 456"
              style={styles.input}
              value={otp}
              onChangeText={setOtp}
              onSubmitEditing={handleSubmit}
            />
          </ThemedView>

          {error ? (
            <ThemedText type="small" style={styles.error}>
              {error}
            </ThemedText>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={submitting || otp.length < 6}
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.button,
              (submitting || otp.length < 6) && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}>
            {submitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <ThemedText type="smallBold" style={styles.buttonText}>
                Verify
              </ThemedText>
            )}
          </Pressable>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    justifyContent: 'center',
  },
  form: { gap: Spacing.three },
  title: { marginBottom: Spacing.two },
  field: { borderRadius: Spacing.two, paddingHorizontal: Spacing.three },
  input: { height: 48, fontSize: 18, letterSpacing: 4 },
  error: { color: '#d92d20' },
  button: {
    backgroundColor: '#3c87f7',
    height: 48,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: '#ffffff' },
});
