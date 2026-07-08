import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { LanguageSwitcher } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import type {
  FooterLegalLink,
  PublicLegalPage,
} from '@/lib/server/services/legal-pages';

const CONTENT_CLASSES =
  'font-neubau text-[15px] leading-[1.8] text-brand-dark/80 ' +
  '[&_h2]:font-rosmatika [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-[22px] [&_h2]:font-bold [&_h2]:text-brand-dark [&_h2]:tracking-tight ' +
  '[&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:text-[18px] [&_h3]:font-bold [&_h3]:text-brand-dark ' +
  '[&_h4]:mt-6 [&_h4]:mb-2 [&_h4]:text-[16px] [&_h4]:font-semibold [&_h4]:text-brand-dark ' +
  '[&_p]:my-4 ' +
  '[&_a]:text-brand-primary [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:opacity-80 ' +
  '[&_ul]:my-4 [&_ul]:pl-6 [&_ul]:list-disc [&_ol]:my-4 [&_ol]:pl-6 [&_ol]:list-decimal [&_li]:my-1.5 [&_li]:pl-1 ' +
  '[&_img]:my-6 [&_img]:rounded-2xl [&_img]:max-w-full [&_img]:h-auto [&_img]:border [&_img]:border-black/5 ' +
  '[&_blockquote]:my-6 [&_blockquote]:border-l-4 [&_blockquote]:border-brand-primary/30 [&_blockquote]:pl-5 [&_blockquote]:italic [&_blockquote]:text-brand-dark/60 ' +
  '[&_strong]:font-bold [&_strong]:text-brand-dark [&_hr]:my-8 [&_hr]:border-black/10 ' +
  '[&_table]:my-6 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-black/10 [&_td]:p-2 [&_th]:border [&_th]:border-black/10 [&_th]:p-2 [&_th]:bg-brand-muted/5 [&_th]:text-left';

function BrandMark({ small }: { small?: boolean }) {
  return (
    <div
      className={`${small ? 'w-9 h-9 text-base rounded-[10px]' : 'w-10 h-10 rounded-[10px]'} bg-brand-primary flex items-center justify-center text-white font-bold`}
    >
      Z
    </div>
  );
}

export async function LegalPageView({
  page,
  links,
}: {
  page: PublicLegalPage;
  links: FooterLegalLink[];
}) {
  const t = await getTranslations('public.legal');
  const brand = await getTranslations('common.brand');
  const footer = await getTranslations('public.footer');
  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-[#FCFCFD] flex flex-col">
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-black/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <BrandMark small />
            <span className="font-rosmatika font-bold tracking-tight text-xl text-brand-dark">
              {brand('name').toUpperCase()}
              <span className="font-neubau text-[9px] uppercase font-bold tracking-widest text-brand-muted ml-1">
                {brand('suffix')}
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <Link
              href="/"
              className="hidden sm:inline-flex items-center gap-1.5 text-sm font-neubau text-brand-dark/70 hover:text-brand-primary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('backHome')}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-14 lg:py-20">
        <p className="font-neubau text-[11px] uppercase tracking-widest text-brand-primary font-bold mb-4">
          {t('eyebrow')}
        </p>
        <h1 className="font-rosmatika text-3xl lg:text-[40px] leading-[1.1] font-bold text-brand-dark tracking-tight mb-10 text-balance">
          {page.title}
        </h1>
        <article
          className={CONTENT_CLASSES}
          dangerouslySetInnerHTML={{ __html: page.bodyHtml }}
        />
      </main>

      <footer className="bg-white border-t border-black/5 mt-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <BrandMark />
            <span className="font-rosmatika font-bold tracking-tight text-lg text-brand-dark">
              {brand('name').toUpperCase()}
            </span>
          </div>
          {links.length > 0 && (
            <nav className="flex flex-wrap gap-x-5 gap-y-2 justify-center">
              {links.map((link) => (
                <Link
                  key={link.slug}
                  href={`/${link.slug}`}
                  className="text-[13px] font-neubau text-brand-dark/60 hover:text-brand-primary transition-colors"
                >
                  {link.title}
                </Link>
              ))}
            </nav>
          )}
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-8">
          <p className="text-[12px] font-neubau text-brand-dark/40 text-center sm:text-left">
            {footer('copyright', { year })}
          </p>
        </div>
      </footer>
    </div>
  );
}
