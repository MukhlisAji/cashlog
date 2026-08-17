"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

const WORDS = ["WhatsApp", "Google Sheet", "Cashlog"] as const;

const TYPE_MS = 85;
const DELETE_MS = 40;
const HOLD_MS = 1900;

const LONGEST_WORD = WORDS.reduce((a, b) => (b.length > a.length ? b : a));

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const media = window.matchMedia(REDUCED_MOTION_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function useReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  );
}

type Phase = "hold" | "deleting" | "typing";

interface TypingState {
  wordIndex: number;
  length: number;
  phase: Phase;
}

const INITIAL_STATE: TypingState = {
  wordIndex: 0,
  length: WORDS[0].length,
  phase: "hold",
};

function nextState({ wordIndex, length, phase }: TypingState): TypingState {
  if (phase === "hold") {
    return { wordIndex, length, phase: "deleting" };
  }

  if (phase === "deleting") {
    if (length === 0) {
      return {
        wordIndex: (wordIndex + 1) % WORDS.length,
        length: 1,
        phase: "typing",
      };
    }
    return { wordIndex, length: length - 1, phase: "deleting" };
  }

  if (length >= WORDS[wordIndex].length) {
    return { wordIndex, length, phase: "hold" };
  }
  return { wordIndex, length: length + 1, phase: "typing" };
}

function delayFor(phase: Phase) {
  if (phase === "hold") return HOLD_MS;
  return phase === "deleting" ? DELETE_MS : TYPE_MS;
}

export function TypingHeadline({ className }: { className?: string }) {
  const reducedMotion = useReducedMotion();
  const [state, setState] = useState(INITIAL_STATE);

  useEffect(() => {
    if (reducedMotion) return;

    const timer = setTimeout(
      () => setState(nextState),
      delayFor(state.phase),
    );
    return () => clearTimeout(timer);
  }, [reducedMotion, state]);

  const text = reducedMotion
    ? WORDS[0]
    : WORDS[state.wordIndex].slice(0, state.length);

  return (
    <h1
      className={cn(
        "text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl lg:text-[3.25rem]",
        className,
      )}
    >
      Kelola keuangan keluarga dengan{" "}
      <span className="relative inline-block whitespace-nowrap align-bottom">
        {/* Invisible sizer keeps the headline width stable while typing */}
        <span aria-hidden className="invisible">
          {LONGEST_WORD}
        </span>
        <span className="absolute inset-y-0 left-0 flex items-center">
          <span className="bg-gradient-to-r from-primary to-emerald-600 bg-clip-text text-transparent">
            {text}
          </span>
          {!reducedMotion && (
            <span
              aria-hidden
              className="animate-caret ml-0.5 inline-block h-[1em] w-[3px] translate-y-[0.05em] rounded-full bg-primary"
            />
          )}
        </span>
      </span>
      <span className="sr-only">{WORDS.join(", ")}</span>
    </h1>
  );
}
