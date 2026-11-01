import React from 'react';
import { ConfirmModal } from './ConfirmModal';
import { useDialogStore } from '../store/useDialogStore';
import { useI18n } from '../i18n';

// Mounted once in App.tsx; displays whatever `showAlert()` requested.
export function AlertHost() {
  const alert = useDialogStore((state) => state.alert);
  const hideAlert = useDialogStore((state) => state.hideAlert);
  const { t } = useI18n();

  return (
    <ConfirmModal
      visible={alert !== null}
      title={alert?.title ?? ''}
      message={alert?.message ?? ''}
      confirmLabel={t.ok}
      onConfirm={hideAlert}
      onCancel={hideAlert}
    />
  );
}
