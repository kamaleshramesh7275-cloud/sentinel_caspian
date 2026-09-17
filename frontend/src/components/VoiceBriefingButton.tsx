import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Radio, Sparkles } from 'lucide-react';

interface Props {
  briefingText?: string;
  className?: string;
}

export function VoiceBriefingButton({
  briefingText = "Sentinel SRE Commander. Critical P0 incident detected in payment gateway. Database connection pool capacity 10 out of 10 exhausted. Causal DAG identified missing try finally socket release in payment underscore gateway dot py. Autonomous shadow sandbox generated defensive patch and passed 100% green Pytest verification.",
  className = "",
}: Props) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setSupported(false);
    }
  }, []);

  const handleToggleSpeech = () => {
    if (!supported) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(briefingText);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    // Pick modern natural English voice if available
    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Neural')));
    if (naturalVoice) {
      utterance.voice = naturalVoice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={handleToggleSpeech}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium transition cursor-pointer border ${
        isSpeaking
          ? 'bg-rose-950/60 text-rose-300 border-rose-500/50 shadow-sm animate-pulse'
          : 'bg-indigo-950/40 hover:bg-indigo-900/50 text-indigo-300 hover:text-white border-indigo-500/30'
      } ${className}`}
      title={isSpeaking ? "Stop AI Voice Briefing" : "Play SRE AI Voice Audio Briefing (TTS)"}
    >
      {isSpeaking ? (
        <>
          <VolumeX className="w-3.5 h-3.5 text-rose-400 animate-spin" />
          <span>Stop Briefing</span>
        </>
      ) : (
        <>
          <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
          <span>AI Voice Briefing</span>
        </>
      )}
    </button>
  );
}
