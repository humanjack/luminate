import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { SkipLink } from "@/components/ui/skip-link";

const inter = Inter({ subsets: ["latin"] });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const DESCRIPTION =
  "Create professional YouTube videos with AI-powered research, content, slides, narration, and production tools.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Luminate — YouTube Video Automation",
    template: "%s · Luminate",
  },
  description: DESCRIPTION,
  applicationName: "Luminate",
  openGraph: {
    title: "Luminate — YouTube Video Automation",
    description: DESCRIPTION,
    url: "/",
    siteName: "Luminate",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Luminate — YouTube Video Automation",
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before paint to avoid a flash of the wrong
            color scheme. Mirrors src/lib/theme.ts. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('luminate-theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`,
          }}
        />
      </head>
      <body className={inter.className}>
        <SkipLink />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
