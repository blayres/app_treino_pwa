import { create } from 'zustand';

// App-wide informational dialog. Use `showAlert()` instead of Alert.alert /
// window.alert: Alert.alert is a no-op on react-native-web, and this keeps the
// look consistent with the project's ConfirmModal. Rendered by <AlertHost />.
type AlertState = {
  title: string;
  message: string;
};

type DialogState = {
  alert: AlertState | null;
  hideAlert: () => void;
};

export const useDialogStore = create<DialogState>((set) => ({
  alert: null,
  hideAlert: () => set({ alert: null }),
}));

export function showAlert(title: string, message = ''): void {
  useDialogStore.setState({ alert: { title, message } });
}
