import type { Metadata } from "next";
import { JetBrains_Mono, Source_Serif_4, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";

import { languageMeta } from "@/lib/i18n";

import "./globals.css";

const sans = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans"
});

const serif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-serif"
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono"
});

export const metadata: Metadata = {
  title: languageMeta.en.title,
  description: languageMeta.en.description,
  icons: {
    icon: "/icon.svg"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang={languageMeta.en.htmlLang}>
      <body className={`${sans.variable} ${serif.variable} ${mono.variable} font-sans`}>
        {children}
      </body>
    </html>
  );
}
