import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RAMSport",
  description: "Reliability, availability, maintainability and safety workbench",
  icons: { icon: "/brand-mark.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
