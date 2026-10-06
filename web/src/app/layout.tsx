import type { Metadata, Viewport } from "next";
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: { default: "Newsxis — real-time news for every place on Earth", template: "%s · Newsxis" },
  description: "Cixy listens to public radio and free news feeds around the world, writes the story, researches it, shows the other side, and reads it on air. By Apixis Family Company.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://newsxis.vercel.app"),
  openGraph: { siteName: "Newsxis", type: "website" },
  manifest: "/manifest.json",
};
export const viewport: Viewport = { themeColor: "#05070f", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="nx-main">{children}</main>
        <footer className="nx-footer">
          <span>© {new Date().getFullYear()} Newsxis · Apixis Family Company · Illinois</span>
          <a href="/about">About</a>
          <a href="/about#ai">AI-generated label</a>
          <a href="/about#corrections">Corrections</a>
          <a href="/support">Support · Complaints · Takedowns</a>
          <a href="/support?kind=ads">Advertise</a>
          <a href="https://www.apixis.dev" target="_blank" rel="noreferrer">Apixis world</a>
        </footer>
      </body>
    </html>
  );
}
