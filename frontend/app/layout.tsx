import type { Metadata } from "next";
import { JetBrains_Mono, Source_Serif_4, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";

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
  title: "Auto-Researcher | 自动科研控制台",
  description: "单用户自托管自动科研平台",
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
    <html lang="zh-CN">
      <body className={`${sans.variable} ${serif.variable} ${mono.variable} font-sans`}>
        {children}
      </body>
    </html>
  );
}
