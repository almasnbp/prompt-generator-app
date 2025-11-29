import "./globals.css";
import { Inter } from "next/font/google";
import React from "react"; // Impor React diperlukan untuk tipe children

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "AI Image Prompt Generator Next.js",
  description:
    "A tool for generating high-quality image prompts with API Key rotation.",
};

// Mendefinisikan interface atau tipe untuk props RootLayout
interface RootLayoutProps {
  children: React.ReactNode; // Menggunakan tipe React.ReactNode untuk 'children'
}

// Menggunakan RootLayoutProps untuk memberi tipe pada argumen fungsi
export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
