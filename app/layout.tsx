import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { Retune } from "retune";
import "./globals.css";
import "./panels.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const brunoAce = localFont({
  src: "../public/BrunoAce-Regular.woff2",
  variable: "--font-bruno-ace",
  weight: "400",
});

export const metadata: Metadata = {
  title: "Omni — trace the lineage of sound",
  description:
    "Search any music artist and travel backward to their roots or forward to the artists they shaped, on a living canvas of influence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${brunoAce.variable}`}
    >
      <body>
        {children}
        <Retune />
      </body>
    </html>
  );
}
