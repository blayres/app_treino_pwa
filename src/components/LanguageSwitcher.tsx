import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, Modal, Pressable, Text, View } from 'react-native';
import { useI18n, type Locale } from '../i18n';
import { colors } from '../theme';
import { MENU_WIDTH, styles } from './LanguageSwitcher.styles';

// A menu option that is either chosen or not (ARIA menuitemradio + aria-checked).
// React Native's Role type lacks it; react-native-web passes it to the DOM as is.
const MENU_ITEM_RADIO = { role: 'menuitemradio' } as object;

const OPTIONS: Locale[] = ['pt', 'en', 'es', 'fr'];
const SCREEN_EDGE_GAP = 8;

function ChevronIcon({ open }: { open: boolean }) {
  return (
    // @ts-ignore — SVG JSX is valid in react-native-web / DOM environments
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke={colors.olive}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: 'block', transition: 'transform 150ms ease', transform: open ? 'rotate(180deg)' : 'none' }}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    // @ts-ignore — SVG JSX is valid in react-native-web / DOM environments
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke={colors.olive}
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<any>(null);

  const updateMenuPosition = () => {
    triggerRef.current?.measureInWindow?.((x: number, y: number, width: number, height: number) => {
      const screenWidth = Dimensions.get('window').width;
      const alignedLeft = x + width - MENU_WIDTH;
      const left = Math.max(
        SCREEN_EDGE_GAP,
        Math.min(alignedLeft, screenWidth - MENU_WIDTH - SCREEN_EDGE_GAP),
      );
      setMenuPosition({ top: y + height + 6, left });
    });
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    const frame = requestAnimationFrame(() => updateMenuPosition());
    return () => cancelAnimationFrame(frame);
  }, [open, locale]);

  const handleSelect = (value: Locale) => {
    setLocale(value);
    setMenuPosition(null);
    setOpen(false);
  };

  const toggleMenu = () => {
    if (!open) setMenuPosition(null);
    setOpen((value) => !value);
  };

  return (
    <>
      <View style={styles.wrapper}>
        <Pressable
          ref={triggerRef}
          accessibilityRole="button"
          accessibilityLabel={`${t.language}: ${t.localeLabels[locale]}`}
          accessibilityState={{ expanded: open }}
          aria-expanded={open}
          onLayout={() => {
            if (open) {
              updateMenuPosition();
            }
          }}
          onPress={toggleMenu}
          style={({ pressed }) => [styles.trigger, open && styles.triggerOpen, pressed && styles.triggerPressed]}
        >
          <Text style={styles.triggerText}>{t.localeLabels[locale]}</Text>
          <ChevronIcon open={open} />
        </Pressable>
      </View>

      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setOpen(false)}>
          {menuPosition && (
            <View style={[styles.menu, menuPosition]} accessibilityRole="menu">
              {OPTIONS.map((opt) => {
                const isActive = locale === opt;
                return (
                  <Pressable
                    key={opt}
                    {...MENU_ITEM_RADIO}
                    accessibilityState={{ selected: isActive }}
                    aria-checked={isActive}
                    onPress={() => handleSelect(opt)}
                    style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
                      styles.option,
                      (hovered || pressed) && styles.optionHovered,
                      isActive && styles.optionActive,
                    ]}
                  >
                    <Text style={[styles.optionLabel, isActive && styles.optionLabelActive]}>
                      {t.localeLabels[opt]}
                    </Text>
                    {isActive && <CheckIcon />}
                  </Pressable>
                );
              })}
            </View>
          )}
        </Pressable>
      </Modal>
    </>
  );
}
