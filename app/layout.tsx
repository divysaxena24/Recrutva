import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Recrutva - AI Powered Hiring Platform",
  description: "Recrutva - AI Powered Hiring Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        layout: {
          socialButtonsVariant: "iconButton",
          socialButtonsPlacement: "top"
        },
        variables: {
          colorPrimary: "#8b5cf6", // Violet-500
          colorBackground: "#0b0a11", // Targeted dark purple-tinted deep dark (matching latest image)
          colorInputBackground: "#ffffff", // White background for inputs
          colorInputText: "#1f2937", // Dark grey text for inputs
          colorText: "#ffffff", // Main text color
          colorTextSecondary: "#94a3b8", // slate-400
          borderRadius: "0.5rem",
        },
        elements: {
          card: "bg-[#0b0a11] border border-slate-800 shadow-2xl",
          headerTitle: "!text-white text-2xl font-bold tracking-tight",
          headerSubtitle: "!text-slate-400",
          socialButtonsIconButton: "!bg-white border border-slate-200 hover:bg-slate-50 transition-all !text-slate-600",
          socialButtonsBlockButton: "!bg-white border border-slate-200 hover:bg-slate-50 transition-all !text-slate-600 font-semibold",
          formButtonPrimary: "bg-gradient-to-r from-purple-500 to-blue-500 hover:opacity-90 shadow-lg border-0 transition-opacity !text-white font-bold",
          formFieldInput: "bg-white border-transparent focus:border-purple-500 focus:ring-purple-500/20 text-slate-900 placeholder:text-slate-500 h-11",
          formFieldLabel: "!text-white font-semibold text-sm mb-1",
          dividerRow: "border-slate-800",
          dividerText: "!text-slate-400 uppercase text-[10px] tracking-widest font-bold",
          footerActionText: "!text-slate-500",
          footerActionLink: "text-purple-400 hover:text-purple-300 font-bold",
          identityPreviewText: "!text-white",
          identityPreviewEditButtonIcon: "!text-purple-400",
          formFieldAction: "!text-purple-400 hover:!text-purple-300",
          userButtonPopoverCard: "bg-[#0a0a0f] border border-slate-800 shadow-2xl rounded-3xl ring-1 ring-white/5",
          userButtonPopoverMain: "!text-white",
          userButtonPopoverMainText: "!text-white",
          userButtonPopoverMainSubtext: "!text-white",
          userButtonPopoverSubtext: "!text-white",
          userButtonPopoverActionButton: "!text-white hover:bg-white/5 transition-all rounded-xl",
          userButtonPopoverActionButtonText: "!text-white",
          userButtonPopoverActionButtonIcon: "!text-white",
          userButtonOuterIdentifier: "!text-white",
          userButtonPopoverFooterText: "!text-slate-400",
          userButtonPopoverFooter: "border-t border-slate-800",
          socialButtonsBlockButtonBadge: "!text-white bg-indigo-500/30 border-indigo-500/40",
          socialButtonsBlockButtonBadgeText: "!text-white",
          socialButtonsBlockButton__badge: "!text-white",
          badge: "!text-white",
        }
      }}
    >
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
      >
        <body className="min-h-full flex flex-col">{children}</body>
      </html>
    </ClerkProvider>
  );
}
