import { type ReactNode, useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import {
  BookOpen, BrainCircuit, CalendarClock, Check, ChevronRight, Command,
  FolderKanban, Gamepad2, Headphones, LayoutDashboard, LogOut, Menu,
  Search, Settings2, Trash2, X, Cpu
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { signOut } from '@/lib/supabase';
import { useUserContext } from '@/lib/user-store';
import { WindowControls } from '@/components/window-controls';

const navItems = [
  { href: '/overview', labelKey: 'nav.overview', icon: LayoutDashboard },
  { href: '/projects', labelKey: 'nav.projects', icon: FolderKanban },
  { href: '/study', labelKey: 'nav.study', icon: BookOpen },
  { href: '/games', labelKey: 'nav.games', icon: Gamepad2 },
  { href: '/media', labelKey: 'nav.media', icon: Headphones },
  { href: '/my-pc', labelKey: 'nav.myPc', icon: Cpu },
  { href: '/deadlines', labelKey: 'nav.deadlines', icon: CalendarClock },
  { href: '/settings', labelKey: 'nav.settings', icon: Settings2 },
];

const navGroups = [
  { labelKey: 'nav.workspace', items: [navItems[0], navItems[1]] },
  { labelKey: 'nav.academic', items: [navItems[2], navItems[6]] },
  { labelKey: 'nav.utilities', items: [navItems[3], navItems[4], navItems[5], navItems[7]] },
];

export function AppShell({ children, toast }: { children: ReactNode; toast: string }) {
  const { t, locale } = useTranslation();
  const { displayName, email, avatarChar, avatarUrl } = useUserContext();
  const [location] = useLocation();
  const [mobileNav, setMobileNav] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="app-shell" data-testid="app-shell-root">
      {/* Toast notification */}
      {toast && (
        <div className="toast panel" role="status" aria-live="polite">
          <Check size={16} /><span>{toast}</span>
        </div>
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-mark brand-logo-wrap">
            <img src="/logo.png" alt="CortexOS" className="brand-logo-img" />
          </div>
          <div>
            <strong>CORTEX<span>OS</span></strong>
            <small className="mono">LOCAL / 02</small>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Main Navigation">
          {navGroups.map((group) => (
            <div key={group.labelKey} className="nav-group">
              <div className="nav-group-label">{t(group.labelKey)}</div>
              {group.items.map(({ href, labelKey, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`nav-item ${location === href ? 'nav-active' : ''}`}
                  onClick={() => setMobileNav(false)}
                  data-testid={`link-nav-${href.replace('/', '')}`}
                >
                  <Icon size={17} />
                  <span>{t(labelKey)}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-spacer" />

        <Link href="/settings" className="account-card" title={t('nav.settings')}>
          <div className="account-avatar-wrapper">
            <div className="account-avatar">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="account-avatar-img" />
              ) : (
                avatarChar
              )}
            </div>
            <span className="account-online" />
          </div>
          <div className="account-copy" title={email}>
            <b>{displayName}</b>
            <small className="mono truncate max-w-[130px] block">{email}</small>
          </div>
          <button
            type="button"
            className="btn btn-ghost account-signout"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleSignOut();
            }}
            aria-label={t('account.signOut')}
            title={t('account.signOut')}
          >
            <LogOut size={15} />
          </button>
        </Link>
      </aside>

      {mobileNav && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}

      <main className="main-area">
        <header className="topbar" data-tauri-drag-region>
          <button className="btn btn-ghost mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open navigation" data-testid="button-open-navigation" data-tauri-drag-region="false">
            <Menu size={19} />
          </button>
          <div className="crumb mono" data-tauri-drag-region>
            <span className="crumb-signal" />
            CORTEX / {location === '/' ? 'OVERVIEW' : location.slice(1).toUpperCase()}
          </div>
          
          <div data-tauri-drag-region style={{ flex: 1, height: '100%', minWidth: '20px' }} />

          <div className="topbar-actions" data-tauri-drag-region="false">
            <button className="search-trigger" onClick={() => setSearchOpen(true)} data-testid="button-command-search">
              <Search size={14} /><span>{t('app.commandSearch')}</span><kbd>Ctrl+K</kbd>
            </button>
          </div>

          {/* Clean Native Windows 11 Window Controls */}
          <WindowControls />
        </header>

        <div className="page-wrap page-in" key={location}>{children}</div>
      </main>

      {/* Simple, tiny version label in bottom right corner: no box, no light */}
      <div className="bottom-corner-version mono" data-testid="text-corner-version">
        {locale === 'ar' ? 'اصدار تجريبي 0.2.31' : 'Beta 0.2.31'}
      </div>

      {searchOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setSearchOpen(false); }}>
          <div className="modal panel page-in" role="dialog" aria-modal="true" aria-label={t('app.commandSearch')}>
            <div className="modal-head">
              <h2>{t('app.commandSearch')}</h2>
              <button className="btn btn-ghost" onClick={() => setSearchOpen(false)} aria-label="Close"><X size={17} /></button>
            </div>
            <div className="command-box">
              <Command size={17} />
              <input autoFocus placeholder={t('app.commandPlaceholder')} data-testid="input-command-search" />
              <kbd>ESC</kbd>
            </div>
            <div className="command-list">
              {navItems.slice(0, 5).map(({ href, labelKey, icon: Icon }) => (
                <Link key={href} href={href} onClick={() => setSearchOpen(false)} className="command-item">
                  <Icon size={16} />{t(labelKey)}<ChevronRight size={14} />
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
