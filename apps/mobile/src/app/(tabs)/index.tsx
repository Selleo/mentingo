import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth/auth-context';
import { getUserStatistics, type UserStatistics } from '@/lib/stats/stats-service';

export default function HomeScreen() {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getUserStatistics();
        if (!cancelled) setStats(data);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load statistics');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <ThemedText type="subtitle">
            Welcome{user?.firstName ? `, ${user.firstName}` : ''}
          </ThemedText>

          {loading && <ActivityIndicator style={styles.loader} />}
          {error && (
            <ThemedText type="small" themeColor="textSecondary">
              {error}
            </ThemedText>
          )}

          {stats && (
            <ThemedView style={styles.cardsGrid}>
              <StatCard label="Daily streak" value={`${stats.streak.current} days`} />
              <StatCard label="Longest streak" value={`${stats.streak.longest} days`} />
              <StatCard
                label="Avg. quiz score"
                value={formatPercent(stats.quizzes.averageScore)}
              />
              <StatCard
                label="Avg. course completion"
                value={formatPercent(stats.averageStats.courseStats.completionRate)}
              />
              <StatCard
                label="Avg. lesson completion"
                value={formatPercent(stats.averageStats.lessonStats.completionRate)}
              />
              <StatCard
                label="Courses completed"
                value={`${stats.averageStats.courseStats.completed} / ${stats.averageStats.courseStats.started}`}
              />
              <StatCard label="Quizzes taken" value={`${stats.quizzes.uniqueQuizzesTaken}`} />
              <StatCard
                label="Correct answers"
                value={`${stats.quizzes.totalCorrectAnswers} / ${stats.quizzes.totalQuestions}`}
              />
            </ThemedView>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="small" themeColor="textSecondary">
        {label.toUpperCase()}
      </ThemedText>
      <ThemedText type="subtitle">{value}</ThemedText>
    </ThemedView>
  );
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${Math.round(value)}%`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.four,
  },
  loader: {
    marginTop: Spacing.four,
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  card: {
    flexBasis: '47%',
    flexGrow: 1,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
});
