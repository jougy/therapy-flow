import React from 'react';

export interface SceneItem {
  durationSec: number;
  hookText: string;
  narration?: string;
}

export interface BrandKitProps {
  brandName?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
}

export interface PluriReelTemplateProps {
  scenes: SceneItem[];
  brandKit?: BrandKitProps;
  fps?: number;
  width?: number;
  height?: number;
}

export const PluriReelTemplate: React.FC<PluriReelTemplateProps> = ({
  scenes = [],
  brandKit = {},
  width = 1080,
  height = 1920,
}) => {
  const bg = brandKit.backgroundColor || '#0f172a';
  const primary = brandKit.primaryColor || '#3b82f6';
  const secondary = brandKit.secondaryColor || '#e2e8f0';
  const accent = brandKit.accentColor || '#10b981';
  const brandName = brandKit.brandName || 'Pluri-Health';

  return (
    <div
      style={{
        width,
        height,
        backgroundColor: bg,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '100px 80px',
        fontFamily: 'system-ui, sans-serif',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div style={{ width: '80px', height: '12px', borderRadius: '6px', backgroundColor: primary }} />
        <span style={{ fontSize: '32px', fontWeight: 700, color: secondary }}>{brandName}</span>
      </div>

      {/* Main Reel Content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
        {scenes.map((scene, idx) => (
          <div
            key={idx}
            style={{
              padding: '40px',
              borderRadius: '24px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: `1px solid rgba(255, 255, 255, 0.1)`,
            }}
          >
            <span style={{ fontSize: '24px', color: accent, fontWeight: 600, display: 'block', marginBottom: '12px' }}>
              Scene {idx + 1} ({scene.durationSec}s)
            </span>
            <p style={{ fontSize: '48px', fontWeight: 800, color: secondary, margin: 0, lineHeight: 1.2 }}>
              {scene.hookText}
            </p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '24px', color: '#64748b' }}>Clinical Automation & AI</span>
        <div style={{ padding: '16px 32px', borderRadius: '16px', backgroundColor: primary, color: '#ffffff', fontSize: '28px', fontWeight: 'bold' }}>
          Explore Pluri-Health
        </div>
      </div>
    </div>
  );
};

export default PluriReelTemplate;
