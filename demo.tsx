import React, { useState } from "react";
import FlashcardCarousel, { Flashcard } from "@/components/ui/flashcard-carousel";

const sampleCards: Flashcard[] = [
  {
    id: "CARD-01",
    title: "Define: mineral",
    body: "A naturally occurring, inorganic solid with a definite chemical composition and an ordered crystalline structure.",
    hint: "Short definition testing compact vertical balance.",
  },
  {
    id: "CARD-02",
    title: "Order the atmosphere layers from the surface upward",
    body: "1 Troposphere → 2 Stratosphere → 3 Mesosphere → 4 Thermosphere → 5 Exosphere\n\nNote temperature inversion occurs in stratosphere due to UV absorption by ozone.",
    hint: "Mnemonic: Tall Students Must Think Everyday",
  },
  {
    id: "CARD-03",
    title: "Earth as a Life-Support System: Detailed Biogeochemical Cycles and Energy Flux",
    body: `The Earth functions as a single integrated biogeochemical engine driven by incoming solar insolation and regulated by interconnected cycles of Carbon, Nitrogen, Phosphorus, and Water.

1. Carbon Cycle: Photosynthesis captures atmospheric CO₂ (approx. 6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂), while respiration and combustion return it. Deep oceanic sinks store the vast majority of carbon.

2. Nitrogen Cycle: Diazotrophs fix inert atmospheric N₂ into reactive NH₃/NH₄⁺. Nitrosomonas oxidizes ammonia to NO₂⁻, followed by Nitrobacter oxidizing it to bioavailable NO₃⁻, which plants assimilate before denitrifying bacteria return N₂ to the atmosphere.

3. Phosphorus Cycle: Unlike carbon or nitrogen, phosphorus possesses no significant gaseous phase; it cycles through geological weathering, uptake by flora, trophic transfer, and sedimentation into marine deposits over millions of years.

4. Thermodynamics: Energy flows unidirectionally through trophic levels following Lindeman's 10% ecological efficiency law, while chemical nutrients circulate continuously through closed bio-geosphere loops.`,
    hint: "Comprehensive 150+ word card testing fluid auto-growth and scrolling behavior without clipping.",
  },
  {
    id: "CARD-04",
    title: "Net percentage change formula",
    body: "Net Percentage Change = a + b + (a × b / 100)%\n\nApplies to successive discounts, compounding inflation, and sequential area changes.\nFormula: Δ% = a + b + (ab/100)",
    hint: "Remember to use negative values for discounts or depreciations.",
  },
];

export default function FlashcardDemo() {
  const [savedIds, setSavedIds] = useState<string[]>(["CARD-02"]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleSave = (card: Flashcard) => {
    setSavedIds((prev) =>
      prev.includes(card.id) ? prev.filter((id) => id !== card.id) : [...prev, card.id]
    );
  };

  const handleReport = (card: Flashcard) => {
    alert(`Report submitted for ${card.id}: "${card.title}"`);
  };

  return (
    <div className="min-h-dvh w-full bg-[#F6F5FD] dark:bg-[#0D111A] py-6 sm:py-10 px-0 sm:px-4 flex flex-col justify-between overflow-x-clip">
      {/* Header & Page Title */}
      <header className="w-full max-w-5xl mx-auto px-4 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#769BCD] mb-1">
              learn-skit · Revision Deck
            </p>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#1B2440] dark:text-neutral-100 tracking-tight break-words">
              Earth as a Life-Support System
            </h1>
          </div>

          {/* Horizontally scrollable navigation tabs on mobile */}
          <nav
            aria-label="Study modes"
            className="flex items-center gap-1 p-1 bg-white/70 dark:bg-neutral-800/70 backdrop-blur-md rounded-2xl border border-neutral-200/50 dark:border-neutral-700/50 overflow-x-auto no-scrollbar snap-x max-w-full"
          >
            {[
              { id: "cards", label: "Cards", active: true },
              { id: "practice", label: "Practice", active: false },
              { id: "notes", label: "Cheat sheet", active: false },
              { id: "video", label: "Video", active: false },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap snap-start transition-all ${
                  tab.active
                    ? "bg-[#1B2440] text-white shadow-sm"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Flashcard Carousel */}
      <main className="w-full max-w-5xl mx-auto flex-1 flex flex-col justify-center">
        <FlashcardCarousel
          cards={sampleCards}
          initialIndex={currentIndex}
          onIndexChange={setCurrentIndex}
          onSave={handleSave}
          onReportIssue={handleReport}
          savedIds={savedIds}
        />
      </main>
    </div>
  );
}
