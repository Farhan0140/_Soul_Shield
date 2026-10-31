/** Tiny i18n scaffold (English + Bengali). Translations cover the highest-
 * visibility chrome today (tab bar, home/dashboard header + statuses, chart,
 * profile tools, sync status, and the newer screens); deeper surfaces (forms,
 * edit screens) still fall back to English via the `en` dictionary — add keys
 * there as surfaces get translated. Missing keys ALWAYS fall back to English,
 * then to the key itself, so a forgotten key can never render blank text. */

export type Locale = 'en' | 'bn';

const en = {
  // Tabs
  'tab.home': 'Home',
  'tab.history': 'History',
  'tab.categories': 'Categories',
  'tab.profile': 'Profile',
  'tab.admin': 'Admin',

  // Home / date navigation
  'home.title': "Today's Tasks",
  'home.today': 'Today',
  'home.syncing': 'Syncing…',
  'home.synced': 'Synced',
  'home.syncFailed': 'Sync failed',
  'home.offlineBanner': "You're offline — changes will sync automatically.",
  'home.streakDays': 'day streak',
  'home.chart.title': '7-Day Progress',
  'home.chart.completed': 'Completed',
  'home.chart.partial': 'Partial',
  'home.section.fixed': 'Fixed Tasks',
  'home.section.uncategorized': 'Uncategorized',
  'home.section.completed': 'Completed Tasks',

  // Sub-tasks
  'subtasks.completedSection': 'Completed Sub-Tasks',

  // Profile / tools
  'profile.appearance': 'Appearance',
  'profile.counterVibration': 'Counter vibration',
  'profile.counterVibrationHint': 'Short vibration on counter taps and check-offs.',
  'profile.language': 'Language',
  'profile.arabicFont': 'Arabic Font',
  'profile.notifications': 'Notifications',
  'profile.tools': 'Tools',
  'profile.data': 'Data',
  'profile.tools.timer': 'Timer',
  'profile.tools.reorder': 'Reorder',
  'profile.tools.insights': 'Insights',
  'profile.tools.search': 'Search Tasks',
  'profile.tools.archived': 'Archived Tasks',
  'profile.data.syncAlerts': 'Cross-device sync alerts',
  'profile.data.syncAlertsHint': 'Get a push notification when tasks change on another device.',
  'profile.testNotification': 'Send test notification',
  'profile.testNotificationSent': 'Test scheduled — check notifications in a few seconds.',
  'profile.testNotificationDenied': 'Notifications are disabled. Enable them in system settings.',
  'profile.data.dailyDigest': 'Daily task reminder',
  'profile.data.export': 'Export My Data (JSON)',
  'profile.logout': 'Log Out',
  'profile.logoutTitle': 'Log Out',
  'profile.syncStatus.never': 'Not synced yet on this device',
  'profile.language.en': 'English',
  'profile.language.bn': 'বাংলা',

  // Insights
  'insights.title': 'Insights',
  'insights.share': 'Share Progress',
  'insights.completionRate': 'Completion rate',
  'insights.currentStreak': 'Current streak',
  'insights.bestStreak': 'Best streak',
  'insights.favoriteCategory': 'Favorite category',
  'insights.bestWeekday': 'Most productive day',
  'insights.totalCompleted': 'Tasks completed',
  'insights.days': 'Last 30 days',
  'insights.days90': 'Last 90 days',

  // Search
  'search.title': 'Search Tasks',
  'search.placeholder': 'Search title or description…',
  'search.empty': 'No tasks match your search.',
  'search.hint': 'Searches this device — works offline.',

  // Archived
  'archived.title': 'Archived Tasks',
  'archived.empty': 'No archived tasks.',
  'archived.hint': 'Archived tasks are hidden from your lists but their history is kept. Restore one to bring it back.',
  'archived.restore': 'Restore',

  // Sync issues
  'sync.title': 'Sync Issues',
  'sync.failedRequests': 'Failed requests',
  'sync.rejectedChanges': 'Rejected changes',
  'sync.rejectedHint': 'The server refused these local edits (e.g. a validation rule). They are kept on this device and retried on every sync.',
  'sync.conflicts': 'Conflicts detected',
  'sync.conflictsHint': "These rows were edited here and on another device at the same time. The server's version won; the discarded local version is listed for reference.",
  'sync.noIssues': 'No sync issues',
  'sync.noIssuesMessage': 'Everything is up to date.',

  // Common
  'common.retry': 'Retry',
  'common.dismiss': 'Dismiss',
  'common.clearAll': 'Clear all',
  'common.save': 'Save Changes',
  'common.archive': 'Archive Task',
  'common.duplicate': 'Duplicate Task',
  'edit.title': 'Edit Task',
  'common.getStarted': 'Get Started',
  'common.next': 'Next',
  'common.skip': 'Skip',

  'profile.logoutConfirm': 'Log out of Soul Shield?',
  'profile.logoutWithPending':
    "You have unsynced offline changes on this device. Logging out clears local data and they will NOT sync.\n\nLog out anyway?",
  'profile.logoutHint': 'Tip: Export My Data first if you want a copy.',
  'profile.digestTimeLabel': 'Reminder time',

  'onb.title': 'Welcome to Soul Shield',
  'onb.s1.title': 'Your habits, your device',
  'onb.s1.body':
    "Everything is saved on this phone — browse, edit, and complete tasks even offline. Changes sync automatically when you're online.",
  'onb.s2.title': 'Stay on track',
  'onb.s2.body': "Set reminders, watch your streak grow, and check Insights to see how far you've come.",
  'onb.s3.title': "You're ready ✨",
  'onb.s3.body': "Pull down anytime to force a sync. If something looks off, check Profile → Sync Issues.",
  'ble.title': 'Bluetooth Counter',
  'ble.connect.hint': 'Power your ESP32 near this phone, then tap it below to connect.',
  'ble.expoGo': "Bluetooth scanning isn't available in Expo Go — run a development build of the app (npx expo run:android) to use the ESP32 button.",
  'ble.scan': 'Search for ESP32',
  'ble.scanning': 'Searching for your ESP32…',
  'ble.noneFound': 'No devices found yet.',
  'ble.connected': 'Connected',
  'ble.controllingThis': 'Button presses add +1 to this task — even with the app in the background.',
  'ble.switchToThis': 'Control this task',
  'ble.currentlyOther': 'Bluetooth is currently controlling another task.',
  'ble.disconnect': 'Disconnect',
  'ble.denied': 'Bluetooth permission is denied. Enable it in system settings.',
  'ble.turnOn': 'Bluetooth is turned off. Enable it in system settings.',
} as const;

