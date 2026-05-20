import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "n8n Client Dashboard",
  description: "Client-facing view of n8n workflows",
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
