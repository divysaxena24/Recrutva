"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Mic,
  Calendar,
  Clock,
  ShieldCheck,
  ArrowRight,
  User,
  Info,
  Sparkles,
  Video,
  MicOff,
  PhoneOff,
  Send,
  Loader2,
  ShieldAlert
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useParams, useRouter, useSearchParams } from "next/navigation";

// --- Types ---
interface Message {
  role: 'ai' | 'user';
  content: string;
}

const INTERVIEW_QUESTIONS = [
  "Hello! I'm Sarah, your AI interviewer today. To get started, could you please introduce yourself and tell me a bit about your background in software development?",
  "That's interesting. What would you say is your biggest technical strength, and how has it helped you in your recent projects?",
  "Can you describe a particularly challenging technical problem you've faced recently and how you went about solving it?",
  "How do you approach learning new technologies or frameworks when you're starting a project?",
  "Great. Final question: What are your long-term career goals, and how does this role fit into those plans?"
];

export default function InterviewPortal() {
  const params = useParams();
  const searchParams = useSearchParams();
  const [view, setView] = useState<'join' | 'interview'>('join');
  const [name, setName] = useState("");
  const [step, setStep] = useState(1);
  const [isJoining, setIsJoining] = useState(false);
  const requestedView = searchParams.get("view");

  if (view === 'join') {
    return (
      <InterviewJoinPage
        name={name}
        setName={setName}
        step={step}
        setStep={setStep}
        isJoining={isJoining}
        interviewId={params.id as string}
        requestedView={requestedView}
        onStart={() => {
          setIsJoining(true);
          setTimeout(() => {
            setView('interview');
            setIsJoining(false);
          }, 800);
        }}
      />
    );
  }

  return <InterviewRoom name={name} interviewId={params.id as string} />;
}

