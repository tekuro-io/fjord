import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fjord",
  description: "Taste the Glacier",
  openGraph: {
    title: "Fjord",
    description: "Taste the Glacier",
    url: "https://fjord.tekuro.io",
    images: [
      {
        url: "https://fjord.tekuro.io/stock.png",
        alt: "Fjord - Taste the Glacier"
      },
    ],
    siteName: "Fjord",
    type: "website",
    locale: "en_US",
  },

};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
