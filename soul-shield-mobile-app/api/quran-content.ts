import { quranApiGet } from '@/api/quran-client';

export interface SurahListEntry {
  surahName: string;
  surahNameArabic: string;
  surahNameArabicLong: string;
  surahNameTranslation: string;
  revelationPlace: string;
  totalAyah: number;
}

export interface Verse {
  surahName: string;
  surahNameArabic: string;
  surahNo: number;
  ayahNo: number;
  totalAyah: number;
  english: string;
  arabic1: string;
  arabic2: string;
}

/** All 114 surahs in order (index 0 = surah 1), each with its ayah count —
 * used to map a single running index across the whole Quran onto a
 * surah/ayah pair (see lib/daily-verse.ts). Static content: fetch once,
 * cache forever. */
export function getSurahList() {
  return quranApiGet<SurahListEntry[]>('/surah.json');
}

export function getVerse(surahNo: number, ayahNo: number) {
  return quranApiGet<Verse>(`/${surahNo}/${ayahNo}.json`);
}
