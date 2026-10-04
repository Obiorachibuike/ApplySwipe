import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: "ApplySwipe — Your AI-Powered Job Application Engine",
  description:
    "Create your career profile once. Swipe through jobs. Let AI tailor your resume and prepare every application for you.",
  keywords: [
    "AI job applications",
    "job swipe",
    "resume tailoring",
    "job discovery",
    "career profile",
    "auto apply",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-foreground antialiased selection:bg-primary/30 selection:text-white">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
