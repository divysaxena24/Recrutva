import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono, Syne } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import SessionTimeout from "@/components/SessionTimeout";

// NOTE: Environment validation removed from build time.
// It is now validated lazily by lib/redis.ts, lib/ai.ts, and db/index.ts
// when they are first accessed at runtime. This allows the Next.js build
// to complete without requiring environment variables to be present.

const syne = Syne({
  variable: "--font-display",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-mono",
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
        options: {
          socialButtonsVariant: "iconButton",
          socialButtonsPlacement: "top"
        },
        variables: {
          colorPrimary: "#4F46E5",
          colorBackground: "#FFFFFF",
          colorForeground: "#0F172A",
          colorMutedForeground: "#64748B",
          colorInput: "#F8FAFC",
          colorInputForeground: "#0F172A",
          borderRadius: "0.875rem",
        },
        elements: {
          card: "bg-white border border-slate-200 shadow-xl rounded-3xl",
          headerTitle: "!text-slate-900 text-2xl font-bold tracking-tight",
          headerSubtitle: "!text-slate-500",
          socialButtonsIconButton: "!bg-slate-50 border border-slate-200 hover:!bg-slate-100 transition-all !text-slate-800",
          socialButtonsBlockButton: "!bg-slate-50 border border-slate-200 hover:!bg-slate-100 transition-all !text-slate-800 font-semibold",
          formButtonPrimary: "bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20 border-0 transition-all !text-white font-bold",
          formFieldInput: "bg-slate-50 border-slate-200 focus:border-indigo-600 focus:ring-indigo-500/20 text-slate-900 placeholder:text-slate-400 h-11",
          formFieldLabel: "!text-slate-800 font-semibold text-sm mb-1",
          dividerRow: "border-slate-200",
          dividerText: "!text-slate-400 uppercase text-[10px] tracking-widest font-bold",
          footerActionText: "!text-slate-500",
          footerActionLink: "text-indigo-600 hover:text-indigo-700 font-bold",
          identityPreviewText: "!text-slate-900",
          identityPreviewEditButtonIcon: "!text-indigo-600",
          formFieldAction: "!text-indigo-600 hover:!text-indigo-700",
          userButtonPopoverCard: "bg-white border border-slate-200 shadow-2xl rounded-3xl ring-1 ring-black/5",
          userButtonPopoverMain: "!text-slate-900",
          userButtonPopoverMainText: "!text-slate-900",
          userButtonPopoverMainSubtext: "!text-slate-500",
          userButtonPopoverSubtext: "!text-slate-500",
          userButtonPopoverActionButton: "!text-slate-800 hover:bg-slate-100 transition-all rounded-xl",
          userButtonPopoverActionButtonText: "!text-slate-800",
          userButtonPopoverActionButtonIcon: "!text-slate-600",
          userButtonOuterIdentifier: "!text-slate-800 font-semibold",
          userButtonPopoverFooterText: "!text-slate-500",
          userButtonPopoverFooter: "border-t border-slate-100",
        }
      }}
    >
      <html lang="en" className={`${syne.variable} ${dmSans.variable} ${jetBrainsMono.variable} h-full antialiased`}>
        <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
          <SessionTimeout />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}

