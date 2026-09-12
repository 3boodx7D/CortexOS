import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { UploadCloud, FileText, Loader2, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

interface DocumentDropzoneProps {
  onParsed: (data: {
    text: string;
    filename: string;
    word_count: number;
    reading_time_minutes: number;
    title_hint: string;
    pages?: number;
  }) => void;
  notify: (msg: string) => void;
}

export function DocumentDropzone({ onParsed, notify }: DocumentDropzoneProps) {
  const { t, locale } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [lastUploaded, setLastUploaded] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['pdf', 'docx', 'doc', 'txt', 'md', 'markdown'].includes(ext)) {
      notify(locale === 'ar' ? 'نوع الملف غير مدعوم. يرجى اختيار PDF أو DOCX أو TXT' : 'Unsupported format. Please select PDF, DOCX, or TXT');
      return;
    }

    setIsParsing(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('http://127.0.0.1:8000/api/study/parse-file', {
        method: 'POST',
        headers: {
          'X-Cortex-Daemon-Token': 'cortex-local-daemon-token-9a7f3e'
        },
        body: formData
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error || 'Failed to parse file');
      }

      setLastUploaded(file.name);
      onParsed({
        text: data.text,
        filename: data.filename,
        word_count: data.word_count,
        reading_time_minutes: data.reading_time_minutes,
        title_hint: data.title_hint,
        pages: data.pages
      });
      notify(locale === 'ar' ? `تم استخراج محتوى: ${file.name}` : `Extracted content from: ${file.name}`);
    } catch (err: any) {
      notify(locale === 'ar' ? `فشل استخراج الملف: ${err.message}` : `Failed to parse document: ${err.message}`);
    } finally {
      setIsParsing(false);
    }
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files[0]);
    }
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleUpload(e.target.files[0]);
    }
  };

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`relative group rounded-xl p-6 border transition-all duration-200 text-center ${
        isDragging
          ? 'border-cyan bg-cyan/5 ring-1 ring-cyan/30'
          : 'border-border/80 hover:border-cyan/40 bg-card hover:bg-muted/30'
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.doc,.txt,.md"
        onChange={onFileChange}
        className="hidden"
      />

      <div className="flex flex-col items-center justify-center gap-3">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-105 ${
            isParsing
              ? 'bg-cyan/10 text-cyan animate-pulse'
              : lastUploaded
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-muted border border-border text-cyan'
          }`}
        >
          {isParsing ? (
            <Loader2 size={24} className="animate-spin" />
          ) : lastUploaded ? (
            <CheckCircle2 size={24} />
          ) : (
            <UploadCloud size={24} />
          )}
        </div>

        <div className="space-y-1">
          <h4 className="text-xs font-semibold text-foreground tracking-wide flex items-center justify-center gap-1.5">
            {isParsing ? (
              <span>{t('study.parsingDoc')}</span>
            ) : lastUploaded ? (
              <span>
                {locale === 'ar' ? 'تم تحميل: ' : 'Loaded: '}
                <strong className="text-cyan">{lastUploaded}</strong>
              </span>
            ) : (
              <span>{t('study.dropzoneTitle')}</span>
            )}
          </h4>
          <p className="text-[11px] text-muted-foreground max-w-md mx-auto">
            {t('study.dropzoneDesc')}
          </p>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isParsing}
            className="btn btn-outline text-xs h-[34px] px-3 gap-1.5 font-mono cursor-pointer hover:border-cyan transition"
          >
            <FileText size={14} className="text-cyan" />
            <span>{t('study.dropzoneBrowse')}</span>
          </button>
          <span className="text-[10px] text-zinc-500 font-mono tracking-wider uppercase border border-zinc-800/80 px-2 py-1 rounded bg-zinc-900/50">
            PDF • DOCX • TXT • MD
          </span>
        </div>
      </div>
    </div>
  );
}
