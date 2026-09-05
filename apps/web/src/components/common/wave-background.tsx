interface WaveBackgroundProps {
  variant?: "hero" | "subtle"
  className?: string
}

export function WaveBackground({
  variant = "subtle",
  className = "",
}: WaveBackgroundProps) {
  const isHero = variant === "hero"

  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden select-none ${className}`}
      aria-hidden="true"
    >
      <svg
        className="absolute inset-0 h-full w-full object-cover"
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Deep Oceanic Navy Gradient */}
          <linearGradient id="oceanicGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#082366" stopOpacity={isHero ? 1 : 0.85} />
            <stop offset="60%" stopColor="#0d348a" stopOpacity={isHero ? 0.98 : 0.75} />
            <stop offset="100%" stopColor="#1648ad" stopOpacity={isHero ? 0.95 : 0.65} />
          </linearGradient>

          {/* Deep Inset Navy Shadow Gradient */}
          <linearGradient id="oceanicDeep" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#051644" stopOpacity={isHero ? 0.9 : 0.6} />
            <stop offset="100%" stopColor="#092978" stopOpacity={isHero ? 0.95 : 0.7} />
          </linearGradient>

          {/* Soft Periwinkle Lavender Wave */}
          <linearGradient id="periwinkleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#c7d4fc" stopOpacity={isHero ? 0.92 : 0.45} />
            <stop offset="100%" stopColor="#dbe5fd" stopOpacity={isHero ? 0.85 : 0.35} />
          </linearGradient>

          {/* Subtle Glow Filter */}
          <filter id="softGlow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="16" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 1. Top-Left Soft Periwinkle Fluid Flow */}
        <path
          d="M -50 -50 
             L 280 -50 
             C 320 80, 290 140, 240 220 
             C 180 320, 110 390, -50 420 
             Z"
          fill="url(#periwinkleGradient)"
          className={isHero ? "animate-pulse-subtle" : "opacity-60"}
        />

        {/* 2. Top-Right Secondary Periwinkle Under-Swell */}
        <path
          d="M 520 0 
             C 600 120, 720 180, 850 160 
             C 980 140, 1080 80, 1220 120 
             C 1340 160, 1400 240, 1460 320 
             L 1460 0 
             Z"
          fill="url(#periwinkleGradient)"
          className="opacity-75"
        />

        {/* 3. Top-Right Signature Sweeping Deep Oceanic Navy Wave */}
        <path
          d="M 600 0 
             C 660 70, 740 140, 880 150 
             C 1020 160, 1100 100, 1240 180 
             C 1330 230, 1370 340, 1460 380 
             L 1460 0 
             Z"
          fill="url(#oceanicGradient)"
        />

        {/* 4. Top-Right Deep Crest Layer */}
        <path
          d="M 780 0 
             C 830 50, 910 110, 1040 120 
             C 1170 130, 1260 80, 1360 140 
             C 1420 180, 1450 250, 1460 280 
             L 1460 0 
             Z"
          fill="url(#oceanicDeep)"
          className="opacity-80"
        />

        {/* 5. Right Margin Flowing Deep Oceanic Accent Contour */}
        <path
          d="M 1460 350
             C 1380 420, 1360 520, 1420 620
             C 1440 660, 1460 700, 1460 740
             Z"
          fill="url(#oceanicGradient)"
          className="opacity-90"
        />

        {/* 6. Bottom-Right Soft Periwinkle Fluid Wave */}
        <path
          d="M 1460 620
             C 1340 600, 1250 680, 1220 780
             C 1200 840, 1240 880, 1260 920
             L 1460 920
             Z"
          fill="url(#periwinkleGradient)"
        />

        {/* 7. Bottom Center Periwinkle Subtle Wave Crest */}
        <path
          d="M 720 920
             C 840 840, 980 820, 1140 860
             C 1220 880, 1320 910, 1400 920
             Z"
          fill="url(#periwinkleGradient)"
          className="opacity-60"
        />

        {/* 8. Bottom-Left Nested Circular Accent Disks (Matching Reference Image) */}
        {/* Outer Deep Oceanic Disk */}
        <circle
          cx="120"
          cy="820"
          r="260"
          fill="url(#oceanicGradient)"
        />
        {/* Inner Midnight Shadow Arc */}
        <circle
          cx="90"
          cy="840"
          r="200"
          fill="#051644"
          className="opacity-85"
        />
        {/* Core Accent Crescent */}
        <circle
          cx="60"
          cy="860"
          r="140"
          fill="#030d2a"
          className="opacity-90"
        />
      </svg>

      {/* Subtle organic light reflections */}
      <div className="absolute -top-24 right-1/4 size-96 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 left-1/4 size-80 rounded-full bg-accent/20 blur-3xl pointer-events-none" />
    </div>
  )
}
