import { createContext, useContext, useCallback, type ReactNode } from 'react';
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

export function saveLocaleAndReload(locale: Locale): void {
  localStorage.setItem('cortex-locale', JSON.stringify(locale));
  document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = locale;
  window.location.reload();
}

const I18nContext = createContext<{ locale: Locale; t: (key: string) => string }>({
  locale: 'en',
  t: (key: string) => key,
});

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const t = useCallback(
    (key: string): string => {
      return getNestedValue(translations[locale], key) || getNestedValue(translations['en'], key) || key;
    },
    [locale]
  );

  return <I18nContext.Provider value={{ locale, t }}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  return useContext(I18nContext);
}
