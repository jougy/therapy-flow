import React from 'react';

export interface SlideItem {
  headline?: string;
  body?: string;
  cta?: string;
}

export interface BrandKitProps {
  brandName?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
}

export interface CarouselToVideoTemplateProps {
  slides: SlideItem[];
  brandKit?: BrandKitProps;
  fps?: number;
  width?: number;
  height?: number;
}

export const CarouselToVideoTemplate: React.FC<CarouselToVideoTemplateProps> = ({
  slides = [],
  brandKit = {},
  width = 1080,
  height = 1080,
}) => {
  const bg = brandKit.backgroundColor || '#0f172a';
  const primary = brandKit.primaryColor || '#3b82f6';
  const secondary = brandKit.secondaryColor || '#e2e8f0';
  const accent = brandKit.accentColor || '#10b981';
  const brandName = brandKit.brandName || 'Pluri-Health';

  const currentSlide = slides[0] || {
    headline: 'Transforming Clinical Operations',
    body: 'Automate notes, scheduling, and patient engagement with AI.',
    cta: 'Learn More',
  };

  return (
    <div
      style={{
        width,
        height,
        backgroundColor: bg,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '80px',
        fontFamily: 'system-ui, sans-serif',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '28px', fontWeight: 700, color: secondary }}>{brandName}</span>
        <div style={{ width: '100px', height: '10px', borderRadius: '5px', backgroundColor: primary }} />
      </div>

      {/* Slide Content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
        <h1 style={{ fontSize: '64px', fontWeight: 800, color: secondary, margin: 0, lineHeight: 1.15 }}>
          {currentSlide.headline}
        </h1>
        {currentSlide.body && (
          <p style={{ fontSize: '36px', color: '#94a3b8', margin: 0, lineHeight: 1.4 }}>
            {currentSlide.body}
          </p>
        )}
      </div>

      {/* CTA Footer */}
      {currentSlide.cta && (
        <div
          style={{
            padding: '24px 40px',
            borderRadius: '20px',
            backgroundColor: `${primary}25`,
            border: `2px solid ${primary}`,
            display: 'inline-block',
            alignSelf: 'flex-start',
          }}
        >
          <span style={{ fontSize: '32px', fontWeight: 'bold', color: accent }}>
            {currentSlide.cta}
          </span>
        </div>
      )}
    </div>
  );
};

export default CarouselToVideoTemplate;
