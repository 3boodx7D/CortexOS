import { Youtube, FileText, ExternalLink, BookOpen, Compass } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

export interface ReferenceItem {
  title: string;
  url: string;
  type?: 'youtube' | 'paper' | 'article' | string;
  publisher?: string;
  description?: string;
}

interface ReferencesViewProps {
  references: ReferenceItem[];
  notify: (msg: string) => void;
}

export function ReferencesView({ references, notify }: ReferencesViewProps) {
  const { t, locale } = useTranslation();

  if (!references || references.length === 0) {
    return (
      <div className="panel-subtle p-8 rounded-xl border border-border text-center space-y-3">
        <Compass size={32} className="mx-auto text-muted-foreground opacity-50" />
        <p className="text-xs text-muted-foreground">
          {locale === 'ar' ? 'لا توجد مراجع أو فيديوهات موصى بها بعد. قم بالتوليد عبر CORTEXAI لتنسيق مراجع مخصصة.' : 'No curated references yet. Synthesize with CORTEXAI to recommend targeted lectures and papers.'}
        </p>
      </div>
    );
  }

  const handleOpenLink = (url: string) => {
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      notify('Failed to open link');
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {references.map((item, idx) => {
        const isYoutube = item.type === 'youtube' || item.url.includes('youtube.com');
        const isPaper = item.type === 'paper' || item.url.includes('arxiv.org');

        return (
          <div
            key={idx}
            className="panel-subtle p-4 rounded-xl border border-border hover:border-cyan/40 transition-all duration-200 flex flex-col justify-between gap-3 group"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 ${
                      isYoutube
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : isPaper
                        ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                        : 'bg-cyan/10 text-cyan border border-cyan/20'
                    }`}
                  >
                    {isYoutube ? (
                      <Youtube size={15} />
                    ) : isPaper ? (
                      <BookOpen size={15} />
                    ) : (
                      <FileText size={15} />
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground truncate">
                    {item.publisher || (isYoutube ? 'YouTube' : 'Reference')}
                  </span>
                </div>

                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                  {item.type || (isYoutube ? 'video' : 'article')}
                </span>
              </div>

              <h4 className="text-xs font-semibold text-foreground group-hover:text-cyan transition leading-snug">
                {item.title}
              </h4>

              {item.description && (
                <p className="text-[11px] text-muted-foreground line-clamp-2">
                  {item.description}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleOpenLink(item.url)}
              className="btn btn-outline text-[11px] h-[32px] px-3 gap-1.5 w-full justify-center group-hover:border-cyan transition font-mono"
            >
              <span>{isYoutube ? t('study.openInYoutube') : t('study.openInBrowser')}</span>
              <ExternalLink size={12} className="text-cyan" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
