import React from 'react';
import { useI18n } from '../i18n';
import { colors } from '../theme';
import { DumbbellIcon } from './DumbbellIcon';
import { SwitchViewButton } from './SwitchViewButton';

/** Trainer area → the trainer's own training (Home, same account). */
export function MyTrainingButton({ onPress }: { onPress: () => void }) {
  const { t } = useI18n();
  return (
    <SwitchViewButton
      label={t.myTrainingShortcut}
      icon={<DumbbellIcon size={16} color={colors.olive} />}
      onPress={onPress}
    />
  );
}
