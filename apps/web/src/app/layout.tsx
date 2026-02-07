import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Header } from "@/components/header";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DockOps",
  description: "Inventory + maintenance management for vessels",
  icons: {
    icon: "/assets/emblem.png",
    shortcut: "/assets/emblem.png",
    apple: "/assets/emblem.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.className}>
          <Providers>
            <Header />
            <main className="container mx-auto px-4 py-8">{children}</main>
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
