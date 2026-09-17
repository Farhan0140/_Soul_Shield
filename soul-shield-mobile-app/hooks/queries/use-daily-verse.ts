import { useQuery } from '@tanstack/react-query';

import { getSurahList, getVerse } from '@/api/quran-content';
import { pickDailyVerseRef } from '@/lib/daily-verse';
import { todayISODate } from '@/lib/date';
import { queryKeys } from '@/lib/query-keys';

/** Today's verse from quranapi.pages.dev (Arabic + English), same for every
 * user on a given calendar day — see lib/daily-verse.ts for how the day maps
 * to a specific surah/ayah. Keyed by date, so it's a fresh fetch once a day
 * and otherwise served straight from cache; content is immutable once
 * fetched, hence staleTime: Infinity. */
export function useDailyVerseQuery() {
  const date = todayISODate();
  return useQuery({
    queryKey: queryKeys.dailyVerse(date),
    queryFn: async () => {
      const surahs = await getSurahList();
      const { surahNo, ayahNo } = pickDailyVerseRef(surahs, date);
      return getVerse(surahNo, ayahNo);
    },
    staleTime: Infinity,
  });
}
