import Link from "next/link";
import { ArrowRight, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Global 404 page. Only renders for URLs that match no route — valid
 * application routes must always resolve to their own pages.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-6 text-center font-sans">
      <div className="bg-indigo-50 p-3 rounded-2xl border border-indigo-100 shadow-xs">
        <Bot className="w-8 h-8 text-indigo-600" />
      </div>

      <h1 className="mt-8 text-7xl font-black tracking-tight text-slate-900">
        404
      </h1>
      <p className="mt-3 text-lg font-bold text-slate-900">Page not found</p>
      <p className="mt-2 max-w-md text-sm text-slate-600">
        The page you are looking for doesn&apos;t exist or may have been moved.
      </p>

      <Link href="/" className="mt-8">
        <Button className="h-12 px-8 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-600/15">
          Back to Home <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
      </Link>
    </div>
  );
}
