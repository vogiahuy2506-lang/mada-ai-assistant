import madaLogo from '../assets/mada-logo.png';
import { t } from '@/lib/translations';
import { useLanguageStore } from '@/stores';

export function Footer() {
  const language = useLanguageStore((s) => s.language);

  return (
    <footer className="w-full flex flex-col md:flex-row justify-between items-start md:items-end p-6 md:p-8 gap-6 bg-zinc-900 text-zinc-100">
      <div className="flex flex-col gap-3 max-w-md">
        <div className="flex items-center gap-3">
          <img src={madaLogo} alt="MADA" className="h-10" />
          <div className="font-black text-2xl tracking-tight">MADA AI</div>
        </div>
        <p className="text-sm text-zinc-400">
          {t('footer.tagline', language)}
        </p>
        <p className="text-xs text-zinc-500 uppercase tracking-wider">
          {t('footer.copyright', language)}
        </p>
      </div>

      <div className="flex gap-12">
        <div className="flex flex-col gap-3">
          <span className="text-xs font-semibold uppercase text-violet-400 tracking-wider">{t('footer.resources', language)}</span>
          <a className="text-sm text-zinc-400 hover:text-white transition-colors" href="#">{t('footer.aiEthics', language)}</a>
          <a className="text-sm text-zinc-400 hover:text-white transition-colors" href="#">{t('footer.security', language)}</a>
          <a className="text-sm text-zinc-400 hover:text-white transition-colors" href="#">{t('footer.github', language)}</a>
        </div>
        <div className="flex flex-col gap-3">
          <span className="text-xs font-semibold uppercase text-violet-400 tracking-wider">{t('footer.links', language)}</span>
          <a className="text-sm text-zinc-400 hover:text-white transition-colors" href="#">{t('footer.support', language)}</a>
          <a className="text-sm text-zinc-400 hover:text-white transition-colors" href="#">{t('footer.updates', language)}</a>
          <a className="text-sm text-zinc-400 hover:text-white transition-colors" href="#">{t('footer.iso9999', language)}</a>
        </div>
      </div>
    </footer>
  );
}
