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
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useParams } from "next/navigation";

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
  const [view, setView] = useState<'join' | 'interview'>('join');
  const [name, setName] = useState("");
  const [step, setStep] = useState(1);
  const [isJoining, setIsJoining] = useState(false);

  if (view === 'join') {
    return (
      <InterviewJoinPage
        name={name}
        setName={setName}
        step={step}
        setStep={setStep}
        isJoining={isJoining}
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
function InterviewJoinPage({ name, setName, step, setStep, isJoining, onStart }: any) {
  const handleNext = () => {
    if (step === 1) setStep(2);
    else onStart();
  };

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
                  <h1 className="text-4xl font-extrabold text-white tracking-tight leading-tight mb-4">Senior Frontend Developer <br /><span className="text-slate-400 text-2xl">at InnovateTech Solutions</span></h1>
                  <p className="text-slate-400 leading-relaxed max-w-md">Join your AI-powered voice interview. Sarah will guide you through technical and behavioral questions.</p>
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

  const videoRef = useRef<HTMLVideoElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasStartedRef = useRef(false);
  const currentTranscriptRef = useRef("");
  const currentQuestionIndexRef = useRef(-1);

  // Initialize Media & First Question
  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    startMedia();
    initSTT();

    // Start after a short delay
    setTimeout(() => {
      askQuestion(0);
    }, 2000);

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
    return (
      <div className="min-h-screen bg-[#050505] text-slate-50 flex flex-col items-center p-8 py-12 relative overflow-y-auto font-sans">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] opacity-20 pointer-events-none blur-[120px] bg-emerald-500 rounded-full" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl w-full space-y-10 relative z-10"
        >
          {/* Header Card */}
          <div className="text-center space-y-4">
            <div className="w-20 h-20 rounded-[2rem] bg-emerald-500/10 flex items-center justify-center mx-auto ring-1 ring-emerald-500/30 mb-6">
              <ShieldCheck className="w-10 h-10 text-emerald-400" />
            </div>
            <h1 className="text-4xl font-extrabold text-white tracking-tight">Interview Successfully Completed</h1>
            <p className="text-slate-400">Great job, {name}. Here is a summary of your screening session.</p>
          </div>

          {/* executive summary */}
          {analysis && (
            <Card className="p-8 bg-[#0a0a0f] border-slate-800/60 rounded-[2.5rem] ring-1 ring-white/5 shadow-2xl space-y-6">
              <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                <Bot className="w-5 h-5 text-indigo-400" />
                <h2 className="font-bold text-lg text-white">AI Executive Summary</h2>
              </div>
              <div className="space-y-3">
                {analysis.executiveSummary.split('\n').map((line: string, i: number) => (
                  <p key={i} className="text-slate-300 text-sm leading-relaxed flex gap-3">
                    <span className="text-indigo-500 font-bold shrink-0">•</span>
                    {line}
                  </p>
                ))}
              </div>
            </Card>
          )}

          {/* Question-wise Breakdown */}
          {analysis && (
            <div className="space-y-6">
              <h3 className="font-bold text-slate-400 uppercase tracking-widest text-xs px-4">Detailed Question Analysis</h3>
              <div className="space-y-4">
                {analysis.breakdown.map((item: any, i: number) => (
                  <Card key={i} className="p-6 bg-slate-900/30 border-slate-800/40 rounded-[2rem] space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Question {i+1}</span>
                        <p className="text-sm font-bold text-white">{item.question}</p>
                      </div>
                      <Badge className={item.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400 border-none' : 'bg-red-500/10 text-red-400 border-none'}>
                        {item.status}
                      </Badge>
                    </div>
                    <div className="bg-black/20 rounded-2xl p-4 space-y-2">
                      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Your Answer</span>
                      <p className="text-sm text-slate-400 italic">"{item.answer}"</p>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-4 pt-4 pb-12">
            <Button 
              onClick={() => window.location.href = '/dashboard'} 
              className="flex-1 h-16 rounded-3xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg shadow-xl shadow-indigo-500/20"
            >
              Return to Dashboard
            </Button>
          </div>
        </motion.div>
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
      if (currentTranscriptRef.current.trim()) {
        handleUserResponse(currentTranscriptRef.current);
      } else {
        // If nothing was said for 5 seconds, we move on
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

  const askQuestion = async (index: number) => {
    if (index >= INTERVIEW_QUESTIONS.length) {
      completeInterview(messages);
      return;
    }

    const question = INTERVIEW_QUESTIONS[index];
    setMessages(prev => [...prev, { role: 'ai', content: question }]);
    setCurrentQuestionIndex(index);
    currentQuestionIndexRef.current = index;

    await playAiVoice(question);
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
          interviewId,
          candidateName: name,
          transcript: updated
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setAnalysis(data.analysis);
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
      if (nextIndex >= INTERVIEW_QUESTIONS.length) {
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
            <div className="flex items-center gap-3 bg-white/5 border border-white/5 rounded-2xl p-3 focus-within:ring-1 focus-within:ring-indigo-500/30 transition-all opacity-50">
              <Input
                placeholder="Type your response..."
                disabled
                className="bg-transparent border-none focus:ring-0 text-sm h-auto p-0"
              />
              <Button size="icon" disabled className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30">
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-[10px] text-slate-600 text-center mt-4 uppercase tracking-widest font-bold">
              Speech-to-Text Enabled
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
