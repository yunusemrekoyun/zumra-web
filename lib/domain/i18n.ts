export type DomainLanguageKey = 'arabic' | 'english' | 'french' | 'german';
export type DomainRelativeKey = 'tenMinutes' | 'twoHours' | 'yesterday';
export type DomainSourceKey = 'instagramForm' | 'phone' | 'referral' | 'webForm';

const languageKeysByLabel: Record<string, DomainLanguageKey> = {
  Almanca: 'german',
  Arapca: 'arabic',
  'Arapça': 'arabic',
  Fransizca: 'french',
  'Fransızca': 'french',
  Ingilizce: 'english',
  'İngilizce': 'english',
};

const relativeKeysByLabel: Record<string, DomainRelativeKey> = {
  '10 dk': 'tenMinutes',
  '2 saat': 'twoHours',
  'Dün': 'yesterday',
};

const sourceKeysByLabel: Record<string, DomainSourceKey> = {
  'Instagram Form': 'instagramForm',
  Referans: 'referral',
  Telefon: 'phone',
  'Web Form': 'webForm',
};

export function getDomainLanguageKey(label: string) {
  return languageKeysByLabel[label] ?? null;
}

export function getDomainRelativeKey(label: string) {
  return relativeKeysByLabel[label] ?? null;
}

export function getDomainSourceKey(label: string) {
  return sourceKeysByLabel[label] ?? null;
}
