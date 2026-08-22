import { motion, AnimatePresence } from "framer-motion";
import { useMemo } from "react";

interface ClayCheck3DProps {
  className?: string;
}

export const ClayCheck3D = ({ className = "" }: ClayCheck3DProps) => {
  return (
    <motion.div
      initial={{ scale: 0.6, rotate: -15, opacity: 0 }}
      animate={{
        scale: [0.95, 1.05, 0.98, 1.02, 1],
        rotate: [-4, 4, -2, 2, 0],
        y: [0, -8, 0, -4, 0],
      }}
      transition={{
        duration: 2.2,
        repeat: Infinity,
        repeatType: "mirror",
        ease: "easeInOut",
      }}
      className={`relative flex items-center justify-center ${className}`}
    >
      {/* Radial glowing pulse aura */}
      <motion.div
        animate={{
          scale: [1, 1.35, 1],
          opacity: [0.45, 0.85, 0.45],
        }}
        transition={{
          duration: 1.8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute -inset-4 rounded-full bg-emerald-400/30 blur-2xl"
      />

      {/* 3D Claymorphism Outer Orb */}
      <div
        className="relative flex h-24 w-24 items-center justify-center rounded-3xl sm:h-28 sm:w-28"
        style={{
          background: "linear-gradient(145deg, #34d399, #059669)",
          boxShadow: `
            8px 14px 28px rgba(5, 150, 105, 0.35),
            -4px -4px 16px rgba(255, 255, 255, 0.6),
            inset 5px 5px 10px rgba(255, 255, 255, 0.75),
            inset -6px -6px 12px rgba(4, 120, 87, 0.7)
          `,
        }}
      >
        {/* Specular Highlight */}
        <div className="absolute top-2.5 left-3 h-5 w-10 rotate-[-25deg] rounded-full bg-white/60 blur-[1px]" />

        {/* 3D Clay Checkmark */}
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-14 w-14 drop-shadow-[0_4px_8px_rgba(0,0,0,0.2)] sm:h-16 sm:w-16"
        >
          <motion.path
            d="M12 24.5L20.5 33L36 15"
            stroke="white"
            strokeWidth="5.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.65, ease: "easeOut" }}
          />
        </svg>
      </div>
    </motion.div>
  );
};

export const ClayReport3D = ({ className = "" }: ClayCheck3DProps) => {
  return (
    <motion.div
      initial={{ scale: 0.5, rotate: 20, opacity: 0 }}
      animate={{
        scale: 1,
        rotate: [0, -3, 3, 0],
        y: [0, -6, 0],
        opacity: 1,
      }}
      transition={{
        scale: { type: "spring", stiffness: 260, damping: 20 },
        rotate: { duration: 3, repeat: Infinity, ease: "easeInOut" },
        y: { duration: 2.2, repeat: Infinity, ease: "easeInOut" },
        opacity: { duration: 0.35 },
      }}
      className={`relative flex items-center justify-center ${className}`}
    >
      {/* Glowing aura */}
      <motion.div
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.4, 0.8, 0.4],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute -inset-4 rounded-full bg-sky-400/30 blur-2xl"
      />

      {/* 3D Clay Clipboard / Report Base */}
      <div
        className="relative flex h-24 w-20 flex-col items-center justify-between rounded-2xl p-3 sm:h-28 sm:w-24 sm:p-4"
        style={{
          background: "linear-gradient(150deg, #38bdf8, #0284c7)",
          boxShadow: `
            8px 14px 28px rgba(2, 132, 199, 0.35),
            -4px -4px 16px rgba(255, 255, 255, 0.6),
            inset 4px 4px 8px rgba(255, 255, 255, 0.7),
            inset -5px -5px 10px rgba(3, 105, 161, 0.7)
          `,
        }}
      >
        {/* Specular Highlight */}
        <div className="absolute top-2 left-2.5 h-3.5 w-7 rotate-[-20deg] rounded-full bg-white/60 blur-[1px]" />

        {/* Clip Top */}
        <div
          className="h-3 w-8 rounded-full"
          style={{
            background: "linear-gradient(145deg, #f8fafc, #cbd5e1)",
            boxShadow: "inset 1px 1px 2px white, inset -1px -1px 2px rgba(0,0,0,0.2), 0 2px 4px rgba(0,0,0,0.15)",
          }}
        />

        {/* Chart / Document lines */}
        <div className="flex w-full flex-col gap-1.5 pt-1">
          <div className="h-1.5 w-full rounded-full bg-white/85 shadow-sm" />
          <div className="h-1.5 w-4/5 rounded-full bg-white/70 shadow-sm" />
          <div className="flex items-end justify-between gap-1 pt-1.5">
            <motion.div
              initial={{ height: 4 }}
              animate={{ height: 14 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="w-2.5 rounded-sm bg-emerald-200 shadow-sm"
            />
            <motion.div
              initial={{ height: 4 }}
              animate={{ height: 20 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="w-2.5 rounded-sm bg-amber-200 shadow-sm"
            />
            <motion.div
              initial={{ height: 4 }}
              animate={{ height: 26 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="w-2.5 rounded-sm bg-white shadow-sm"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export const ParticleExplosion = () => {
  const particles = useMemo(() => {
    const colors = ["#10b981", "#06b6d4", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#34d399"];
    return Array.from({ length: 32 }, (_, i) => {
      const angle = (i / 32) * 360 * (Math.PI / 180);
      const distance = 55 + Math.random() * 85;
      const size = 6 + Math.random() * 8;
      const color = colors[i % colors.length];
      return {
        id: i,
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        size,
        color,
        delay: Math.random() * 0.08,
      };
    });
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
          animate={{
            x: p.x,
            y: p.y,
            scale: [0, 1.3, 0.4, 0],
            opacity: [1, 1, 0.8, 0],
          }}
          transition={{
            duration: 1.1,
            delay: p.delay,
            ease: [0.22, 1, 0.36, 1],
          }}
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            boxShadow: `0 2px 8px ${p.color}88, inset 1px 1px 2px rgba(255,255,255,0.8)`,
          }}
          className="rounded-full"
        />
      ))}
    </div>
  );
};

interface ConfirmationAnimationFlowProps {
  phase: "confirmed" | "transforming" | "ready";
}

export const ConfirmationAnimationFlow = ({ phase }: ConfirmationAnimationFlowProps) => {
  return (
    <div className="relative flex h-36 w-full items-center justify-center sm:h-40">
      <AnimatePresence mode="wait">
        {phase === "confirmed" && (
          <motion.div
            key="check"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.4, opacity: 0, filter: "blur(6px)" }}
            transition={{ duration: 0.45 }}
            className="relative"
          >
            <ClayCheck3D />
          </motion.div>
        )}

        {(phase === "transforming" || phase === "ready") && (
          <motion.div
            key="report"
            initial={{ scale: 0.3, opacity: 0, rotate: -20 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            className="relative"
          >
            <ParticleExplosion />
            <ClayReport3D />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
