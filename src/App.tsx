import { useEffect, useState } from 'react';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthGate } from '@/components/auth-gate';
import { AppShell } from '@/components/app-shell';
import { I18nProvider, getStoredLocale } from '@/lib/i18n';
import { usePersistent } from '@/hooks/use-persistent';

import Overview from '@/pages/overview';
import Projects from '@/pages/projects';
import Study from '@/pages/study';
import Games from '@/pages/games';
import Media from '@/pages/media';
import Janitor from '@/pages/janitor';
import Deadlines from '@/pages/deadlines';
import Settings from '@/pages/settings';
import NotFound from '@/pages/not-found';

function App() {
  const locale = getStoredLocale();
  const [toast, setToast] = useState('');
  const [theme] = usePersistent<'dark' | 'light'>('cortex-theme', 'dark');
  const [motion] = usePersistent<string>('cortex-motion', 'balanced');

  useEffect(() => {
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-motion', motion);
  }, [locale, theme, motion]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2400);
  };

  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <ErrorBoundary>
        <TooltipProvider>
          <I18nProvider locale={locale}>
            <AuthGate>
              <AppShell toast={toast}>
                <Switch>
                  <Route path="/"><Overview notify={notify} /></Route>
                  <Route path="/overview"><Overview notify={notify} /></Route>
                  <Route path="/projects"><Projects notify={notify} /></Route>
                  <Route path="/study"><Study notify={notify} /></Route>
                  <Route path="/games"><Games notify={notify} /></Route>
                  <Route path="/media"><Media notify={notify} /></Route>
                  <Route path="/janitor"><Janitor notify={notify} /></Route>
                  <Route path="/deadlines"><Deadlines notify={notify} /></Route>
                  <Route path="/settings"><Settings notify={notify} /></Route>
                  <Route><NotFound /></Route>
                </Switch>
              </AppShell>
            </AuthGate>
          </I18nProvider>
          <Toaster />
        </TooltipProvider>
      </ErrorBoundary>
    </WouterRouter>
  );
}

export default App;