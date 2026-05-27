import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SoulPlan — Visual Sprint Planning",
  description: "Open source planning software for visual sprint and release management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}