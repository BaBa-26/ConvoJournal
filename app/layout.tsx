import type { Metadata, Viewport } from "next";
import { Playfair_Display, DM_Mono } from "next/font/google";
import SideNav from "@/components/SideNav";
import BottomNav from "@/components/BottomNav";
import ProfileButton from "@/components/ProfileButton";
import AuthProvider from "@/components/AuthProvider";
import PreferencesProvider from "@/components/PreferencesProvider";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { SpeedInsights } from "@vercel/speed-insights/next";
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
  metadataBase: new URL(process.env.NEXTAUTH_URL ?? "https://progress-coral-eight.vercel.app"),
  title: "Progress",
  description: "A quiet place for your thoughts",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Progress",
  },
  openGraph: {
    title: "Progress",
    description: "A quiet place for your thoughts",
    url: "/",
    siteName: "Progress",
    type: "website",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Progress",
    description: "A quiet place for your thoughts",
    images: ["/opengraph-image"],
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
        <AuthProvider>
          <PreferencesProvider>
            <div className="md:flex md:h-screen md:overflow-hidden">
              <SideNav />

              <div className="flex-1 flex flex-col md:overflow-y-auto">
                <div className="max-w-[430px] md:max-w-2xl mx-auto w-full min-h-screen md:min-h-0 flex flex-col relative">
                  {children}
                </div>
              </div>
            </div>
            <ProfileButton />
            <BottomNav />
          </PreferencesProvider>
        </AuthProvider>
        <ServiceWorkerRegister />
        <SpeedInsights />
      </body>
    </html>
  );
}
