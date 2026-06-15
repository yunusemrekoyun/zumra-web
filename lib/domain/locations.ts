import countries from 'i18n-iso-countries';
import en from 'i18n-iso-countries/langs/en.json';
import tr from 'i18n-iso-countries/langs/tr.json';
import turkeyLocationData from '@kadoresmi00/turkey-cities-counties/utils/data.json';

countries.registerLocale(en);
countries.registerLocale(tr);

type TurkeyDistrict = {
  ilce_adi: string;
};

type TurkeyProvince = {
  il_adi: string;
  ilceler: TurkeyDistrict[];
};

const turkeyProvinces = (
  turkeyLocationData as { data: TurkeyProvince[] }
).data
  .map((province) => ({
    districts: province.ilceler
      .map((district) => district.ilce_adi.trim())
      .sort((left, right) => left.localeCompare(right, 'tr')),
    name: province.il_adi.trim(),
  }))
  .sort((left, right) => left.name.localeCompare(right.name, 'tr'));

export type CountryOption = {
  code: string;
  label: string;
};

export function getCountryOptions(locale: string): CountryOption[] {
  const language = locale === 'en' ? 'en' : 'tr';
  const names = countries.getNames(language, { select: 'official' });

  return Object.entries(names)
    .map(([code, label]) => ({ code, label }))
    .sort((left, right) => left.label.localeCompare(right.label, language));
}

export function getTurkeyProvinceOptions() {
  return turkeyProvinces.map((province) => province.name);
}

export function getTurkeyDistrictOptions(provinceName: string) {
  return (
    turkeyProvinces.find((province) => province.name === provinceName)
      ?.districts ?? []
  );
}

