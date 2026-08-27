import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, Modal, Pressable, Text, View } from 'react-native';
import { useI18n, type Locale } from '../i18n';
import { styles } from './LanguageSwitcher.styles';

const OPTIONS: Locale[] = ['pt', 'en', 'es', 'fr'];
const MENU_WIDTH = 80;
const SCREEN_EDGE_GAP = 8;

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<any>(null);

  const updateMenuPosition = () => {
    triggerRef.current?.measureInWindow?.((x: number, y: number, width: number, height: number) => {
      const screenWidth = Dimensions.get('window').width;
      const alignedLeft = x + width - MENU_WIDTH;
      const left = Math.max(
        SCREEN_EDGE_GAP,
        Math.min(alignedLeft, screenWidth - MENU_WIDTH - SCREEN_EDGE_GAP),
      );
      setMenuPosition({ top: y + height + 4, left });
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
    setOpen(false);
  };

  return (
    <>
      <View style={styles.wrapper}>
        <Pressable
          ref={triggerRef}
          accessibilityRole="button"
          accessibilityLabel={`Language: ${t.localeLabels[locale]}`}
          accessibilityHint="Opens language options"
          onLayout={() => {
            if (open) {
              updateMenuPosition();
            }
          }}
          onPress={() => setOpen((value) => !value)}
          style={({ pressed }) => [styles.trigger, pressed && styles.triggerPressed]}
        >
          <Text style={styles.triggerText}>{t.localeLabels[locale]}</Text>
          <Text style={styles.chevron}>▾</Text>
        </Pressable>
      </View>

      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setOpen(false)}>
          <View style={[styles.menu, { top: menuPosition.top, left: menuPosition.left }]}> 
            {OPTIONS.map((opt) => (
              <Pressable
                key={opt}
                accessibilityRole="menuitem"
                onPress={() => handleSelect(opt)}
                style={[styles.option, locale === opt && styles.optionActive]}
              >
                <Text style={[styles.optionLabel, locale === opt && styles.optionLabelActive]}>
                  {t.localeLabels[opt]}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
