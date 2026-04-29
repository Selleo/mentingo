import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import {
  getAvailableCourses,
  getStudentCourses,
  getTopCourses,
  type CourseSummary,
} from '@/lib/courses/courses-service';

type CoursesData = {
  available: CourseSummary[];
  student: CourseSummary[];
  top: CourseSummary[];
};

export default function CoursesScreen() {
  const [data, setData] = useState<CoursesData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [available, student, top] = await Promise.all([
          getAvailableCourses(),
          getStudentCourses(),
          getTopCourses(),
        ]);
        if (cancelled) return;
        setData({ available, student, top });
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load courses');
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
        <ThemedText type="subtitle">Courses</ThemedText>

        {loading && <ActivityIndicator style={styles.loader} />}
        {error && (
          <ThemedText type="small" themeColor="textSecondary">
            {error}
          </ThemedText>
        )}

        {data && (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            <CourseSection title="Continue learning" courses={data.student} />
            <CourseSection title="Top courses" courses={data.top} />
            <CourseSection title="Available courses" courses={data.available} />
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function CourseSection({ title, courses }: { title: string; courses: CourseSummary[] }) {
  return (
    <ThemedView style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {title.toUpperCase()}
      </ThemedText>
      {courses.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          No courses
        </ThemedText>
      ) : (
        courses.map((course) => (
          <ThemedText key={course.id} type="default">
            {course.title}
          </ThemedText>
        ))
      )}
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
    gap: Spacing.three,
  },
  loader: {
    marginTop: Spacing.four,
  },
  scrollContent: {
    gap: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
});
