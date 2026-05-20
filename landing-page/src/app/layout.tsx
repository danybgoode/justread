import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Panfleto - Distraction-Free RSS Reader",
  description: "The minimalist, distraction-free RSS reader. Stay updated without the noise. Zero algorithms, zero ads, zero distractions.",
  openGraph: {
    title: "Panfleto - Distraction-Free RSS Reader",
    description: "Stay updated without the noise. Zero algorithms, zero ads, zero distractions. Just you and your feeds in chronological order.",
    url: "https://panfleto.win",
    siteName: "Panfleto",
    images: [
      {
        url: "https://panfleto.win/panflo.png",
        width: 512,
        height: 512,
        alt: "Panflo Mascot Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Panfleto - Distraction-Free RSS Reader",
    description: "Stay updated without the noise. Zero algorithms, zero ads, zero distractions.",
    images: ["https://panfleto.win/panflo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
