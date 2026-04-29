import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ritzy Studio",
  description: "AI-assisted residential interior design workspace for Dubai designers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body>{children}</body>
    </html>
  );
}
