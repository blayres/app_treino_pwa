import { describe, expect, it } from '@jest/globals';
import { showAlert, useDialogStore } from '../src/store/useDialogStore';

describe('useDialogStore', () => {
  it('showAlert opens the app modal and hideAlert closes it', () => {
    showAlert('Erro', 'Não foi possível salvar.');
    expect(useDialogStore.getState().alert).toEqual({ title: 'Erro', message: 'Não foi possível salvar.' });

    useDialogStore.getState().hideAlert();
    expect(useDialogStore.getState().alert).toBeNull();
  });

  it('message is optional', () => {
    showAlert('Só o título');
    expect(useDialogStore.getState().alert).toEqual({ title: 'Só o título', message: '' });
  });
});
