import { createElement } from "react";
import { Platform, View } from "react-native";
import { WebView } from "react-native-webview";

/**
 * Plays a YouTube video inside the app (16:9). The embed is loaded as an iframe in a page with a real
 * https origin - YouTube refuses to play embeds that arrive without a referrer (its "Error 153").
 */
export function YouTubePlayer({ videoId }: { videoId: string }) {
  const src = `https://www.youtube-nocookie.com/embed/${videoId}?playsinline=1&rel=0&modestbranding=1`;

  if (Platform.OS === "web") {
    return (
      <View className="aspect-video w-full overflow-hidden rounded-2xl bg-ink-900">
        {createElement("iframe", {
          src,
          style: { border: 0, width: "100%", height: "100%" },
          allow: "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture",
          allowFullScreen: true,
          referrerPolicy: "strict-origin-when-cross-origin",
          title: "YouTube video",
        })}
      </View>
    );
  }

  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;padding:0;height:100%;background:#000}iframe{border:0;width:100%;height:100%}</style></head>
<body><iframe src="${src}" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></body></html>`;

  return (
    <View className="aspect-video w-full overflow-hidden rounded-2xl bg-ink-900">
      <WebView
        source={{ html, baseUrl: "https://www.ogasela.com" }}
        allowsInlineMediaPlayback
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        scrollEnabled={false}
        style={{ backgroundColor: "#000" }}
        // Taps on YouTube's own links (title, logo) shouldn't navigate the player away.
        onShouldStartLoadWithRequest={(request) =>
          request.url.startsWith("https://www.ogasela.com") ||
          request.url.includes("youtube-nocookie.com/embed/") ||
          request.url === "about:blank"
        }
      />
    </View>
  );
}
