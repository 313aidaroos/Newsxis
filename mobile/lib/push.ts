/** Breaking-news push: registers the Expo push token with the site (needs a signed-in session in the WebView cookies). */
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { Platform } from "react-native";
import { SITE } from "./Site";

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }) });

export async function registerForPush(): Promise<string | null> {
  if (!Device.isDevice) return null;
  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return null;
  if (Platform.OS === "android") await Notifications.setNotificationChannelAsync("breaking", { name: "Breaking news", importance: Notifications.AndroidImportance.MAX, lightColor: "#ff3b5c" });
  const token = (await Notifications.getExpoPushTokenAsync()).data;
  // Best effort: the site's /api/alerts needs the person's session cookie (shared with the WebView on iOS/Android when sharedCookiesEnabled).
  await fetch(`${SITE}/api/alerts`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ channel: "expo", endpoint: { expo_token: token }, min_severity: 4 }), credentials: "include" }).catch(() => undefined);
  return token;
}

export function usePushRegistration() {
  useEffect(() => { registerForPush().catch(() => undefined); }, []);
}
