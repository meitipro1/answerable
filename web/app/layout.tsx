import type { Metadata } from "next";
import { Geist_Mono, Instrument_Serif, Outfit } from "next/font/google";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { WalletProvider } from "@/lib/wallet";
import "./globals.css";

const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", variable: "--font-serif" });
const sans = Outfit({ subsets: ["latin"], variable: "--font-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://answerable-olive.vercel.app"),
  title: "Answerable: pay to ask, refunded if they dodge",
  description:
    "Put GEN behind a public question to a founder, a team or an expert. If the reply answers it, they keep the money. If it dodges, GenLayer validators send it back to everyone who backed it.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <WalletProvider>
          <Navbar />
          <main>{children}</main>
          <Footer />
        </WalletProvider>
      </body>
    </html>
  );
}
