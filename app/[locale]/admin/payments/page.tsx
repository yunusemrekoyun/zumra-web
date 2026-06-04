import React from 'react';
import { Filter, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { KpiCard, SectionHeader, Avatar, StatusChip, SearchInput, Card, Button, IconButton, ModulePanel, PageHeader } from '@/components/ui';
import { getDashboardData } from '@/lib/domain';

const paymentTone = {
  failed: 'red',
  paid: 'emerald',
  pending: 'amber',
} as const;

export default function PaymentsPage() {
  const locale = useLocale();
  const t = useTranslations('admin.payments');
  const actions = useTranslations('common.actions');
  const status = useTranslations('common.status');
  const dashboard = getDashboardData('admin');
  const payments = dashboard.payments;
  const monthlyCollection = payments
    .filter((payment) => payment.status === 'paid')
    .reduce((total, payment) => total + payment.amount, 0);
  const pendingPayments = payments
    .filter((payment) => payment.status === 'pending')
    .reduce((total, payment) => total + payment.amount, 0);

  return (
    <div className="admin-page">
      <PageHeader title={t('title')} action={<Button>{t('manualAdd')}</Button>} />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
        <KpiCard
          label={t('monthlyCollection')}
          value={formatTry(monthlyCollection, locale)}
          trend={{ direction: 'up', label: t('trend') }}
        />
        <KpiCard
          label={t('pendingPayments')}
          value={formatTry(pendingPayments, locale)}
          trend={{
            label: t('overdue'),
            direction: 'neutral',
          }}
        />
        <Card variant="gradient" className="sm:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div>
            <h3 className="font-bold text-lg mb-1">{t('billingPeriod')}</h3>
            <p className="text-white/70 text-sm font-medium">{t('billingDescription')}</p>
          </div>
          <Button variant="secondary" className="bg-white text-[#2E286C] border-0 shadow-md">{t('bulkInvoice')}</Button>
        </Card>
      </div>

      <Card padded={false} className="overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 lg:p-6 border-b border-black/[0.03]">
          <SectionHeader title={t('recentTransactions')} className="mb-0" />
          <div className="flex items-center gap-3 w-full md:w-auto">
            <SearchInput placeholder={t('search')} containerClassName="flex-1 md:w-64" />
            <IconButton aria-label={actions('filter')} icon={<Filter className="w-4 h-4" />} size="sm" />
          </div>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden p-4 space-y-3">
          {payments.map((row) => (
            <ModulePanel key={row.id} variant="muted" className="rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={row.payerName} size="sm" />
                  <div className="min-w-0">
                    <div className="font-bold text-[#2E286C] truncate">{row.payerName}</div>
                    <div className="text-xs text-[#2E286C]/55 truncate">{t(`plans.${row.planKey}`)}</div>
                  </div>
                </div>
                <IconButton
                  aria-label={actions('openDetails')}
                  icon={<ArrowUpRight className="w-4 h-4" />}
                  size="sm"
                  variant="ghost"
                  className="text-[#533089]"
                />
              </div>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-[#2E286C]/40 font-bold">{t('amount')}</div>
                  <div className="font-bold text-[#2E286C]">{formatTry(row.amount, locale)}</div>
                  <div className="text-xs text-[#2E286C]/50">{formatPaymentDate(row.paidAt, locale)}</div>
                </div>
                <StatusChip
                  tone={paymentTone[row.status]}
                  icon={row.status === 'paid' ? <CheckCircle2 className="w-3 h-3" /> : undefined}
                >
                  {status(row.status)}
                </StatusChip>
              </div>
            </ModulePanel>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block admin-table-wrap">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F8F9FC] text-[10px] uppercase tracking-widest text-[#2E286C]/50 font-bold border-b border-black/[0.03]">
                <th className="px-6 py-4 font-bold">{t('student')}</th>
                <th className="px-6 py-4 font-bold">{t('plan')}</th>
                <th className="px-6 py-4 font-bold">{t('amount')}</th>
                <th className="px-6 py-4 font-bold">{t('date')}</th>
                <th className="px-6 py-4 font-bold">{t('status')}</th>
                <th className="px-6 py-4 font-bold text-right">{t('action')}</th>
              </tr>
            </thead>
            <tbody className="text-sm font-medium text-[#2E286C]/80 divide-y divide-black/[0.02]">
              {payments.map((row) => (
                <tr key={row.id} className="hover:bg-black/[0.01] transition-colors group cursor-pointer">
                  <td className="px-6 py-4 font-bold text-[#2E286C] flex items-center gap-3">
                    <Avatar name={row.payerName} size="sm" />
                    {row.payerName}
                  </td>
                  <td className="px-6 py-4 text-[#2E286C]/60">{t(`plans.${row.planKey}`)}</td>
                  <td className="px-6 py-4 font-bold text-[#2E286C]">{formatTry(row.amount, locale)}</td>
                  <td className="px-6 py-4 text-[#2E286C]/60">{formatPaymentDate(row.paidAt, locale)}</td>
                  <td className="px-6 py-4">
                    <StatusChip
                      tone={paymentTone[row.status]}
                      icon={row.status === 'paid' ? <CheckCircle2 className="w-3 h-3" /> : undefined}
                    >
                      {status(row.status)}
                    </StatusChip>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <IconButton
                      aria-label={actions('openDetails')}
                      icon={<ArrowUpRight className="w-4 h-4" />}
                      size="sm"
                      variant="ghost"
                      className="text-[#533089] opacity-0 group-hover:opacity-100"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function formatTry(amount: number, locale: string) {
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'tr-TR', {
    currency: 'TRY',
    currencyDisplay: 'code',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(amount);
}

function formatPaymentDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'tr-TR', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value));
}
