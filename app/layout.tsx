import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NeuroAbsorption Engine",
  description:
    "RSVP speed reading, memory reconsolidation, and trigger-based doctrine — turn books into behavior.",
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
