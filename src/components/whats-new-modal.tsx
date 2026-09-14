import React, { useState, useEffect } from 'react';
import { Sparkles, X, Zap, Sliders, UserCheck, ArrowRight, Check } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { usePersistent } from '@/hooks/use-persistent';
import releaseData from '@/data/release-notes.json';

const ICON_MAP: Record<string, React.ElementType> = {
  Zap,
  Sliders,
  UserCheck,
  Sparkles,
};

export function WhatsNewModal() {
  const { locale } = useTranslation();
  const [lastSeenVersion, setLastSeenVersion] = usePersistent<string>('cortex-last-seen-version', '');
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    // Only show if the user hasn't seen this specific version yet
    if (lastSeenVersion !== releaseData.version) {
      // Small 300ms delay so the app UI loads smoothly first
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [lastSeenVersion]);

  const handleDismiss = () => {
    setIsClosing(true);
    setTimeout(() => {
      setLastSeenVersion(releaseData.version);
      setIsOpen(false);
      setIsClosing(false);
    }, 200);
  };

  if (!isOpen) return null;

  const title = releaseData.title[locale === 'ar' ? 'ar' : 'en'] || releaseData.title.en;
  const subtitle = releaseData.subtitle[locale === 'ar' ? 'ar' : 'en'] || releaseData.subtitle.en;

  return (
    <div
      className={`cortex-whatsnew-backdrop ${isClosing ? 'is-closing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="whats-new-title"
      data-testid="modal-whats-new-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleDismiss();
      }}
    >
      <div
        className={`cortex-whatsnew-card ${isClosing ? 'is-closing' : ''}`}
        data-testid="modal-whats-new-card"
      >
        {/* Header Glow & Close Button */}
        <div className="cortex-whatsnew-header">
          <div className="cortex-whatsnew-badge">
            <span className="cortex-whatsnew-pulse" />
            <span className="mono font-semibold">v{releaseData.version}</span>
          </div>

          <button
            type="button"
            className="cortex-whatsnew-close"
            onClick={handleDismiss}
            aria-label={locale === 'ar' ? 'إغلاق' : 'Close'}
            data-testid="button-whats-new-close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Hero Title & Subtitle */}
        <div className="cortex-whatsnew-hero">
          <div className="cortex-whatsnew-icon-wrap">
            <Sparkles size={24} className="text-cyan" />
          </div>
          <div>
            <h2 id="whats-new-title" className="cortex-whatsnew-title">
              {title}
            </h2>
            <p className="cortex-whatsnew-subtitle">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Highlights List */}
        <div className="cortex-whatsnew-highlights">
          {releaseData.highlights.map((item, index) => {
            const Icon = ICON_MAP[item.icon] || Sparkles;
            const itemTitle = item.title[locale === 'ar' ? 'ar' : 'en'] || item.title.en;
            const itemDesc = item.description[locale === 'ar' ? 'ar' : 'en'] || item.description.en;

            return (
              <div key={index} className="cortex-whatsnew-item">
                <div className="cortex-whatsnew-item-icon">
                  <Icon size={16} />
                </div>
                <div className="cortex-whatsnew-item-content">
                  <h4>{itemTitle}</h4>
                  <p>{itemDesc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Button */}
        <div className="cortex-whatsnew-actions">
          <button
            type="button"
            className="cortex-whatsnew-btn"
            onClick={handleDismiss}
            data-testid="button-whats-new-dismiss"
          >
            <span>{locale === 'ar' ? 'استكشاف CortexOS' : 'Explore CortexOS'}</span>
            <Check size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
