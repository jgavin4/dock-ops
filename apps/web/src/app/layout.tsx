import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Header } from "@/components/header";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DockOps",
  description: "Inventory + maintenance for boat owners, captains, and crews.",
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
    <html lang="en">
      <body className={inter.className}>
        <ClerkProvider
          publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          fallbackRedirectUrl="/"
        >
          <Providers>
            <Header />
            <main className="container mx-auto px-4 py-8">{children}</main>
          </Providers>
        </ClerkProvider>
      </body>
    </html>
  );
}
