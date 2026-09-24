"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { deleteJob } from "@/app/actions/job";

interface DeleteJobAlertModalProps {
  jobId: number;
  jobTitle: string;
  onSuccess?: () => void;
  trigger?: React.ReactNode;
}

export default function DeleteJobAlertModal({
  jobId,
  jobTitle,
  onSuccess,
  trigger,
}: DeleteJobAlertModalProps) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await deleteJob(jobId);
      if (res.success) {
        setOpen(false);
        onSuccess?.();
      } else {
        setError(res.error || "Failed to delete job.");
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ? (
            (trigger as React.ReactElement)
          ) : (
            <Button
              variant="ghost"
              size="icon"
              title="Delete Job"
              className="w-8 h-8 rounded-lg hover:bg-rose-50 hover:text-rose-600 text-slate-400 transition-all shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )
        }
      />
      <DialogContent className="bg-white border-slate-200 text-slate-900 sm:max-w-[440px] rounded-[2rem] p-0 overflow-hidden shadow-2xl">
        <div className="p-6 sm:p-8 space-y-6">
          <DialogHeader className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6 text-rose-600" />
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
              Delete Job Position?
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-600 leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-slate-900">&quot;{jobTitle}&quot;</span>?
              This action cannot be undone. All candidates, scores, and round data for this job will be permanently removed.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700 font-semibold">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={deleting}
              className="flex-1 h-12 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs uppercase tracking-wider"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 h-12 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider shadow-md shadow-rose-500/20"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Delete Job"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
