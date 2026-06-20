import { TelegramThemeParams } from '@/types/telegram'

/**
 * Reads Telegram theme params and injects them as CSS custom properties.
 * Call once on app mount.
 */
export function applyTelegramTheme(themeParams: TelegramThemeParams): void {
  const root = document.documentElement
  const map: Record<keyof TelegramThemeParams, string> = {
    bg_color: '--tg-theme-bg-color',
    text_color: '--tg-theme-text-color',
    hint_color: '--tg-theme-hint-color',
    link_color: '--tg-theme-link-color',
    button_color: '--tg-theme-button-color',
    button_text_color: '--tg-theme-button-text-color',
    secondary_bg_color: '--tg-theme-secondary-bg-color',
    header_bg_color: '--tg-theme-header-bg-color',
    accent_text_color: '--tg-theme-accent-text-color',
    section_bg_color: '--tg-theme-section-bg-color',
    section_header_text_color: '--tg-theme-section-header-text-color',
    subtitle_text_color: '--tg-theme-subtitle-text-color',
    destructive_text_color: '--tg-theme-destructive-text-color',
  }

  for (const [key, cssVar] of Object.entries(map)) {
    const value = themeParams[key as keyof TelegramThemeParams]
    if (value) root.style.setProperty(cssVar, value)
  }
}

/**
 * Returns true if the Telegram WebApp is running inside Telegram.
 */
export function isTelegramWebApp(): boolean {
  return typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initData
}
