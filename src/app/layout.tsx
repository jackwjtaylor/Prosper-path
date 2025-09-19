import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prosper AI",
  description: "your personal wealth coach.",
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark">
      <body className={`antialiased`}>
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => { try { var t = localStorage.getItem('theme'); if (!t) { t = 'dark'; localStorage.setItem('theme', t); } document.documentElement.setAttribute('data-theme', t); } catch(e){} })();`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
