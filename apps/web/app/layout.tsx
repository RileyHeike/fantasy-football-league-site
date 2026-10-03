import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource/big-shoulders-display/700";
import "@fontsource/big-shoulders-display/800";
import "@fontsource/barlow/400.css";
import "@fontsource/barlow/500.css";
import "@fontsource/barlow/600.css";
import "./globals.css";
import { MobileTabBar, SiteHeader } from "@/components/Nav";
import { themeScript } from "@/components/ThemeToggle";
import { league, snapshot } from "@/lib/data";

export function generateMetadata(): Metadata {
  return {
    title: { default: league().leagueName, template: `%s | ${league().leagueName}` },
    description: `Standings, records and rivalries for ${league().leagueName}.`,
  };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const updated = new Date(snapshot().generatedAt);
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4">
          Skip to content
        </a>
        <SiteHeader leagueName={league().leagueName} />
        <main id="main" className="mx-auto max-w-6xl px-5 pb-28 pt-10 md:pb-16">
          {children}
        </main>
        <footer className="mx-auto max-w-6xl px-5 pb-28 text-sm text-chalk-dim md:pb-10">
          Data from Sleeper, updated {updated.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.
        </footer>
        <MobileTabBar />
      </body>
    </html>
  );
}
