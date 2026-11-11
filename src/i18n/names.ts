import type { Lang } from '../domain/types';

/** Each UI language written in itself, so a user can find theirs whatever the current language is. */
export const NATIVE_NAMES: Record<Lang, string> = {
  pt: 'Português', en: 'English', es: 'Español', zh: '中文', hi: 'हिन्दी', fr: 'Français', ar: 'العربية', bn: 'বাংলা',
  ru: 'Русский', ur: 'اردو', id: 'Bahasa Indonesia', de: 'Deutsch', ja: '日本語', tr: 'Türkçe', mr: 'मराठी',
};
