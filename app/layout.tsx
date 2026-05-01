import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Patient Care Dashboard",
  description: "Dashboard for monitoring patient adherence and SOS escalations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
