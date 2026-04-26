import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Court Reserve",
  description: "Tennis Club Reservation System",
};

import { TenantProvider } from "../context/TenantContext";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&family=Lexend:wght@100..900&family=Manrope:wght@200..800&display=swap" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <TenantProvider>
          {children}
        </TenantProvider>
      </body>
    </html>
  );
}
