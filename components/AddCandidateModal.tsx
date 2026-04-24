"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Loader2 } from "lucide-react";
import { useState } from "react";
import { createCandidate } from "@/app/actions/candidate";

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 characters"),
  resumeText: z.string().min(20, "Please provide more details or paste resume content"),
});

type FormValues = z.infer<typeof formSchema>;

interface AddCandidateModalProps {
  onSuccess?: () => void;
}

export default function AddCandidateModal({ onSuccess }: AddCandidateModalProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    
    try {
      const result = await createCandidate(data);
      if (result.success) {
        setOpen(false);
        reset();
        if (onSuccess) onSuccess();
      } else {
        alert(result.error || "Failed to create candidate");
      }
    } catch (error) {
      console.error("Error creating candidate:", error);
      alert("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger 
        render={
          <Button className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-6 h-12 shadow-[0_0_20px_rgba(79,70,229,0.2)]">
            <Plus className="w-5 h-5 mr-2" /> Add Candidate
          </Button>
        } 
      />
      <DialogContent className="bg-[#0a0a0f] border-slate-800 text-white sm:max-w-[500px] rounded-3xl ring-1 ring-white/5">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold tracking-tight">Add New Candidate</DialogTitle>
          <DialogDescription className="text-slate-400">
            Import candidate details and resume content for AI screening.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-slate-300">Full Name</Label>
              <Input 
                id="name" 
                placeholder="John Doe" 
                {...register("name")}
                className="bg-slate-950 border-slate-800 focus:ring-indigo-500/50 rounded-xl"
              />
              {errors.name && <p className="text-xs text-rose-500 font-medium">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-slate-300">Phone Number</Label>
              <Input 
                id="phone" 
                placeholder="+1 234 567 890" 
                {...register("phone")}
                className="bg-slate-950 border-slate-800 focus:ring-indigo-500/50 rounded-xl"
              />
              {errors.phone && <p className="text-xs text-rose-500 font-medium">{errors.phone.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-300">Email Address</Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="john@example.com" 
              {...register("email")}
              className="bg-slate-950 border-slate-800 focus:ring-indigo-500/50 rounded-xl"
            />
            {errors.email && <p className="text-xs text-rose-500 font-medium">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="resumeText" className="text-slate-300">Resume / Skills Summary</Label>
            <Textarea 
              id="resumeText" 
              placeholder="Paste CV text or key skills here..." 
              {...register("resumeText")}
              rows={5}
              className="bg-slate-950 border-slate-800 focus:ring-indigo-500/50 rounded-xl resize-none"
            />
            {errors.resumeText && <p className="text-xs text-rose-500 font-medium">{errors.resumeText.message}</p>}
          </div>

          <DialogFooter className="pt-4">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={() => setOpen(false)}
              className="rounded-xl text-slate-400 hover:text-white hover:bg-white/5"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-8 h-12 shadow-[0_0_20px_rgba(79,70,229,0.2)] disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importing...
                </>
              ) : (
                "Import Candidate"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
