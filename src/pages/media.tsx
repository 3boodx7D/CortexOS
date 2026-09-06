import { useState } from 'react';
import { ChevronRight, Disc3, ListFilter, Music2, Pause, Play, Volume2 } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { useUserPersistent } from '@/lib/user-store';

type Track = { id: string; title: string; artist: string; duration: string; mood: string };

const tracks: Track[] = [
  { id: 't1', title: 'Soft Reset', artist: 'Kiasmos', duration: '04:12', mood: 'Focus' },
  { id: 't2', title: 'Night Owl', artist: 'Tycho', duration: '05:07', mood: 'Deep work' },
  { id: 't3', title: 'A Walk', artist: 'Hania Rani', duration: '03:48', mood: 'Low light' },
  { id: 't4', title: 'Open Circuit', artist: 'Rival Consoles', duration: '04:31', mood: 'Momentum' },
];

export default function Media({ notify }: { notify: (msg: string) => void }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useUserPersistent('track', tracks[0].id);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useUserPersistent('volume', 68);
  const track = tracks.find((item) => item.id === selected) || tracks[0];

  return (
    <div>
      <div className="section-title">
        <div><div className="eyebrow mono">{t('media.eyebrow')}</div><h1>{t('media.title')}</h1><p>{t('media.subtitle')}</p></div>
        <span className="context-chip"><Disc3 size={14} />{t('media.localPlayback')}</span>
      </div>

      <div className="media-layout">
        <section className="now-playing panel">
          <div className="album-visual">
            <div className="album-ring ring-one" /><div className="album-ring ring-two" />
            <div className="album-core"><Music2 size={29} /></div>
            <span className="mono">CORTEX<br />FM</span>
          </div>
          <div className="now-meta">
            <span className="eyebrow mono">{t('media.nowPlaying')}</span>
            <h2>{track.title}</h2>
            <p>{track.artist} · {track.mood}</p>
            <div className="track-progress"><span /><small className="mono">01:24 / {track.duration}</small></div>
            <div className="player-controls">
              <button className="btn btn-ghost focus-ring" onClick={() => notify(t('media.previousTrack'))} aria-label="Previous track" data-testid="button-previous-track"><ChevronRight className="flip-x" size={18} /></button>
              <button className="btn btn-accent focus-ring play-button" onClick={() => setPlaying(!playing)} aria-label={playing ? 'Pause' : 'Play'} data-testid="button-play-pause">{playing ? <Pause size={19} /> : <Play size={19} />}</button>
              <button className="btn btn-ghost focus-ring" onClick={() => { const next = tracks[(tracks.findIndex((item) => item.id === selected) + 1) % tracks.length]; setSelected(next.id); }} aria-label="Next track" data-testid="button-next-track"><ChevronRight size={18} /></button>
              <div className="volume"><Volume2 size={15} /><input type="range" min="0" max="100" value={volume} onChange={(e) => setVolume(Number(e.target.value))} aria-label="Volume" data-testid="input-volume" /></div>
            </div>
          </div>
        </section>

        <section className="panel preset-panel">
          <div className="panel-head"><span className="eyebrow mono">{t('media.presets')}</span><ListFilter size={15} /></div>
          <div className="preset-grid">
            {['Deep work', 'Night drive', 'Soft landing', 'Signal / noise'].map((preset, index) => (
              <button className={index === 0 ? 'preset preset-selected' : 'preset'} onClick={() => notify(`${preset} ${t('media.presetActive')}`)} key={preset} data-testid={`button-preset-${index}`}>
                <span className={`preset-orb orb-${index}`} /><b>{preset}</b><small>{['Binaural · 62 min', 'Ambient · 48 min', 'Piano · 56 min', 'Electronic · 71 min'][index]}</small>
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="track-list-section">
        <div className="section-mini-head"><span className="eyebrow mono">{t('media.queue')}</span><span className="mono quiet">{tracks.length.toString().padStart(2, '0')} {t('media.tracks')}</span></div>
        <div className="track-list">
          {tracks.map((item, index) => (
            <button className={`track-row ${item.id === selected ? 'track-selected' : ''}`} onClick={() => { setSelected(item.id); setPlaying(true); }} key={item.id} data-testid={`button-track-${item.id}`}>
              <span className="track-number mono">{item.id === selected && playing ? <span className="playing-bars"><i /><i /><i /></span> : `0${index + 1}`}</span>
              <span><b>{item.title}</b><small>{item.artist}</small></span>
              <span className="track-mood">{item.mood}</span>
              <span className="mono quiet">{item.duration}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
