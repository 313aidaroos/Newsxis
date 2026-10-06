import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Text } from "react-native";
import { usePushRegistration } from "../lib/push";

const C = { bg: "#05070f", panel: "#0b1024", line: "rgba(120,150,220,0.18)", ink: "#e8f0ff", ink2: "#9fb0d6", accent: "#38e8ff" };

export default function Layout() {
  usePushRegistration();
  return (
    <>
      <StatusBar style="light" />
      <Tabs screenOptions={{ headerStyle: { backgroundColor: C.bg }, headerTitleStyle: { color: C.ink, fontWeight: "900", letterSpacing: 2 }, tabBarStyle: { backgroundColor: C.panel, borderTopColor: C.line }, tabBarActiveTintColor: C.accent, tabBarInactiveTintColor: C.ink2, headerShadowVisible: false }}>
        <Tabs.Screen name="index" options={{ title: "NEWSXIS", tabBarLabel: "Globe", tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>◉</Text> }} />
        <Tabs.Screen name="feed" options={{ title: "FEED", tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>≡</Text> }} />
        <Tabs.Screen name="radio" options={{ title: "RADIO", tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>♪</Text> }} />
        <Tabs.Screen name="cixy" options={{ title: "CIXY", tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>✦</Text> }} />
        <Tabs.Screen name="account" options={{ title: "ACCOUNT", tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>●</Text> }} />
      </Tabs>
    </>
  );
}
