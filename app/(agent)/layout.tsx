import { Metadata } from "next";
import localFont from "next/font/local";
import { GeistMono } from "geist/font/mono";
import ColorStyles from "@/components/shared/color-styles/color-styles";
import Scrollbar from "@/components/ui/scrollbar";
import "@/styles/main.css";
import "streamdown/styles.css";

const suisseIntl = localFont({
  src: [
    { path: "../public/fonts/SuisseIntl/400.woff2", weight: "400" },
    { path: "../public/fonts/SuisseIntl/450.woff2", weight: "450" },
    { path: "../public/fonts/SuisseIntl/500.woff2", weight: "500" },
    { path: "../public/fonts/SuisseIntl/600.woff2", weight: "600" },
    { path: "../public/fonts/SuisseIntl/700.woff2", weight: "700" },
  ],
  variable: "--font-suisse",
});

export const metadata: Metadata = {
  title: "Firecrawl Agent",
  description:
    "Open-source AI agent for autonomous web research, scraping, and structured data extraction.",
  icons: { icon: "/favicon.png" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <ColorStyles />
      </head>
      <body
        className={`${suisseIntl.variable} ${GeistMono.variable} font-sans text-accent-black bg-background-base overflow-x-clip`}
      >
        <main className="overflow-x-clip">{children}</main>
        <Scrollbar />
      </body>
    </html>
  );
}
