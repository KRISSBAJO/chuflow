import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope } from "next/font/google";
import { Toaster } from "sonner";
import { landingFont } from "@/components/landing/landing-font";
import { PwaRoot } from "@/components/pwa/pwa-root";
import "./globals.css";

const headingFont = Fraunces({
  variable: "--font-heading",
  subsets: ["latin"],
});

const bodyFont = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ChuFlow",
  description: "From Membership to Ministry.",
  applicationName: "ChuFlow",
  appleWebApp: {
    capable: true,
    title: "ChuFlow",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  // Lets the bottom tab bar sit above the iPhone home indicator via env(safe-area-inset-bottom).
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${headingFont.variable} ${bodyFont.variable} ${landingFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <PwaRoot />
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
