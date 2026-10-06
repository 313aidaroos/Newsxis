/**
 * The app shows the Newsxis site inside a native shell (Phase 1), so every feature ships on web and
 * mobile at once; native push notifications and background audio come from the shell. Phase 2 moves
 * the globe and feed to native screens (react-native-maps / Mapbox) reusing the same /api/* routes.
 */
import Constants from "expo-constants";
import { useRef, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

export const SITE = ((Constants.expoConfig?.extra as { siteUrl?: string } | undefined)?.siteUrl ?? "https://newsxis.vercel.app").replace(/\/$/, "");

export function Site({ path }: { path: string }) {
  const [loading, setLoading] = useState(true);
  const ref = useRef<WebView>(null);
  return (
    <View style={styles.wrap}>
      <WebView ref={ref} source={{ uri: `${SITE}${path}` }} style={styles.web} onLoadEnd={() => setLoading(false)}
        allowsBackForwardNavigationGestures sharedCookiesEnabled thirdPartyCookiesEnabled mediaPlaybackRequiresUserAction={false} allowsInlineMediaPlayback
        applicationNameForUserAgent="NewsxisApp/0.1"
        onShouldStartLoadWithRequest={(req) => {
          // Keep the site, Apixis ID and the Wallet inside the app; open everything else in the browser.
          const ok = req.url.startsWith(SITE) || /apixis-wallet\.vercel\.app|apixis\.dev|supabase\.co/.test(req.url);
          if (!ok) Linking.openURL(req.url);
          return ok;
        }} />
      {loading && <ActivityIndicator color="#38e8ff" style={styles.spin} />}
    </View>
  );
}
const styles = StyleSheet.create({ wrap: { flex: 1, backgroundColor: "#05070f" }, web: { flex: 1, backgroundColor: "#05070f" }, spin: { position: "absolute", top: 20, alignSelf: "center" } });
