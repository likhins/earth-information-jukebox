import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "POLARIS · Earth Information Jukebox",
  description: "Explore Earth observation data as an immersive soundscape.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
