import { Stack, router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, Spacing } from "@/constants/theme";
import { getCourse, type CourseDetail } from "@/lib/courses/courses-service";

export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      try {
        const data = await getCourse(id);
        if (!cancelled) setCourse(data);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load course");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button icon="square.and.arrow.up" onPress={() => Alert.alert("Share")} />
      </Stack.Toolbar>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button icon="chevron.left" onPress={() => router.back()} />
      </Stack.Toolbar>

      <ThemedView style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {loading && <ActivityIndicator style={styles.loader} />}
          {error && (
            <ThemedText type="small" themeColor="textSecondary">
              {error}
            </ThemedText>
          )}

          {course && (
            <>
              <ThemedText type="subtitle">{course.title}</ThemedText>

              {course.chapters.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  No chapters
                </ThemedText>
              ) : (
                course.chapters.map((chapter) => (
                  <ThemedView key={chapter.id} style={styles.chapter}>
                    <ThemedText type="smallBold">{chapter.title}</ThemedText>
                    {chapter.lessons.length === 0 ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        No lessons
                      </ThemedText>
                    ) : (
                      chapter.lessons.map((lesson) => (
                        <ThemedText key={lesson.id} type="default" style={styles.lesson}>
                          {lesson.title}
                        </ThemedText>
                      ))
                    )}
                  </ThemedView>
                ))
              )}
            </>
          )}
        </ScrollView>
      </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  loader: {
    marginTop: Spacing.four,
  },
  chapter: {
    gap: Spacing.two,
    paddingTop: Spacing.three,
  },
  lesson: {
    paddingLeft: Spacing.three,
  },
});
