import type { Metadata, Viewport } from "next";
import { Playfair_Display, DM_Mono } from "next/font/google";
import SideNav from "@/components/SideNav";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Murmur",
  description: "A quiet place for your thoughts",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Murmur",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0f0e0b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${dmMono.variable}`}>
      <body className="min-h-screen bg-ink-950 overflow-x-hidden">
        <div className="md:flex md:h-screen md:overflow-hidden">
          {/* Desktop sidebar nav */}
          <SideNav />

          {/* Scrollable content area */}
          <div className="flex-1 flex flex-col md:overflow-y-auto">
            {/* Mobile: 430px centered column; Desktop: comfortable reading width */}
            <div className="max-w-[430px] md:max-w-2xl mx-auto w-full min-h-screen md:min-h-0 flex flex-col relative">
              {children}
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
