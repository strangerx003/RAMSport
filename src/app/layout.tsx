import type { Metadata } from "next";
import { withBasePath } from "@/lib/base-path";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "RAMSport",
  description: "Reliability, availability, maintainability and safety workbench",
  icons: { icon: withBasePath("/brand-mark.svg") },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
