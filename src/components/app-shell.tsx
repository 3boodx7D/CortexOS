import { type ReactNode, useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  BookOpen, BrainCircuit, CalendarClock, Check, ChevronRight, Command,
  FolderKanban, Gamepad2, Headphones, LayoutDashboard, LogOut, Menu,
  Search, Settings2, Trash2, X,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { signOut } from '@/lib/supabase';

const navItems = [
  { href: '/overview', labelKey: 'nav.overview', icon: LayoutDashboard },
  { href: '/projects', labelKey: 'nav.projects', icon: FolderKanban },
  { href: '/study', labelKey: 'nav.study', icon: BookOpen },
  { href: '/games', labelKey: 'nav.games', icon: Gamepad2 },
  { href: '/media', labelKey: 'nav.media', icon: Headphones },
  { href: '/janitor', labelKey: 'nav.janitor', icon: Trash2 },
  { href: '/deadlines', labelKey: 'nav.deadlines', icon: CalendarClock },
];

const navGroups = [
  { labelKey: 'nav.workspace', items: [navItems[0], navItems[1]] },
  { labelKey: 'nav.academic', items: [navItems[2], navItems[6]] },
  { labelKey: 'nav.utilities', items: [navItems[3], navItems[4], navItems[5]] },
];

export function AppShell({ children, toast }: { children: ReactNode; toast: string }) {
  const { t, locale } = useTranslation();
  const [location] = useLocation();
  const [mobileNav, setMobileNav] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      // session cleared locally regardless
    }
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><BrainCircuit size={19} /></div>
          <div><strong>CORTEX<span>OS</span></strong><small className="mono">LOCAL / 02</small></div>
          <button className="btn btn-ghost mobile-close" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X size={17} /></button>
        </div>

        <nav className="nav-list" aria-label="Primary navigation">
          {navGroups.map(({ labelKey, items }) => (
            <div className="nav-group" key={labelKey}>
              <div className="nav-group-label mono">{t(labelKey)}</div>
              {items.map(({ href, labelKey: itemKey, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileNav(false)}
                  className={`nav-item ${location === href || (href === '/overview' && location === '/') ? 'nav-active' : ''}`}
                  data-testid={`link-nav-${href.slice(1)}`}
                >
                  <Icon size={17} strokeWidth={1.8} /><span>{t(itemKey)}</span>
                  {href === '/deadlines' && <span className="nav-count">4</span>}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-spacer" />

        <div className="account-card">
          <div className="account-avatar">A<span className="account-online" /></div>
          <div className="account-copy"><b>{t('account.name')}</b><small>{t('account.role')}</small></div>
          <button
            className="btn btn-ghost account-signout"
            onClick={handleSignOut}
            aria-label={t('account.signOut')}
            title={t('account.signOut')}
          >
            <LogOut size={15} />
          </button>
        </div>

        <Link
          href="/settings"
          className={`nav-item settings-link ${location === '/settings' ? 'nav-active' : ''}`}
          data-testid="link-nav-settings"
        >
          <Settings2 size={17} /><span>{t('nav.settings')}</span>
        </Link>

        <div className="sidebar-version-badge mono" data-testid="badge-sidebar-version">
          <span className="version-dot" />
          <span>{locale === 'ar' ? 'اصدار تجريبي 0.2.10' : 'Beta 0.2.10'}</span>
        </div>
      </aside>

      {mobileNav && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}

      <main className="main-area">
        <header className="topbar">
          <button className="btn btn-ghost mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open navigation" data-testid="button-open-navigation">
            <Menu size={19} />
          </button>
          <div className="crumb mono">
            <span className="crumb-signal" />
            CORTEX / {location === '/' ? 'OVERVIEW' : location.slice(1).toUpperCase()}
          </div>
          <div className="topbar-actions">
            <button className="search-trigger" onClick={() => setSearchOpen(true)} data-testid="button-command-search">
              <Search size={15} /><span>{t('app.commandSearch')}</span><kbd>Ctrl+K</kbd>
            </button>
            <div className="sync-badge">
              <span className="pulse-dot live-dot" />{t('app.syncBadge')}
            </div>
          </div>
        </header>

        <div className="page-wrap page-in" key={location}>{children}</div>
      </main>

      {/* Version badge in bottom corner */}
      <div className="bottom-corner-badge mono" data-testid="badge-corner-version">
        <span className="version-dot" />
        <span>{locale === 'ar' ? 'اصدار تجريبي 0.2.10' : 'Beta 0.2.10'}</span>
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
