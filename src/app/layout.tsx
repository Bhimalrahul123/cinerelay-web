
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://cinerelay.vercel.app"
  ),
  title: {
    default: "CineRelay — Discover Your Next Experience",
    template: "%s | CineRelay",
  },
  description:
    "Discover movie and event tickets on CineRelay. Explore listings, connect with other fans, and find your next experience.",
  applicationName: "CineRelay",
  keywords: [
    "CineRelay",
    "movie tickets",
    "event tickets",
    "ticket marketplace",
    "cinema",
    "events",
  ],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    siteName: "CineRelay",
    title: "CineRelay — Discover Your Next Experience",
    description:
      "Explore movie and event ticket listings and connect with other fans on CineRelay.",
  },
  twitter: {
    card: "summary_large_image",
    title: "CineRelay — Discover Your Next Experience",
    description:
      "Explore movie and event ticket listings on CineRelay.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#090a0c",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body>
        <div className="site-atmosphere" aria-hidden="true" />
        <div className="site-content">{children}</div>
      </body>
    </html>
  );
}
