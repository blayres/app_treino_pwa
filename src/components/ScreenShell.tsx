import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogoBar } from './LogoBar';
import { ScreenHeader } from './ScreenHeader';
import { Skeleton } from './Skeleton';
import { layout, spacing } from '../theme';

type Props = {
  onBack?: () => void;
  title?: string;
  subtitle?: string;
  /** Same as ScreenHeader's action (e.g. the "Meu treino" switch). */
  action?: React.ReactNode;
  /** Skeleton cards standing in for the screen's data (default: 2). */
  cards?: number[];
  children?: React.ReactNode;
};

/**
 * Static frame of a screen (banner, "Voltar", title, subtitle) with skeleton
 * cards where its data goes. Shown while a code-split screen is still
 * downloading, so navigation never shows an empty page.
 */
export function ScreenShell({ onBack, title, subtitle, action, cards = [160, 220], children }: Props) {
  return (
    <SafeAreaView style={layout.screen} edges={['left', 'right']}>
      <LogoBar />
      <ScrollView contentContainerStyle={layout.content} scrollEnabled={false}>
        <ScreenHeader onBack={onBack} title={title} subtitle={subtitle} action={action} />
        {/* Unknown title: placeholder — unless custom content draws its own header. */}
        {!title && !children && <Skeleton width="60%" height={28} style={{ marginBottom: spacing.xl }} />}
        {children ?? (
          <View style={{ gap: spacing.md }}>
            {cards.map((height, i) => (
              <Skeleton key={i} width="100%" height={height} style={{ borderRadius: 16 }} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
