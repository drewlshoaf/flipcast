import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flipcast",
  description: "The world's first personalized on-demand podcast.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
