import { Redirect, type Href } from "expo-router";
import React from "react";
import { NativeTabs } from "expo-router/unstable-native-tabs";

import { useAuth } from "@/lib/auth/auth-context";

import { useColorScheme } from "react-native";
import { Colors } from "@/constants/theme";

export default function TabsLayout() {
  const { status } = useAuth();
  const scheme = useColorScheme();
  const colors = Colors[scheme === "unspecified" ? "light" : scheme];

  if (status === "loading") return null;
  if (status !== "authenticated") {
    return <Redirect href={"/login" as Href} />;
  }

  return (
    <NativeTabs labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house.fill" renderingMode="original" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="courses">
        <NativeTabs.Trigger.Label>Courses</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="book.fill" renderingMode="original" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.fill" renderingMode="original" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
