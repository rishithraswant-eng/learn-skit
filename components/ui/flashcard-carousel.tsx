"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ArrowLeft, ArrowRight, Bookmark, AlertCircle, Check } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion, PanInfo } from "motion/react";
import { cn } from "@/lib/utils";

export type Flashcard = {
  id: string;
  title: string;          // e.g. "Order the atmosphere layers from the surface upward"
  body: React.ReactNode;  // e.g. "1 Troposphere → 2 Stratosphere → ..."
  hint?: string;          // mnemonic, e.g. "Tall Students Must Think Everyday"
};

export type FlashcardCarouselProps = {
  cards: Flashcard[];
  initialIndex?: number;
  onIndexChange?: (index: number) => void;
  onSave?: (card: Flashcard) => void;
  onReportIssue?: (card: Flashcard) => void;
  savedIds?: string[];
  className?: string;
};

export default function FlashcardCarousel({
  cards,
  initialIndex = 0,
  onIndexChange,
  onSave,
  onReportIssue,
  savedIds = [],
  className,
}: FlashcardCarouselProps) {
  const shouldReduceMotion = useReducedMotion();
  const total = cards.length;

  const [currentIndex, setCurrentIndex] = useState(() => {
    if (total === 0) return 0;
    return Math.max(0, Math.min(initialIndex, total - 1));
  });

  // Sync index if initialIndex changes externally
  useEffect(() => {
    if (total > 0) {
      setCurrentIndex((prev) => Math.max(0, Math.min(prev, total - 1)));
    }
  }, [total]);

  const handleIndexChange = useCallback(
    (newIndex: number) => {
      setCurrentIndex(newIndex);
      onIndexChange?.(newIndex);
    },
    [onIndexChange]
  );

  const handleNext = useCallback(() => {
    if (currentIndex < total - 1) {
      handleIndexChange(currentIndex + 1);
    }
  }, [currentIndex, total, handleIndexChange]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      handleIndexChange(currentIndex - 1);
    }
  }, [currentIndex, handleIndexChange]);

  // Touch Swipe Handling on mobile (<768px)
  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (shouldReduceMotion) return;
      const swipeDistanceThreshold = 80;
      const swipeVelocityThreshold = 500;

      if (
        info.offset.x < -swipeDistanceThreshold ||
        info.velocity.x < -swipeVelocityThreshold
      ) {
        handleNext();
      } else if (
        info.offset.x > swipeDistanceThreshold ||
        info.velocity.x > swipeVelocityThreshold
      ) {
        handlePrev();
      }
    },
    [handleNext, handlePrev, shouldReduceMotion]
  );

  // Desktop Keyboard navigation (ArrowLeft / ArrowRight)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          target.closest("dialog[open]"))
      ) {
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNext, handlePrev]);

  // Visible cards: center is active; left and right are previews on md+
  const leftCard = currentIndex > 0 ? cards[currentIndex - 1] : null;
  const activeCard = total > 0 ? cards[currentIndex] : null;
  const rightCard = currentIndex < total - 1 ? cards[currentIndex + 1] : null;

  if (total === 0 || !activeCard) {
    return (
      <div className="w-full max-w-xl mx-auto p-8 text-center rounded-3xl bg-white/70 dark:bg-neutral-900/70 border border-neutral-200/50 dark:border-neutral-800 text-neutral-500">
        No flashcards in this deck.
      </div>
    );
  }

  const isSaved = savedIds.includes(activeCard.id);
  const progressPercent = total > 0 ? ((currentIndex + 1) / total) * 100 : 0;
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === total - 1;

  return (
    <section
      className={cn(
        "w-full overflow-x-clip px-4 pb-28 sm:pb-6 select-none",
        className
      )}
      aria-label="Flashcard carousel"
    >
      <div className="w-full max-w-5xl mx-auto flex flex-col">
        {/* Progress row: Card n of total & animated fill bar */}
        <div className="w-full max-w-xl md:max-w-none mx-auto mb-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-2">
            <span
              className="text-sm font-semibold text-neutral-600 dark:text-neutral-400"
              role="status"
            >
              Card {currentIndex + 1} of {total}
            </span>
            <span className="font-mono text-xs text-neutral-500 dark:text-neutral-400 self-end sm:self-auto">
              {Math.round(progressPercent)}%
            </span>
          </div>
          <div
            className="h-2 w-full rounded-full bg-neutral-200/70 dark:bg-neutral-800 overflow-hidden shadow-inner"
            aria-hidden="true"
          >
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#8DB9F0] via-[#EBA38A] to-[#F5B69E]"
              initial={false}
              animate={{ width: `${progressPercent}%` }}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 120, damping: 20 }
              }
            />
          </div>
        </div>

        {/* Viewport: Base is 1 active card; md+ expands into a 3-up grid [1fr_1.9fr_1fr] */}
        <div className="relative w-full overflow-x-clip py-2">
          <div className="w-full max-w-xl md:max-w-none mx-auto grid grid-cols-1 md:grid-cols-[1fr_1.9fr_1fr] items-center gap-4 lg:gap-6">
            {/* Left Preview Card (md+ only) */}
            {leftCard ? (
              <div
                aria-hidden="true"
                tabIndex={-1}
                onClick={handlePrev}
                className="hidden md:flex flex-col justify-start max-h-[260px] overflow-hidden rounded-3xl p-5 bg-white/60 dark:bg-[#141824]/60 border border-neutral-200/40 dark:border-neutral-800/40 opacity-60 blur-[1px] scale-[0.92] transition-all cursor-pointer pointer-events-auto hover:opacity-80"
              >
                <h3 className="text-sm lg:text-base font-bold line-clamp-2 text-neutral-700 dark:text-neutral-300 mb-2 break-words">
                  {leftCard.title}
                </h3>
                <div className="text-xs lg:text-sm line-clamp-3 text-neutral-600 dark:text-neutral-400 leading-relaxed whitespace-pre-line break-words">
                  {leftCard.body}
                </div>
              </div>
            ) : (
              <div
                className="hidden md:block opacity-0 pointer-events-none"
                aria-hidden="true"
              />
            )}

            {/* Active Center Card (Full width on mobile, centered on desktop) */}
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.article
                key={activeCard.id}
                tabIndex={-1}
                aria-labelledby={`card-title-${activeCard.id}`}
                aria-live="polite"
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={shouldReduceMotion ? 0 : 0.2}
                onDragEnd={handleDragEnd}
                layout={!shouldReduceMotion}
                initial={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, scale: 0.96, y: 8 }
                }
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, scale: 0.96, y: -8 }
                }
                transition={
                  shouldReduceMotion
                    ? { duration: 0.15 }
                    : { duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }
                }
                className="w-full rounded-3xl p-5 sm:p-6 md:p-8 bg-white/95 dark:bg-[#1a2035]/95 shadow-[0_16px_36px_rgba(27,36,64,0.08)] dark:shadow-[0_16px_36px_rgba(0,0,0,0.35)] border border-white/60 dark:border-neutral-700/50 min-h-[280px] sm:min-h-[320px] flex flex-col justify-start touch-pan-y"
              >
                {/* Title */}
                <h2
                  id={`card-title-${activeCard.id}`}
                  className="mb-3 md:mb-4 text-xl sm:text-2xl md:text-3xl font-bold leading-tight tracking-tight text-[#1B2440] dark:text-neutral-100 break-words hyphens-auto"
                >
                  {activeCard.title}
                </h2>

                {/* Body */}
                <div className="text-base sm:text-lg md:text-xl leading-relaxed text-neutral-800 dark:text-neutral-200 whitespace-pre-line break-words hyphens-auto">
                  {activeCard.body}
                </div>

                {/* Hint / Mnemonic Note (shown only if provided) */}
                {activeCard.hint && (
                  <div className="mt-4 pt-4 border-t border-neutral-200/70 dark:border-neutral-700/60">
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 break-words">
                      <span className="font-semibold text-neutral-700 dark:text-neutral-300 mr-1.5">
                        Note:
                      </span>
                      {activeCard.hint}
                    </p>
                  </div>
                )}
              </motion.article>
            </AnimatePresence>

            {/* Right Preview Card (md+ only) */}
            {rightCard ? (
              <div
                aria-hidden="true"
                tabIndex={-1}
                onClick={handleNext}
                className="hidden md:flex flex-col justify-start max-h-[260px] overflow-hidden rounded-3xl p-5 bg-white/60 dark:bg-[#141824]/60 border border-neutral-200/40 dark:border-neutral-800/40 opacity-60 blur-[1px] scale-[0.92] transition-all cursor-pointer pointer-events-auto hover:opacity-80"
              >
                <h3 className="text-sm lg:text-base font-bold line-clamp-2 text-neutral-700 dark:text-neutral-300 mb-2 break-words">
                  {rightCard.title}
                </h3>
                <div className="text-xs lg:text-sm line-clamp-3 text-neutral-600 dark:text-neutral-400 leading-relaxed whitespace-pre-line break-words">
                  {rightCard.body}
                </div>
              </div>
            ) : (
              <div
                className="hidden md:block opacity-0 pointer-events-none"
                aria-hidden="true"
              />
            )}
          </div>
        </div>

        {/* Action Controls: Mobile sticky bottom, Desktop standard alignment */}
        <div className="w-full max-w-xl md:max-w-none mx-auto mt-6 md:mt-8">
          <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/85 dark:bg-[#0D111A]/85 backdrop-blur-md px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] border-t border-neutral-200/50 dark:border-neutral-800/50 sm:static sm:bg-transparent sm:backdrop-blur-none sm:p-0 sm:border-0 sm:flex sm:flex-col sm:gap-3">
            {/* Row 1: Previous and Next Buttons */}
            <div className="flex items-center gap-3 w-full sm:justify-between">
              {/* Previous Button */}
              <button
                type="button"
                onClick={handlePrev}
                disabled={isFirst}
                aria-disabled={isFirst}
                aria-label="Previous card"
                className={cn(
                  "flex-1 sm:flex-initial h-12 px-6 rounded-full text-sm font-bold flex items-center justify-center gap-2 transition-all touch-manipulation focus-visible:ring-2 focus-visible:ring-[#1B2440] dark:focus-visible:ring-blue-500 focus-visible:ring-offset-2",
                  isFirst
                    ? "bg-neutral-100 dark:bg-neutral-800/40 text-neutral-400 dark:text-neutral-600 cursor-not-allowed shadow-none"
                    : "bg-white dark:bg-neutral-800 text-[#1B2440] dark:text-neutral-200 shadow-[0_4px_12px_rgba(27,36,64,0.08)] hover:bg-neutral-50 active:scale-95"
                )}
              >
                <ArrowLeft className="w-4 h-4 shrink-0" />
                <span>Previous card</span>
              </button>

              {/* Next Button */}
              <button
                type="button"
                onClick={handleNext}
                disabled={isLast}
                aria-disabled={isLast}
                aria-label={isLast ? "Finished deck" : "Next card"}
                className={cn(
                  "flex-1 sm:flex-initial h-12 px-6 rounded-full text-sm font-bold flex items-center justify-center gap-2 transition-all touch-manipulation focus-visible:ring-2 focus-visible:ring-[#1B2440] dark:focus-visible:ring-blue-500 focus-visible:ring-offset-2",
                  isLast
                    ? "bg-neutral-200 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-600 cursor-not-allowed shadow-none"
                    : "bg-[#1B2440] dark:bg-blue-600 text-white shadow-[0_6px_16px_rgba(27,36,64,0.2)] hover:bg-[#28355a] dark:hover:bg-blue-500 active:scale-95"
                )}
              >
                <span>{isLast ? "Finished" : "Next card"}</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>
            </div>

            {/* Row 2: Save and Report Issue */}
            <div className="flex items-center gap-3 w-full mt-2.5 sm:mt-0 sm:justify-end">
              {onSave && activeCard && (
                <button
                  type="button"
                  onClick={() => onSave(activeCard)}
                  aria-label={isSaved ? "Saved" : "Save card"}
                  className={cn(
                    "flex-1 sm:flex-initial h-11 px-4 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors touch-manipulation focus-visible:ring-2 focus-visible:ring-[#1B2440] dark:focus-visible:ring-blue-500 focus-visible:ring-offset-2",
                    isSaved
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                      : "bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200/80 text-neutral-700 dark:text-neutral-300"
                  )}
                >
                  {isSaved ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <Bookmark className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>{isSaved ? "Saved" : "Save"}</span>
                </button>
              )}

              {onReportIssue && activeCard && (
                <button
                  type="button"
                  onClick={() => onReportIssue(activeCard)}
                  aria-label="Report an issue with this card"
                  className="flex-1 sm:flex-initial h-11 px-4 rounded-full text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200/80 text-neutral-700 dark:text-neutral-300 flex items-center justify-center gap-1.5 transition-colors touch-manipulation focus-visible:ring-2 focus-visible:ring-[#1B2440] dark:focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                >
                  <AlertCircle className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                  <span>Report issue</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