// --- Join Page Component ---
function InterviewJoinPage({ name, setName, step, setStep, isJoining, onStart, interviewId, requestedView }: any) {
  const [candidate, setCandidate] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    fetch(`/api/candidate/${interviewId}`)
      .then(res => res.json())
      .then(data => {
        if (data.candidate) {
          setCandidate(data.candidate);
          setName(data.candidate.name);
        }
      });
  }, [interviewId, setName]);

  const handleNext = () => {
    if (step === 1) setStep(2);
    else onStart();
  };

  const displayJobTitle = candidate?.jobTitle || candidate?.linkedJobTitle || "Senior Developer";

  if (candidate?.status === "Completed") {
    if (requestedView === "summary") {
      return <InterviewSummaryViewer analysis={candidate.analysis} name={candidate.name} />;
    }
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-8 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/30">
          <ShieldAlert className="w-10 h-10 text-rose-500" />
        </div>
        <h2 className="text-3xl font-black text-white">Interview Already Completed</h2>
        <p className="text-slate-400 max-w-md">This interview has already been submitted and cannot be accessed again. The schedules page will show it as completed.</p>
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <Button
            onClick={() => router.push(`/interview/${interviewId}?view=summary`)}
            className="bg-emerald-600 hover:bg-emerald-500 rounded-2xl h-12 px-8 font-bold"
          >
            View Summary
          </Button>
          <Button
            onClick={() => router.push('/dashboard')}
            className="bg-indigo-600 hover:bg-indigo-500 rounded-2xl h-12 px-8 font-bold"
          >
            Return Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-slate-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] opacity-20 pointer-events-none blur-[120px] bg-indigo-500 rounded-full" />
      <div className="max-w-4xl w-full relative z-10">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-center gap-3 mb-12">
          <div className="bg-indigo-500/10 p-3 rounded-2xl ring-1 ring-indigo-500/30">
            <Bot className="w-8 h-8 text-indigo-400" />
          </div>
          <span className="font-bold text-2xl tracking-tight">Recrutva <span className="text-indigo-500">AI</span></span>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-stretch">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="lg:col-span-3 flex flex-col gap-6">
            <Card className="flex-1 p-8 bg-slate-900/40 border-slate-800/60 backdrop-blur-xl rounded-[2.5rem] ring-1 ring-white/5 shadow-2xl flex flex-col justify-between">
              <div className="space-y-6">
                <Badge variant="outline" className="px-4 py-1.5 rounded-full border-indigo-500/30 bg-indigo-500/10 text-indigo-300 font-bold uppercase text-[10px]">AI Screening Session</Badge>
                <div>
                  <h1 className="text-4xl font-extrabold text-white tracking-tight leading-tight mb-4">{displayJobTitle} <br /><span className="text-slate-400 text-2xl">at Recrutva Partner</span></h1>
                  <p className="text-slate-400 leading-relaxed max-w-md">Join your AI-powered voice interview. Sarah will guide you through technical and behavioral questions tailored to your profile.</p>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <InfoItem icon={<Clock className="w-4 h-4 text-amber-400" />} label="Duration" value="~15-20 Mins" />
                  <InfoItem icon={<Calendar className="w-4 h-4 text-indigo-400" />} label="Format" value="AI Voice Call" />
                </div>
              </div>
              <div className="pt-8 border-t border-slate-800/60 mt-8 text-emerald-400/80 text-sm font-bold uppercase tracking-widest flex items-center gap-3">
                <ShieldCheck className="w-5 h-5" /> Privacy Secured
              </div>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="lg:col-span-2 flex flex-col">
            <Card className="flex-1 p-8 bg-[#0a0a0f] border-slate-800/60 rounded-[2.5rem] ring-1 ring-white/5 shadow-2xl flex flex-col justify-center text-center space-y-8">
              <AnimatePresence mode="wait">
                {step === 1 ? (
                  <motion.div key="1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                    <div className="w-20 h-20 rounded-3xl bg-indigo-500/10 flex items-center justify-center mx-auto ring-1 ring-indigo-500/20"><Sparkles className="w-10 h-10 text-indigo-400" /></div>
                    <h2 className="text-2xl font-bold text-white">Ready to start?</h2>
                    <p className="text-sm text-slate-500">Ensure you're in a quiet environment.</p>
                  </motion.div>
                ) : (
                  <motion.div key="2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6 text-left">
                    <div className="flex items-center gap-2 text-slate-300 font-bold text-xs uppercase mb-1"><User className="w-3.5 h-3.5 text-indigo-400" /> Full Name</div>
                    <Input placeholder="John Doe" value={name} onChange={(e) => setName(e.target.value)} className="h-14 bg-slate-950 border-slate-800 rounded-2xl pl-5 text-base" />
                  </motion.div>
                )}
              </AnimatePresence>
              <Button onClick={handleNext} disabled={isJoining || (step === 2 && !name.trim())} className="w-full h-16 rounded-3xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg group">
                {isJoining ? <Loader2 className="animate-spin" /> : <>{step === 1 ? "Next Step" : "Begin Interview"} <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" /></>}
              </Button>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

// --- Interview Room Component ---
function InterviewRoom({ name, interviewId }: { name: string; interviewId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1);
  const [isSTTActive, setIsSTTActive] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [manualInput, setManualInput] = useState("");
  const [isAccessBlocked, setIsAccessBlocked] = useState(false);
  const [blockedCandidateName, setBlockedCandidateName] = useState(name);
  const router = useRouter();

  const videoRef = useRef<HTMLVideoElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const manualInputRef = useRef("");
  const [interviewQuestions, setInterviewQuestions] = useState<any[]>([]);
  const interviewQuestionsRef = useRef<any[]>([]);
  const hasStartedRef = useRef(false);
  const currentTranscriptRef = useRef("");
  const currentQuestionIndexRef = useRef(-1);

  // Initialize Media & Fetch Questions
  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    fetch(`/api/candidate/${interviewId}`)
      .then(res => res.json())
      .then(data => {
        if (data.candidate) {
          if (data.candidate.status === "Completed") {
            setBlockedCandidateName(data.candidate.name || name);
            setIsAccessBlocked(true);
            return;
          }

          startMedia();
          initSTT();

          fetch(`/api/interview/questions?candidateId=${interviewId}`)
            .then(res => res.json())
            .then(data => {
              if (Array.isArray(data)) {
                setInterviewQuestions(data);
                interviewQuestionsRef.current = data;
                setTimeout(() => {
                  askQuestion(0, data);
                }, 2000);
              }
            })
            .catch(err => {
              console.error("Failed to fetch questions:", err);
              const fallback = [
                "Hello! Could you please introduce yourself?",
                "Tell me about your technical experience.",
                "What is your biggest challenge in development?",
                "How do you stay updated with tech?",
                "What are your career goals?"
              ];
              setInterviewQuestions(fallback);
              interviewQuestionsRef.current = fallback;
              setTimeout(() => askQuestion(0, fallback), 2000);
            });
        }
      })
      .catch(err => console.error("Failed to fetch candidate:", err));

    return () => {
      stopMedia();
      if (recognitionRef.current) recognitionRef.current.stop();
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (isFinished) {
    return <InterviewSummaryViewer analysis={analysis} name={name} />;
  }

  if (isAccessBlocked) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-8 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/30">
          <ShieldAlert className="w-10 h-10 text-rose-500" />
        </div>
        <h2 className="text-3xl font-black text-white">Interview Already Completed</h2>
        <p className="text-slate-400 max-w-md">This interview for {blockedCandidateName || "the candidate"} was already completed. It cannot be started again.</p>
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <Button
            onClick={() => router.push(`/interview/${interviewId}?view=summary`)}
            className="bg-emerald-600 hover:bg-emerald-500 rounded-2xl h-12 px-8 font-bold"
          >
            View Summary
          </Button>
          <Button
            onClick={() => router.push("/dashboard")}
            className="bg-indigo-600 hover:bg-indigo-500 rounded-2xl h-12 px-8 font-bold"
          >
            Return Home
          </Button>
        </div>
      </div>
    );
  }

  const startMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      console.error("Media access denied:", err);
    }
  };

  const stopMedia = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
    }
  };

  const resetSilenceTimeout = () => {
    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    silenceTimeoutRef.current = setTimeout(() => {
      // If 5 seconds pass with NO typing or speaking...

      // 1. If they typed something, auto-submit it
      if (manualInputRef.current.trim().length > 0) {
        const text = manualInputRef.current.trim();
        setManualInput("");
        manualInputRef.current = "";
        handleUserResponse(text);
        return;
      }
      
      // 2. If they spoke something, auto-submit it
      if (currentTranscriptRef.current.trim()) {
        handleUserResponse(currentTranscriptRef.current);
      } else {
        // 3. If nothing was said or typed, auto-skip
        handleUserResponse("[No response recorded]");
      }
    }, 5000); // 5 seconds gap
  };

  const initSTT = () => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'speechRecognition' in window)) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).speechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsSTTActive(true);
        currentTranscriptRef.current = "";
        resetSilenceTimeout();
      };

      recognition.onend = () => setIsSTTActive(false);

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result: any) => result.transcript)
          .join('');

        currentTranscriptRef.current = transcript;
        resetSilenceTimeout(); // Reset timer on every result
      };

      recognitionRef.current = recognition;
    }
  };

  const askQuestion = async (index: number, questionsOverride?: any[]) => {
    const qs = questionsOverride || interviewQuestionsRef.current;
    if (index >= qs.length) {
      completeInterview(messages);
      return;
    }

    const questionItem = qs[index];
    const questionText = typeof questionItem === 'string' ? questionItem : questionItem.question;

    setMessages(prev => [...prev, { role: 'ai', content: questionText }]);
    setCurrentQuestionIndex(index);
    currentQuestionIndexRef.current = index;

    await playAiVoice(questionText);
  };

  const playAiVoice = async (text: string, onEnded?: () => void) => {
    setIsAiSpeaking(true);
    try {
      if (audioRef.current) audioRef.current.pause();

      const audioUrl = `/api/tts/stream?text=${encodeURIComponent(text)}`;
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onplay = () => {
        setIsAiSpeaking(true);
      };

      audio.onended = () => {
        setIsAiSpeaking(false);
        if (onEnded) {
          onEnded();
        } else {
          startListening();
        }
      };

      await audio.play();
    } catch (err) {
      console.error("TTS Error:", err);
      setIsAiSpeaking(false);
      if (onEnded) onEnded();
      else startListening();
    }
  };

  const startListening = () => {
    if (recognitionRef.current && !isMuted) {
      try {
        recognitionRef.current.start();
        setIsUserSpeaking(true);
      } catch (e) { }
    }
  };

  const completeInterview = async (currentMsgs: Message[]) => {
    const endMsg = "Thank you so much for your time today, " + name + ". We've captured your responses and our team will review them shortly. Have a wonderful day!";
    
    setMessages(prev => {
      const updated = [...prev, { role: 'ai' as const, content: endMsg }];
      
      // Save results to DB with the full history
      fetch('/api/interview/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: interviewId, // Send 'id' as expected by the API
          candidateName: name,
          transcript: updated,
          questions: interviewQuestions 
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setAnalysis(data.evaluation); // The API returns 'evaluation'
        } else if (data.error === "Interview already completed") {
          setAnalysis(data.evaluation ?? null);
        }
      })
      .catch(err => console.error("Failed to save interview:", err));
      
      return updated;
    });

    await playAiVoice(endMsg, () => {
      setTimeout(() => {
        setIsFinished(true);
        stopMedia();
      }, 1000);
    });
  };

  const handleUserResponse = (transcript: string) => {
    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    
    const newUserMsg: Message = { role: 'user' as const, content: transcript };
    let latestMessages: Message[] = [];

    setMessages(prev => {
      latestMessages = [...prev, newUserMsg];
      return latestMessages;
    });
    
    setIsUserSpeaking(false);
    
    if (recognitionRef.current) recognitionRef.current.stop();

    const nextIndex = currentQuestionIndexRef.current + 1;

    // Small delay before next question
    setTimeout(() => {
      if (nextIndex >= interviewQuestionsRef.current.length) {
        completeInterview(latestMessages);
      } else {
        askQuestion(nextIndex);
      }
    }, 1500);
  };

  return (
    <div className="h-screen bg-[#050505] text-slate-50 flex flex-col overflow-hidden font-sans">
      {/* Header */}
      <header className="h-16 border-b border-white/5 bg-black/40 backdrop-blur-md px-8 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-500/10 p-2 rounded-xl ring-1 ring-indigo-500/20">
            <Bot className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-tight">Interview Room</span>
            <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">Live Screening</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="bg-white/5 border-white/10 text-slate-400 px-3 py-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
            Session ID: {interviewId.slice(0, 8)}
          </Badge>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Left: Video Area */}
        <div className="flex-1 relative bg-slate-950 flex flex-col items-center justify-center p-8">

          {/* Main View: AI or User? We'll show both in a split-style layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-5xl aspect-video">

            {/* AI Agent View */}
            <Card className="relative bg-[#0a0a0f] border-slate-800/60 rounded-[2rem] overflow-hidden shadow-2xl ring-1 ring-white/5 flex flex-col items-center justify-center">
              <div className="absolute top-4 left-4 z-10">
                <Badge className="bg-indigo-500/20 text-indigo-300 border-none px-3 py-1 rounded-full text-[10px] font-bold uppercase">Sarah AI</Badge>
              </div>

              {/* Talking Animation */}
              <div className="relative">
                <AnimatePresence>
                  {isAiSpeaking && (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      {[...Array(3)].map((_, i) => (
                        <motion.div
                          key={i}
                          initial={{ scale: 1, opacity: 0.5 }}
                          animate={{ scale: 2, opacity: 0 }}
                          transition={{ repeat: Infinity, duration: 2, delay: i * 0.6 }}
                          className="absolute w-32 h-32 rounded-full border border-indigo-500/30"
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className={`w-32 h-32 rounded-full bg-indigo-500/10 border-2 transition-all duration-500 flex items-center justify-center ${isAiSpeaking ? 'border-indigo-500 scale-110 shadow-[0_0_40px_rgba(99,102,241,0.4)]' : 'border-slate-800'}`}>
                  <Bot className={`w-12 h-12 transition-colors ${isAiSpeaking ? 'text-indigo-400' : 'text-slate-600'}`} />
                </div>
              </div>
              <div className="mt-8 text-center">
                <p className={`text-sm font-bold uppercase tracking-[0.2em] transition-colors ${isAiSpeaking ? 'text-indigo-400' : 'text-slate-600'}`}>
                  {isAiSpeaking ? 'Speaking...' : 'Listening...'}
                </p>
              </div>
            </Card>

            {/* Candidate Webcam */}
            <Card className="relative bg-black border-slate-800/60 rounded-[2rem] overflow-hidden shadow-2xl ring-1 ring-white/5">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
              <div className="absolute top-4 left-4 z-10">
                <Badge className="bg-black/40 backdrop-blur-md text-white border-none px-3 py-1 rounded-full text-[10px] font-bold uppercase">{name}</Badge>
              </div>
              <div className="absolute bottom-4 right-4 flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isUserSpeaking ? 'bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]' : 'bg-slate-600'}`} />
              </div>
            </Card>
          </div>

          {/* Floating Controls */}
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/40 backdrop-blur-2xl border border-white/5 rounded-3xl p-3 shadow-2xl px-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMuted(!isMuted)}
              className={`w-12 h-12 rounded-2xl transition-all ${isMuted ? 'bg-red-500/20 text-red-500' : 'hover:bg-white/5 text-slate-400'}`}
            >
              {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-12 h-12 rounded-2xl hover:bg-white/5 text-slate-400"
            >
              <Video className="w-6 h-6" />
            </Button>
            <div className="w-px h-8 bg-white/10 mx-2" />
            <Button
              variant="destructive"
              className="h-12 px-6 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-red-500/20"
              onClick={() => window.location.href = '/dashboard'}
            >
              <PhoneOff className="w-5 h-5" /> End Call
            </Button>
          </div>
        </div>

        {/* Right: Chat Sidebar */}
        <aside className="w-96 border-l border-white/5 bg-[#0a0a0f] flex flex-col z-10">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-400 uppercase tracking-widest">Live Transcript</h3>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Recording</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex flex-col ${msg.role === 'ai' ? 'items-start' : 'items-end'}`}
              >
                <div className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed ${msg.role === 'ai'
                    ? 'bg-indigo-600/10 text-indigo-200 border border-indigo-500/20 rounded-tl-none'
                    : 'bg-white/5 text-slate-200 border border-white/5 rounded-tr-none'
                  }`}>
                  {msg.content}
                </div>
                <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mt-2 px-1">
                  {msg.role === 'ai' ? 'Sarah AI' : 'You'} &bull; {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </motion.div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="p-6 border-t border-white/5 bg-black/20">
            <div className="flex items-center gap-3 bg-white/5 border border-white/5 rounded-2xl p-3 focus-within:ring-1 focus-within:ring-indigo-500/30 transition-all">
              <Input
                placeholder="Type your response..."
                value={manualInput}
                onChange={(e) => {
                  setManualInput(e.target.value);
                  manualInputRef.current = e.target.value;
                  // Restart the 5-second auto-submit timer on every keystroke
                  resetSilenceTimeout();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && manualInput.trim()) {
                    const typedText = manualInput.trim();
                    setManualInput("");
                    manualInputRef.current = "";
                    handleUserResponse(typedText);
                  }
                }}
                className="bg-transparent border-none focus-visible:ring-0 text-sm h-auto p-0 text-white"
              />
              <Button 
                size="icon" 
                onClick={() => {
                  if (manualInput.trim()) {
                    const typedText = manualInput.trim();
                    setManualInput("");
                    manualInputRef.current = "";
                    handleUserResponse(typedText);
                  }
                }}
                className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-colors"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-[10px] text-slate-500 text-center mt-4 uppercase tracking-widest font-bold">
              Speech-to-Text or Type to Answer
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="bg-white/[0.03] border border-slate-800/40 rounded-2xl p-4 ring-1 ring-white/5">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-sm font-bold text-slate-200">{value}</p>
    </div>
  );
}

// --- Reusable Interview Summary Component ---
function InterviewSummaryViewer({ analysis, name }: { analysis: any; name: string }) {
  const totalScore = analysis?.totalScore ?? null;
  const breakdown: any[] = analysis?.breakdown ?? [];
  const summary = analysis?.executiveSummary ?? analysis?.summary ?? null;

  const scoreColor = totalScore === null ? 'text-slate-400'
    : totalScore >= 75 ? 'text-emerald-400'
    : totalScore >= 50 ? 'text-amber-400'
    : 'text-red-400';

  const scoreBarColor = totalScore === null ? 'bg-slate-600'
    : totalScore >= 75 ? 'bg-emerald-500'
    : totalScore >= 50 ? 'bg-amber-500'
    : 'bg-red-500';

  return (
    <div className="min-h-screen bg-[#050505] text-slate-50 flex flex-col items-center px-6 py-16 relative overflow-y-auto font-sans">
      <div className="absolute top-0 left-1/4 w-[600px] h-[400px] opacity-10 pointer-events-none blur-[140px] bg-emerald-500 rounded-full" />
      <div className="absolute top-1/2 right-0 w-[400px] h-[400px] opacity-10 pointer-events-none blur-[140px] bg-indigo-500 rounded-full" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-3xl w-full space-y-8 relative z-10"
      >
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5" /> Interview Complete
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight mt-2">Your Results, {name}</h1>
          <p className="text-slate-400">Here is your full AI-generated performance breakdown.</p>
        </div>

        {/* Score Card */}
        <Card className="p-8 bg-[#0a0a0f] border-slate-800/60 rounded-[2.5rem] ring-1 ring-white/5 shadow-2xl flex flex-col md:flex-row items-center gap-8">
          <div className="text-center md:text-left shrink-0">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Final Score</p>
            {totalScore !== null ? (
              <div className={`text-8xl font-black tabular-nums leading-none ${scoreColor}`}>
                {totalScore}<span className="text-3xl text-slate-600 font-bold">/100</span>
              </div>
            ) : (
              <div className="text-4xl font-black text-slate-500">Pending Analysis</div>
            )}
          </div>
          <div className="flex-1 w-full space-y-4">
            {totalScore !== null && (
              <div>
                <div className="flex justify-between text-xs text-slate-500 font-bold mb-2 uppercase tracking-widest">
                  <span>Score</span><span>{totalScore}%</span>
                </div>
                <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${totalScore}%` }}
                    transition={{ duration: 1.2, delay: 0.4, ease: "easeOut" }}
                    className={`h-full rounded-full ${scoreBarColor}`}
                  />
                </div>
              </div>
            )}
            {summary && (
              <p className="text-sm text-slate-300 leading-relaxed italic border-l-2 border-indigo-500/40 pl-4">
                &ldquo;{summary}&rdquo;
              </p>
            )}
            {!analysis && (
              <p className="text-sm text-slate-400">This interview was completed before detailed analysis was enabled. The breakdown will appear here for future interviews.</p>
            )}
          </div>
        </Card>

        {/* Per-Question Breakdown */}
        {breakdown.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-2">
              Question-by-Question Breakdown
            </h2>
            {breakdown.map((item: any, i: number) => {
              const marks = item.marks ?? 0;
              const markColor = marks >= 7 ? 'text-emerald-400' : marks >= 4 ? 'text-amber-400' : 'text-red-400';
              const markBarColor = marks >= 7 ? 'bg-emerald-500' : marks >= 4 ? 'bg-amber-500' : 'bg-red-500';
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.06 }}
                >
                  <Card className="bg-[#0c0c14] border-slate-800/50 rounded-[2rem] overflow-hidden">
                    {/* Question header */}
                    <div className="flex items-start justify-between gap-4 p-6 pb-4">
                      <div className="space-y-1 flex-1">
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Question {i + 1}</span>
                        <p className="text-sm font-semibold text-white leading-snug">{item.question}</p>
                      </div>
                      <div className="shrink-0 text-center min-w-[60px]">
                        <div className={`text-2xl font-black tabular-nums leading-none ${markColor}`}>
                          {marks}<span className="text-slate-600 text-sm font-bold">/10</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full mt-2 overflow-hidden">
                          <div className={`h-full rounded-full ${markBarColor}`} style={{ width: `${marks * 10}%` }} />
                        </div>
                      </div>
                    </div>

                    <div className="px-6 pb-6 space-y-3">
                      {/* Expected Answer */}
                      <div className="bg-indigo-500/5 border border-indigo-500/15 rounded-2xl p-4 space-y-1.5">
                        <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                          <Bot className="w-3 h-3" /> Expected Answer
                        </span>
                        <p className="text-sm text-indigo-100/80 leading-relaxed">{item.expectedAnswer}</p>
                      </div>

                      {/* User Answer */}
                      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-1.5">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                          <User className="w-3 h-3" /> Your Answer
                        </span>
                        <p className="text-sm text-slate-300 italic leading-relaxed">&ldquo;{item.userAnswer || '[No answer recorded]'}&rdquo;</p>
                      </div>

                      {/* Marks Awarded */}
                      <div className={`rounded-2xl p-4 space-y-1.5 border ${marks >= 7 ? 'bg-emerald-500/5 border-emerald-500/15' : marks >= 4 ? 'bg-amber-500/5 border-amber-500/15' : 'bg-red-500/5 border-red-500/15'}`}>
                        <span className={`text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${markColor}`}>
                          <Sparkles className="w-3 h-3" /> Marks Awarded: {marks} / 10
                        </span>
                        <p className="text-sm text-slate-300 leading-relaxed">{item.feedback}</p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Final Score Summary Banner */}
        {totalScore !== null && (
          <Card className="p-6 bg-[#0a0a0f] border-slate-800/60 rounded-[2rem] ring-1 ring-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Overall Performance</p>
              <p className={`text-2xl font-extrabold ${scoreColor}`}>
                {totalScore >= 75 ? '🌟 Excellent' : totalScore >= 50 ? '👍 Good' : '📚 Needs Improvement'}
              </p>
              <p className="text-slate-400 text-sm mt-1">
                {totalScore >= 75
                  ? 'Outstanding performance — highly recommended!'
                  : totalScore >= 50
                  ? 'Solid candidate with room to grow.'
                  : 'Candidate may need more preparation.'}
              </p>
            </div>
            <div className={`text-5xl font-black tabular-nums ${scoreColor}`}>
              {totalScore}<span className="text-slate-600 text-2xl font-bold">/100</span>
            </div>
          </Card>
        )}

        {/* Return to Dashboard */}
        <div className="pb-12">
          <Button
            onClick={() => window.location.href = '/dashboard'}
            className="w-full h-16 rounded-3xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg shadow-xl shadow-indigo-500/20 transition-all"
          >
            Return to Dashboard
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
