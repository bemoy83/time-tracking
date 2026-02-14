/**
 * InstallPrompt component.
 * Shows a prompt to install the PWA on supported devices.
 *
 * Requirements from CONTEXT.md:
 * - Installable on iOS Safari and Android Chrome
 * - No third-party install SDKs
 */

import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Listen for beforeinstallprompt (Android Chrome)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show prompt after a delay (don't interrupt immediately)
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Show iOS prompt if not installed and on iOS
    if (iOS && !standalone) {
      setTimeout(() => setShowPrompt(true), 5000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Don't show again for this session
    sessionStorage.setItem('installPromptDismissed', 'true');
  };

  // Don't show if already installed or dismissed
  if (isStandalone || !showPrompt) return null;
  if (sessionStorage.getItem('installPromptDismissed')) return null;

  return (
    <div className="install-prompt" role="dialog" aria-labelledby="install-title">
      <div className="install-prompt__content">
        <div className="install-prompt__icon" aria-hidden="true">
          <ClockIcon />
        </div>
        <div className="install-prompt__text">
          <h2 id="install-title" className="install-prompt__title">
            Install Time Tracking
          </h2>
          <p className="install-prompt__description">
            {isIOS
              ? 'Tap the share button, then "Add to Home Screen"'
              : 'Install for quick access and offline use'}
          </p>
        </div>
      </div>

      <div className="install-prompt__actions">
        <button
          className="install-prompt__btn install-prompt__btn--dismiss"
          onClick={handleDismiss}
        >
          Not now
        </button>
        {!isIOS && deferredPrompt && (
          <button
            className="install-prompt__btn install-prompt__btn--install"
            onClick={handleInstall}
          >
            Install
          </button>
        )}
        {isIOS && (
          <button
            className="install-prompt__btn install-prompt__btn--install"
            onClick={handleDismiss}
          >
            Got it
          </button>
        )}
      </div>
    </div>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" className="install-prompt__clock-icon">
      <rect width="48" height="48" rx="12" fill="#2563eb" />
      <circle cx="24" cy="24" r="14" stroke="#fff" strokeWidth="2.5" />
      <path
        d="M24 12v12l8.5 5"
        stroke="#fff"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
