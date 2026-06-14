import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { SkipLink } from "@/components/ui/skip-link";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Luminate - YouTube Video Automation",
  description: "Create professional YouTube videos with AI-powered research, content, and production tools",
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
