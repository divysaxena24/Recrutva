import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono, Syne } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
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
        // Newer @clerk packages renamed baseTheme -> theme and layout -> options
        theme: dark,
        options: {
          socialButtonsVariant: "iconButton",
          socialButtonsPlacement: "top"
        },
        variables: {
          colorPrimary: "#3D6EFA",
          colorBackground: "#07090F",
          colorForeground: "#EDF0F7", // default text color (was colorText)
          colorMutedForeground: "#8A93A8", // secondary text (was colorTextSecondary)
          colorInput: "#141927", // input background (was colorInputBackground)
          colorInputForeground: "#EDF0F7", // input text (was colorInputText)
          borderRadius: "0.875rem",
        },
        elements: {
          card: "bg-[#0E1220] border border-white/10 shadow-2xl",
          headerTitle: "!text-[#EDF0F7] text-2xl font-bold tracking-tight",
          headerSubtitle: "!text-[#8A93A8]",
          socialButtonsIconButton: "!bg-[#141927] border border-white/10 hover:!bg-[#1C2438] transition-all !text-[#EDF0F7]",
          socialButtonsBlockButton: "!bg-[#141927] border border-white/10 hover:!bg-[#1C2438] transition-all !text-[#EDF0F7] font-semibold",
          formButtonPrimary: "bg-[#3D6EFA] hover:brightness-110 shadow-[0_0_20px_rgba(61,110,250,0.3)] border-0 transition-all !text-white font-bold",
          formFieldInput: "bg-[#141927] border-white/10 focus:border-[#3D6EFA] focus:ring-[#3D6EFA]/20 text-[#EDF0F7] placeholder:text-[#4A5368] h-11",
          formFieldLabel: "!text-[#EDF0F7] font-semibold text-sm mb-1",
          dividerRow: "border-slate-800",
          dividerText: "!text-[#8A93A8] uppercase text-[10px] tracking-widest font-bold",
          footerActionText: "!text-[#8A93A8]",
          footerActionLink: "text-[#3D6EFA] hover:text-[#7fa0ff] font-bold",
          identityPreviewText: "!text-[#EDF0F7]",
          identityPreviewEditButtonIcon: "!text-[#3D6EFA]",
          formFieldAction: "!text-[#3D6EFA] hover:!text-[#7fa0ff]",
          userButtonPopoverCard: "bg-[#0E1220] border border-white/10 shadow-2xl rounded-3xl ring-1 ring-white/5",
          userButtonPopoverMain: "!text-[#EDF0F7]",
          userButtonPopoverMainText: "!text-[#EDF0F7]",
          userButtonPopoverMainSubtext: "!text-[#EDF0F7]",
          userButtonPopoverSubtext: "!text-[#EDF0F7]",
          userButtonPopoverActionButton: "!text-[#EDF0F7] hover:bg-white/5 transition-all rounded-xl",
          userButtonPopoverActionButtonText: "!text-[#EDF0F7]",
          userButtonPopoverActionButtonIcon: "!text-[#EDF0F7]",
          userButtonOuterIdentifier: "!text-[#EDF0F7]",
          userButtonPopoverFooterText: "!text-[#8A93A8]",
          userButtonPopoverFooter: "border-t border-slate-800",
          socialButtonsBlockButtonBadge: "!text-white bg-[#3D6EFA]/30 border-[#3D6EFA]/40",
          socialButtonsBlockButtonBadgeText: "!text-white",
          socialButtonsBlockButton__badge: "!text-white",
          badge: "!text-white",
        }
      }}
    >
      <html lang="en" className={`${syne.variable} ${dmSans.variable} ${jetBrainsMono.variable} h-full antialiased dark`}>
        <body className="min-h-full flex flex-col">
          <SessionTimeout />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
