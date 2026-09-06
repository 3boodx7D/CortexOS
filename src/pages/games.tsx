import { Gamepad2, Gauge, Play, Power } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { usePersistent } from '@/hooks/use-persistent';

export default function Games({ notify }: { notify: (msg: string) => void }) {
  const { t } = useTranslation();
  const [turbo, setTurbo] = usePersistent('cortex-turbo', false);
  const games = [
    { title: 'Hades II', meta: 'Last played 2d ago', color: 'coral', icon: 'H2' },
    { title: 'The Finals', meta: 'Last played 5d ago', color: 'blue', icon: 'TF' },
    { title: 'Factorio', meta: 'Last played 8d ago', color: 'amber', icon: 'FC' },
  ];

  return (
    <div>
      <div className="section-title">
        <div><div className="eyebrow mono">{t('games.eyebrow')}</div><h1>{t('games.title')}</h1><p>{t('games.subtitle')}</p></div>
        <div className="turbo-control">
          <Power size={14} /><span>{t('overview.turboMode')}</span>
          <button type="button" role="switch" aria-checked={turbo} className={`toggle ${turbo ? 'toggle-on' : ''}`}
            onClick={() => { const next = !turbo; setTurbo(next); notify(next ? t('overview.turboEnabled') : t('overview.turboDisabled')); }}
            data-testid="button-games-turbo" aria-label="Toggle Turbo Mode"><span /></button>
        </div>
      </div>

      <div className="game-feature panel shell-grid">
        <div>
          <span className="eyebrow mono">{t('games.readyToPlay')}</span>
          <h2>{t('games.heroTitle1')}<br /><em>{t('games.heroTitle2')}</em></h2>
          <p>{t('games.heroDesc')}</p>
        </div>
        <div className="game-feature-mark"><Gamepad2 size={48} strokeWidth={1} /><span className="mono">LOCAL<br />QUEUE</span></div>
      </div>

      <div className="game-grid">
        {games.map((game, index) => (
          <article className={`game-card panel game-${game.color}`} key={game.title}>
            <div className="game-art"><span>{game.icon}</span><small className="mono">0{index + 1}</small></div>
            <div className="game-info">
              <h3>{game.title}</h3>
              <p>{game.meta}</p>
              <button className="btn btn-outline focus-ring" onClick={() => notify(`${game.title} ${t('games.launchQueued')}`)} data-testid={`button-launch-game-${index}`}>
                <Play size={13} />{t('games.launch')}
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="game-status panel-subtle">
        <Gauge size={16} />
        <span>
          <b>{turbo ? t('games.turboEngaged') : t('games.turboBalanced')}</b>
          <small>{turbo ? t('games.turboEngagedDesc') : t('games.turboBalancedDesc')}</small>
        </span>
        <span className="mono quiet">{t('games.mockReady')}</span>
      </div>
    </div>
  );
}