export type I18nKey = keyof typeof en;

const bn: Partial<Record<I18nKey, string>> = {
  'tab.home': 'হোম',
  'tab.history': 'ইতিহাস',
  'tab.categories': 'ক্যাটাগরি',
  'tab.profile': 'প্রোফাইল',
  'tab.admin': 'অ্যাডমিন',

  'home.title': 'আজকের কাজ',
  'home.today': 'আজ',
  'home.syncing': 'সিঙ্ক হচ্ছে…',
  'home.synced': 'সিঙ্ক হয়েছে',
  'home.syncFailed': 'সিঙ্ক ব্যর্থ',
  'home.offlineBanner': 'আপনি অফলাইনে আছেন — পরিবর্তনগুলো স্বয়ংক্রিয়ভাবে সিঙ্ক হবে।',
  'home.streakDays': 'দিনের ধারাবাহিকতা',
  'home.chart.title': '৭ দিনের অগ্রগতি',
  'home.chart.completed': 'সম্পন্ন',
  'home.chart.partial': 'আংশিক',
  'home.section.fixed': 'নির্দিষ্ট কাজ',
  'home.section.uncategorized': 'অবাছাইকৃত',
  'home.section.completed': 'সম্পন্ন কাজ',

  'subtasks.completedSection': 'সম্পন্ন সাব-টাস্ক',

  'profile.appearance': 'সাজসজ্জা',
  'profile.counterVibration': 'কাউন্টার ভাইব্রেশন',
  'profile.counterVibrationHint': 'কাউন্টার ট্যাপ ও চেক-অফে ছোট ভাইব্রেশন।',
  'profile.language': 'ভাষা',
  'profile.arabicFont': 'আরবি ফন্ট',
  'profile.notifications': 'নোটিফিকেশন',
  'profile.tools': 'টুলস',
  'profile.data': 'ডেটা',
  'profile.tools.timer': 'টাইমার',
  'profile.tools.reorder': 'ক্রম সাজান',
  'profile.tools.insights': 'অন্তর্দৃষ্টি',
  'profile.tools.search': 'কাজ খুঁজুন',
  'profile.tools.archived': 'আর্কাইভকৃত কাজ',
  'profile.data.syncAlerts': 'ক্রস-ডিভাইস সিঙ্ক সতর্কতা',
  'profile.data.syncAlertsHint': 'অন্য ডিভাইসে কোনো কাজ পরিবর্তন হলে পুশ নোটিফিকেশন পান।',
  'profile.testNotification': 'টেস্ট নোটিফিকেশন পাঠান',
  'profile.testNotificationSent': 'টেস্ট নির্ধারিত — কয়েক সেকেন্ডে নোটিফিকেশন দেখুন।',
  'profile.testNotificationDenied': 'নোটিফিকেশন বন্ধ আছে। সিস্টেম সেটিংস থেকে চালু করুন।',
  'profile.data.dailyDigest': 'দৈনিক কাজ রিমাইন্ডার',
  'profile.data.export': 'আমার ডেটা এক্সপোর্ট (JSON)',
  'profile.logout': 'লগ আউট',
  'profile.logoutTitle': 'লগ আউট',
  'profile.syncStatus.never': 'এই ডিভাইসে এখনো সিঙ্ক হয়নি',
  'profile.language.en': 'English',
  'profile.language.bn': 'বাংলা',

  'insights.title': 'অন্তর্দৃষ্টি',
  'insights.share': 'অগ্রগতি শেয়ার করুন',
  'insights.completionRate': 'সম্পন্নের হার',
  'insights.currentStreak': 'বর্তমান ধারাবাহিকতা',
  'insights.bestStreak': 'সর্বোচ্চ ধারাবাহিকতা',
  'insights.favoriteCategory': 'প্রিয় ক্যাটাগরি',
  'insights.bestWeekday': 'সবচেয়ে উৎপাদনশীল দিন',
  'insights.totalCompleted': 'সম্পন্ন কাজ',
  'insights.days': 'শেষ ৩০ দিন',
  'insights.days90': 'শেষ ৯০ দিন',

  'search.title': 'কাজ খুঁজুন',
  'search.placeholder': 'শিরোনাম বা বিবরণ খুঁজুন…',
  'search.empty': 'আপনার খোঁজার সাথে কোনো কাজ মেলেনি।',
  'search.hint': 'এই ডিভাইসে খোঁজা হয় — অফলাইনেও কাজ করে।',

  'archived.title': 'আর্কাইভকৃত কাজ',
  'archived.empty': 'কোনো আর্কাইভকৃত কাজ নেই।',
  'archived.hint': 'আর্কাইভকৃত কাজ তালিকায় দেখা যায় না, কিন্তু তাদের ইতিহাস সংরক্ষিত থাকে। ফিরিয়ে আনতে Restore চাপুন।',
  'archived.restore': 'ফিরিয়ে আনুন',

  'sync.title': 'সিঙ্ক সমস্যা',
  'sync.failedRequests': 'ব্যর্থ অনুরোধ',
  'sync.rejectedChanges': 'প্রত্যাখ্যাত পরিবর্তন',
  'sync.rejectedHint': 'সার্ভার এই লোকাল পরিবর্তনগুলো গ্রহণ করেনি (যেমন ভ্যালিডেশন নিয়ম)। সেগুলো এই ডিভাইসে থেকে যায় এবং প্রতি সিঙ্কে আবার চেষ্টা হয়।',
  'sync.conflicts': 'গোলমাল চিহ্নিত হয়েছে',
  'sync.conflictsHint': 'একই সময়ে এখানে ও অন্য ডিভাইসে এই ডেটা পরিবর্তন হয়েছিল। সার্ভারের সংস্করণ রাখা হয়েছে; বাদ পড়া লোকাল সংস্করণ রেফারেন্সের জন্য দেখানো হচ্ছে।',
  'sync.noIssues': 'কোনো সিঙ্ক সমস্যা নেই',
  'sync.noIssuesMessage': 'সব আপ-টু-ডেট আছে।',

  'common.retry': 'আবার চেষ্টা',
  'common.dismiss': 'বন্ধ করুন',
  'common.clearAll': 'সব মুছুন',
  'common.save': 'সংরক্ষণ করুন',
  'common.archive': 'কাজ আর্কাইভ করুন',
  'common.duplicate': 'কাজের কপি বানান',
  'edit.title': 'টাস্ক সম্পাদনা',
  'common.getStarted': 'শুরু করুন',
  'common.next': 'পরবর্তী',
  'common.skip': 'বাদ দিন',

  'profile.logoutConfirm': 'সোল শিল্ড থেকে লগ আউট করবেন?',
  'profile.logoutWithPending':
    'এই ডিভাইসে এখনো সিঙ্ক হয়নি এমন পরিবর্তন আছে। লগ আউট করলে লোকাল ডেটা মুছে যাবে এবং সেগুলো সিঙ্ক হবে না।\n\nতবুও লগ আউট করবেন?',
  'profile.logoutHint': 'টিপ: কপি রাখতে চাইলে আগে Export My Data চালান।',
  'profile.digestTimeLabel': 'রিমাইন্ডারের সময়',

  'onb.title': 'সোল শিল্ডে স্বাগতম',
  'onb.s1.title': 'আপনার অভ্যাস, আপনার ডিভাইস',
  'onb.s1.body':
    'সবকিছু এই ফোনে সংরক্ষিত হয় — অফলাইনেও কাজ দেখা, সম্পাদনা ও সম্পন্ন করা যায়। অনলাইনে এলে স্বয়ংক্রিয়ভাবে সিঙ্ক হয়।',
  'onb.s2.title': 'ট্র্যাকে থাকুন',
  'onb.s2.body': 'রিমাইন্ডার সেট করুন, ধারাবাহিকতা বাড়ান, আর Insights-এ অগ্রগতি দেখুন।',
  'onb.s3.title': 'প্রস্তুত ✨',
  'onb.s3.body': 'যেকোনো সময় নিচে টেনে সিঙ্ক করুন। সমস্যা হলে Profile → Sync Issues দেখুন।',
  'ble.title': 'ব্লুটুথ কাউন্টার',
  'ble.connect.hint': 'আপনার ESP32 ফোনের কাছে চালু করুন, তারপর সংযোগ করতে নিচে ট্যাপ করুন।',
  'ble.expoGo': 'Expo Go-তে ব্লুটুথ স্ক্যান করা যায় না — ESP32 বাটন ব্যবহার করতে অ্যাপের ডেভেলপমেন্ট বিল্ড চালান (npx expo run:android)।',
  'ble.scan': 'ESP32 খুঁজুন',
  'ble.scanning': 'আপনার ESP32 খোঁজা হচ্ছে…',
  'ble.noneFound': 'এখনো কোনো ডিভাইস পাওয়া যায়নি।',
  'ble.connected': 'সংযুক্ত',
  'ble.controllingThis': 'বাটন চাপলে এই কাজে +১ যোগ হবে — অ্যাপ ব্যাকগ্রাউন্ডে থাকলেও।',
  'ble.switchToThis': 'এই কাজ নিয়ন্ত্রণ করুন',
  'ble.currentlyOther': 'বর্তমানে অন্য একটি কাজ নিয়ন্ত্রিত হচ্ছে।',
  'ble.disconnect': 'সংযোগ বিচ্ছিন্ন করুন',
  'ble.denied': 'ব্লুটুথ অনুমতি নেই। সিস্টেম সেটিংস থেকে চালু করুন।',
  'ble.turnOn': 'ব্লুটুথ বন্ধ আছে। সিস্টেম সেটিংস থেকে চালু করুন।',
};

const dictionaries: Record<Locale, Partial<Record<I18nKey, string>>> = {
  en: en as unknown as Partial<Record<I18nKey, string>>,
  bn,
};

export function translate(locale: Locale, key: I18nKey): string {
  return dictionaries[locale][key] ?? en[key] ?? String(key);
}
