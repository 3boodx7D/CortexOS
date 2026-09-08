import { createContext, useContext, useCallback, useState, useEffect, type ReactNode } from 'react';
import en from '../locales/en.json';
import ar from '../locales/ar.json';

export type Locale = 'en' | 'ar';

const translations: Record<Locale, typeof en> = { en, ar };

function getNestedValue(obj: any, path: string): string {
  return path.split('.').reduce((acc, part) => acc?.[part], obj) ?? path;
}

export function getStoredLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  try {
    const saved = localStorage.getItem('cortex-locale');
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed === 'ar' ? 'ar' : 'en';
    }
  } catch {}
  return 'en';
}

// Seamless backward-compatible updater with zero page reload
export function saveLocaleAndReload(locale: Locale): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('cortex-locale', JSON.stringify(locale));
  } catch {}
  document.documentElement.classList.add('locale-morph');
  document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = locale;
  setTimeout(() => {
    document.documentElement.classList.remove('locale-morph');
  }, 220);
}

export interface I18nContextType {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  locale: 'en',
  setLocale: () => {},
  t: (key: string) => key,
});

export function I18nProvider({ 
  locale: initialLocale, 
  children 
}: { 
  locale?: Locale; 
  children: ReactNode; 
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale || getStoredLocale);

  const setLocale = useCallback((next: Locale) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('cortex-locale', JSON.stringify(next));
    } catch {}

    document.documentElement.classList.add('locale-morph');
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = next;
    setLocaleState(next);

    setTimeout(() => {
      document.documentElement.classList.remove('locale-morph');
    }, 220);
  }, []);

  useEffect(() => {
    const current = getStoredLocale();
    document.documentElement.dir = current === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = current;
  }, []);

  const t = useCallback(
    (key: string): string => {
      return getNestedValue(translations[locale], key) || getNestedValue(translations['en'], key) || key;
    },
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  return useContext(I18nContext);
}
