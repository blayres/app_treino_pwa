import React from 'react';
import { Modal, View, Text, Pressable } from 'react-native';
import { styles } from './ConfirmModal.styles';

type ConfirmModalProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  /** Omit for a single-button (informational) dialog. */
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmDanger?: boolean;
};

export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  confirmDanger = false,
}: ConfirmModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={styles.actions}>
            {cancelLabel ? (
              <Pressable
                style={({ pressed }) => [styles.buttonCancel, pressed && styles.buttonPressed]}
                onPress={onCancel}
              >
                <Text style={styles.buttonCancelLabel}>{cancelLabel}</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={({ pressed }) => [
                confirmDanger ? styles.buttonConfirmDanger : styles.buttonConfirm,
                pressed && styles.buttonPressed,
              ]}
              onPress={onConfirm}
            >
              <Text style={styles.buttonConfirmLabel}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
