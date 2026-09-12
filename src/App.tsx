import { useEffect, useState } from 'react';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthGate } from '@/components/auth-gate';
import { AppShell } from '@/components/app-shell';
import { I18nProvider } from '@/lib/i18n';
import { usePersistent } from '@/hooks/use-persistent';
import { useWindowPersistence } from '@/hooks/use-window-persistence';
import { DesktopDialogProvider } from '@/components/ui/desktop-dialog';
import { Onboarding } from '@/components/onboarding';
import { isTauri, invoke } from '@/lib/tauri';
import { setDaemonToken } from '@/lib/api-client';
import type { MotionMode } from '@/pages/settings';

import Overview from '@/pages/overview';
import Projects from '@/pages/projects';
import Study from '@/pages/study';
import CortexAiPage from '@/pages/cortex-ai';
import Games from '@/pages/games';
import Media from '@/pages/media';
import Janitor from '@/pages/janitor';
import MyPc from '@/pages/my-pc';
import Deadlines from '@/pages/deadlines';
import Settings from '@/pages/settings';
import ProjectDetailsPage from '@/pages/project-details';
import TeamCollaborationPage from '@/pages/team';
import FriendsPage from '@/pages/friends';
import OwnerCockpit from '@/pages/owner-cockpit';
import NotFound from '@/pages/not-found';

function App() {
  useWindowPersistence();
  const [toast, setToast] = useState('');
  const [theme, setTheme] = usePersistent<'dark' | 'light'>('cortex-theme', 'dark');
  const [motion, setMotion] = usePersistent<MotionMode>('cortex-motion', 'cinematic');
  const [onboardingDone, setOnboardingDone] = usePersistent<boolean>('cortex-onboarding-done', false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-motion', motion);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme, motion]);

  // Securely retrieve in-memory daemon token from Tauri backend
  useEffect(() => {
    if (isTauri()) {
      invoke<string>('get_daemon_token')
        .then((res) => {
          if (res && res.value) setDaemonToken(res.value);
        })
        .catch(() => {});
    }
  }, []);

  // Responsive notification handler with auto-hide
  const notify = (message: string) => {
    if (!message) return;
    setToast(message);
    window.clearTimeout((window as any)._cortexToastTimer);
    (window as any)._cortexToastTimer = window.setTimeout(() => setToast(''), 3200);
  };

  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <ErrorBoundary>
        <TooltipProvider>
          <I18nProvider>
            <DesktopDialogProvider>
              <AuthGate>
                {!onboardingDone ? (
                  <Onboarding
                    theme={theme}
                    motionMode={motion}
                    onThemeChange={setTheme}
                    onMotionChange={setMotion}
                    onComplete={() => setOnboardingDone(true)}
                  />
                ) : (
                  <AppShell toast={toast}>
                    <Switch>
                      <Route path="/"><Overview notify={notify} /></Route>
                      <Route path="/overview"><Overview notify={notify} /></Route>
                      <Route path="/projects"><Projects notify={notify} /></Route>
                      <Route path="/project/:id"><ProjectDetailsPage notify={notify} /></Route>
                      <Route path="/team"><TeamCollaborationPage notify={notify} /></Route>
                      <Route path="/collaboration"><TeamCollaborationPage notify={notify} /></Route>
                      <Route path="/friends"><FriendsPage /></Route>
                      <Route path="/study"><Study notify={notify} /></Route>
                      <Route path="/cortex-ai"><CortexAiPage notify={notify} /></Route>
                      <Route path="/games"><Games notify={notify} /></Route>
                      <Route path="/media"><Media notify={notify} /></Route>
                      <Route path="/janitor"><Janitor notify={notify} /></Route>
                      <Route path="/my-pc"><MyPc /></Route>
                      <Route path="/deadlines"><Deadlines notify={notify} /></Route>
                      <Route path="/settings"><Settings notify={notify} /></Route>
                      <Route path="/owner"><OwnerCockpit /></Route>
                      <Route><NotFound /></Route>
                    </Switch>
                  </AppShell>
                )}
              </AuthGate>
            </DesktopDialogProvider>
          </I18nProvider>
          <Toaster />
        </TooltipProvider>
      </ErrorBoundary>
    </WouterRouter>
  );
}

export default App;