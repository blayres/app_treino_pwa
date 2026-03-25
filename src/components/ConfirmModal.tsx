import React from 'react';
import { Modal, View, Text, Pressable } from 'react-native';
import { styles } from './ConfirmModal.styles';
import { typography } from '../theme';

type ConfirmModalProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
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
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.buttonCancel, pressed && styles.buttonPressed]}
              onPress={onCancel}
            >
              <Text style={styles.buttonCancelLabel}>{cancelLabel}</Text>
            </Pressable>
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
