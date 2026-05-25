import { translate, type MessageKey } from "@/i18n/messages";
import { useUiStore } from "@/stores/uiStore";

export function useI18n() {
  const locale = useUiStore((state) => state.locale);

  return {
    locale,
    t: (key: MessageKey, values?: Record<string, string | number>) => translate(locale, key, values),
  };
}
