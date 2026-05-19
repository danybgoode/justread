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
        url: "https://panfleto.win/article.png",
        width: 1200,
        height: 630,
        alt: "Panfleto minimalist article reading view",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Panfleto - Distraction-Free RSS Reader",
    description: "Stay updated without the noise. Zero algorithms, zero ads, zero distractions.",
    images: ["https://panfleto.win/article.png"],
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
