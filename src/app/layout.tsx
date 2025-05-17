import type { Metadata } from "next";
import { Rethink_Sans, JetBrains_Mono } from "next/font/google";
import { Slide, ToastContainer } from "react-toastify";

import { Footer } from "@/components/Header/Footer";
import { BitcoinWalletProvider } from "@/contexts/BitcoinWalletProvider";
import SolanaWalletProvider from "@/contexts/SolanaWalletProvider";
import { ZplClientProvider } from "@/contexts/ZplClientProvider";

import DevInfo from "../components/DevInfo/DevInfo";
import GlobalModals from "../components/GlobalModals/GlobalModals";
import Header from "../components/Header/Header";
import Socials from "../components/Socials/Socials";

import "react-toastify/dist/ReactToastify.css";
import "./globals.scss";
import "./design-system.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://emrys.xyz"),
  title: "Emrys",
  description: "Bridge seamlessly between chains",
  themeColor: "#ffffff",
  icons: {
    icon: [
      { url: "/emrys-logo1.png", sizes: "32x32", type: "image/png" },
      { url: "/emrys-logo1.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/emrys-logo1.png",
    shortcut: "/emrys-logo1.png",
  },
  manifest: "/site.webmanifest",
  other: {
    "msapplication-TileColor": "#ffffff",
    "mask-icon": "/safari-pinned-tab.svg",
  },
};

const rethinkSans = Rethink_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-rethink-sans",
  weight: ["400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
  adjustFontFallback: false,
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
  weight: "400",
  adjustFontFallback: false,
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${rethinkSans.variable} ${jetBrainsMono.variable}`}>
      <body>
        <SolanaWalletProvider>
          <ZplClientProvider>
            <BitcoinWalletProvider>
              <GlobalModals />
              <div className="wrapper">
                <Header />
                <div className="page-wrapper">{children}</div>
                <Socials />
                <DevInfo />
                <Footer />
              </div>
              <ToastContainer
                stacked
                className="orpheus-toast"
                position="top-right"
                autoClose={7500}
                hideProgressBar={false}
                rtl={false}
                pauseOnFocusLoss
                theme="dark"
                pauseOnHover
                transition={Slide}
              />
            </BitcoinWalletProvider>
          </ZplClientProvider>
        </SolanaWalletProvider>
      </body>
    </html>
  );
}
