import type { Metadata, Viewport } from "next";
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { Nav } from "@/components/Nav";
import { FAMILY_COMPANIES, SITE_DESCRIPTION, SITE_NAME, publicSiteUrl } from "@/lib/public-site";

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
export const viewport: Viewport = { themeColor: "#f4f7fb", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="nx-main">{children}</main>
        <footer className="nx-footer">
          <div className="nx-footer-top">
            <div>
              <p className="nx-footer-brand">Newsxis</p>
              <p className="nx-tiny" style={{ margin: 0 }}>Real-time news for every place on Earth. Apixis Dev LLC.</p>
            </div>
            <nav className="nx-footer-links" aria-label="Footer">
              <a href="/about">About</a>
              <a href="/terms">Terms</a>
              <a href="/privacy">Privacy</a>
              <a href="/support">Support</a>
              <a href="/report">Daily report</a>
            </nav>
          </div>
          <div className="nx-family">
            <h2>Other Ixis companies</h2>
            <div className="nx-family-row">
              {FAMILY_COMPANIES.map((company) => <a key={company.name} href={company.href} target="_blank" rel="noreferrer">{company.name}</a>)}
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
