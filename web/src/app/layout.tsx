import type { Metadata, Viewport } from "next";
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { Nav } from "@/components/Nav";
import { SITE_DESCRIPTION, SITE_NAME, publicSiteUrl } from "@/lib/public-site";

const siteUrl = publicSiteUrl();
const title = "Newsxis — real-time news for every place on Earth";

export const metadata: Metadata = {
  title: { default: title, template: "%s · Newsxis" },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  metadataBase: new URL(siteUrl),
  alternates: { canonical: "/" },
  openGraph: {
    siteName: SITE_NAME,
    type: "website",
    title,
    description: SITE_DESCRIPTION,
    url: siteUrl,
    images: [{ url: "/brand/og-image.png", width: 1200, height: 630, alt: "Newsxis" }],
  },
  twitter: { card: "summary_large_image", title, description: SITE_DESCRIPTION, images: ["/brand/og-image.png"] },
  icons: {
    icon: [
      { url: "/brand/favicon.ico", sizes: "any" },
      { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  robots: { index: true, follow: true },
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
          <span>© {new Date().getFullYear()} Newsxis · Apixis Dev LLC</span>
          <a href="/about">About</a>
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy</a>
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
