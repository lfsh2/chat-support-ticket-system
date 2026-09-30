import type { Metadata, Viewport } from "next";
import { Figtree, Newsreader } from "next/font/google";
import { Providers } from "@/components/shell/providers";
import { APP_NAME } from "@/lib/config";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-sans",
  subsets: ["latin"],
});

// Display serif for headings, channel names and margin notes. Body/UI stays Figtree.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Chat, support and help articles for Alive & Free and CoachOS clients.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FBFAF7" },
    { media: "(prefers-color-scheme: dark)", color: "#0E1526" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${figtree.variable} ${newsreader.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-dvh flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
