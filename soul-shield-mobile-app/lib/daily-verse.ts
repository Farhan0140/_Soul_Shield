import type { SurahListEntry } from '@/api/quran-content';

/** Picks a given calendar date's verse deterministically from the full
 * Quran (not just a rotating surah's opening ayah): days-since-epoch for
 * that date, modulo the total ayah count, gives a stable running index into
 * the whole Quran, then a cumulative walk over the surah list turns that
 * index into a surah/ayah pair. Same calendar date always yields the same
 * verse for every user, no server or stored state needed, and it cycles
 * through all ~6,236 verses over time instead of only ever landing on ayah
 * 1. Takes an explicit ISO date (not just "today") so the same logic can
 * pick tomorrow's/+2's/+3's verse too, for the forward-window prefetch in
 * lib/background-sync/sync.ts. */
export function pickDailyVerseRef(
  surahs: SurahListEntry[],
  isoDate: string
): { surahNo: number; ayahNo: number } {
  const totalAyahs = surahs.reduce((sum, s) => sum + s.totalAyah, 0);
  const daysSinceEpoch = Math.floor(new Date(`${isoDate}T00:00:00Z`).getTime() / 86_400_000);
  let index = daysSinceEpoch % totalAyahs;

  for (let i = 0; i < surahs.length; i++) {
    const count = surahs[i].totalAyah;
    if (index < count) {
      return { surahNo: i + 1, ayahNo: index + 1 };
    }
    index -= count;
  }

  // Unreachable as long as totalAyahs equals the sum just reduced above.
  return { surahNo: 1, ayahNo: 1 };
}
