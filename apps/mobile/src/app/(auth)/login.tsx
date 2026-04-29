import { isAxiosError } from 'axios';
import { router, type Href } from 'expo-router';
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

export default function LoginScreen() {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const { mfaRequired } = await login(email.trim(), password);
      if (mfaRequired) {
        router.replace('/mfa' as Href);
      }
      // For non-MFA logins the (auth) layout redirects to /(tabs) on its own.
    } catch (e) {
      const message = isAxiosError(e)
        ? ((e.response?.data as { message?: string })?.message ?? e.message)
        : e instanceof Error
          ? e.message
          : 'Login failed';
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
            Sign in
          </ThemedText>

          <ThemedView type="backgroundElement" style={styles.field}>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="Email"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
            />
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.field}>
            <TextInput
              autoCapitalize="none"
              autoComplete="password"
              autoCorrect={false}
              placeholder="Password"
              secureTextEntry
              style={styles.input}
              value={password}
              onChangeText={setPassword}
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
            disabled={submitting || !email || !password}
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.button,
              (submitting || !email || !password) && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}>
            {submitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <ThemedText type="smallBold" style={styles.buttonText}>
                Sign in
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
  title: { marginBottom: Spacing.three },
  field: { borderRadius: Spacing.two, paddingHorizontal: Spacing.three },
  input: {
    height: 48,
    fontSize: 16,
  },
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
