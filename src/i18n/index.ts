import { I18n } from 'i18n-js';
import { getLocales } from 'expo-localization';
import fr from './fr';
import en from './en';

const i18n = new I18n({ fr, en });

// Auto-detect device language, default to French
const deviceLang = getLocales()?.[0]?.languageCode ?? 'fr';
i18n.locale = deviceLang === 'en' ? 'en' : 'fr';
i18n.enableFallback = true;
i18n.defaultLocale = 'fr';

export default i18n;
export const t = (key: string, options?: Record<string, any>) => i18n.t(key, options);
