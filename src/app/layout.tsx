import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prosper AI",
  description: "your personal wealth coach.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`antialiased`}>{children}</body>
    </html>
  );
}
