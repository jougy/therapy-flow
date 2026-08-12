import { useState, useRef, useEffect } from "react";
import { Wifi, Battery, Smartphone } from "lucide-react";

interface MobileTouchSimulatorProps {
  iframeSrc: string;
}

export function MobileTouchSimulator({ iframeSrc }: MobileTouchSimulatorProps) {
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [isPressing, setIsPressing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastYRef = useRef(0);
  const dragDistanceRef = useRef(0);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsPressing(true);
    setIsDragging(true);
    startPosRef.current = { x: e.clientX, y: e.clientY };
    lastYRef.current = e.clientY;
    dragDistanceRef.current = 0;

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const id = Date.now();
      setRipples((prev) => [...prev.slice(-4), { id, x, y }]);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCursorPos({ x, y });

    if (isDragging && iframeRef.current?.contentWindow) {
      const deltaY = lastYRef.current - e.clientY;
      dragDistanceRef.current += Math.abs(deltaY);
      iframeRef.current.contentWindow.scrollBy({ top: deltaY, behavior: "auto" });
      lastYRef.current = e.clientY;
    }
  };

  const handlePointerUp = () => {
    setIsPressing(false);
    setIsDragging(false);
  };

  const handlePointerLeave = () => {
    setCursorPos(null);
    setIsPressing(false);
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.scrollBy({ top: e.deltaY, behavior: "auto" });
    }
  };

  return (
    <div className="flex-1 bg-slate-950/95 py-6 px-4 flex flex-col items-center justify-center overflow-y-auto select-none min-h-[calc(100vh-100px)]">
      <div className="text-center mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-amber-400 bg-amber-950/80 border border-amber-800/60 px-3 py-1 rounded-full shadow-sm inline-flex items-center gap-1.5">
          <Smartphone className="h-3.5 w-3.5 text-amber-400" />
          Simulação Touchscreen Mobile Ativa (390px)
        </span>
        <p className="text-[11px] text-slate-400 mt-1">
          Ponteiro touch com drag-to-scroll ativo em qualquer posição. Clique ou arraste na tela do celular para simular o toque do usuário.
        </p>
      </div>

      {/* Smartphone Device Frame */}
      <div className="relative group">
        {/* Buttons mockup */}
        <div className="absolute -left-[14px] top-24 w-[4px] h-10 bg-slate-700 rounded-l-md" />
        <div className="absolute -left-[14px] top-38 w-[4px] h-10 bg-slate-700 rounded-l-md" />
        <div className="absolute -right-[14px] top-28 w-[4px] h-14 bg-slate-700 rounded-r-md" />

        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onWheel={handleWheel}
          className="w-[414px] h-[844px] bg-black border-[12px] border-slate-800 rounded-[50px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col relative cursor-grab active:cursor-grabbing"
        >
          {/* Status Bar */}
          <div className="bg-slate-950 text-slate-200 text-[11px] py-1.5 px-6 flex justify-between items-center shrink-0 border-b border-slate-800/80 z-30 pointer-events-none">
            <span className="font-semibold tracking-tight">09:41</span>
            {/* Dynamic Island / Notch */}
            <div className="w-24 h-4 bg-black rounded-full border border-slate-800/60 flex items-center justify-center gap-1.5 shadow-inner">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-800" />
              <div className="w-1.5 h-1.5 rounded-full bg-blue-900/60" />
            </div>
            <div className="flex items-center gap-1.5 text-[10px]">
              <Wifi className="h-3 w-3 text-slate-300" />
              <Battery className="h-3.5 w-3.5 text-slate-300" />
            </div>
          </div>

          {/* Fake Touch Pointer Cursor */}
          {cursorPos && (
            <div
              className={`pointer-events-none absolute z-50 rounded-full border-2 border-white/90 bg-primary/30 shadow-[0_0_12px_rgba(0,0,0,0.5)] backdrop-blur-[1px] transition-transform duration-75 -translate-x-1/2 -translate-y-1/2 ${
                isPressing ? "w-7 h-7 scale-90 bg-primary/60 border-primary" : "w-8 h-8 scale-100"
              }`}
              style={{ left: cursorPos.x, top: cursorPos.y }}
            >
              <div className="w-2 h-2 rounded-full bg-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 shadow-sm" />
            </div>
          )}

          {/* Touch Ripple Feedback */}
          {ripples.map((r) => (
            <span
              key={r.id}
              className="pointer-events-none absolute z-40 w-10 h-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/40 animate-ping"
              style={{ left: r.x, top: r.y }}
            />
          ))}

          {/* Drag Overlay during swipe gestures */}
          {isDragging && (
            <div className="absolute inset-0 z-40 bg-transparent cursor-grabbing" />
          )}

          {/* Simulated Mobile Iframe with 390px Viewport */}
          <iframe
            ref={iframeRef}
            src={iframeSrc}
            title="Simulação Mobile Viewport (390px)"
            className="w-full h-full border-0 bg-background flex-1"
          />

          {/* Home Indicator */}
          <div className="bg-slate-950 py-1.5 flex justify-center items-center shrink-0 border-t border-slate-900 z-30 pointer-events-none">
            <div className="w-32 h-1 bg-slate-600 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

