import React, { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { showAlert } from '../store/useDialogStore';
import { clearPendingInvite, peekPendingInvite } from '../services/coachInvite';
import { getInviteCoachName, joinCoach, joinErrorKey } from '../services/coachService';
import { ConfirmModal } from './ConfirmModal';

type Props = {
  /** Mount only when signed in (the invite waits through login/sign-up). */
  enabled: boolean;
  /** After joining (e.g. skip onboarding: the coach builds the program). */
  onJoined: () => void;
};

/**
 * Invite link opened (/convite/CODE, see coachInvite.ts): once the user is
 * signed in, ask whether to train with that coach.
 */
export function PendingInviteHost({ enabled, onJoined }: Props) {
  const { t } = useI18n();
  const [invite, setInvite] = useState<{ code: string; coachName: string } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const code = peekPendingInvite();
    if (!code) return;
    let cancelled = false;
    getInviteCoachName(code)
      .then((coachName) => {
        if (cancelled) return;
        if (coachName) setInvite({ code, coachName });
        else {
          clearPendingInvite();
          showAlert('', t.invalidCoachCode);
        }
      })
      .catch(() => {
        // Offline / migration missing: keep the code and try on the next start.
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, t]);

  if (!invite) return null;

  const close = () => {
    clearPendingInvite();
    setInvite(null);
  };

  const accept = async () => {
    const { code } = invite;
    close();
    try {
      const coachName = await joinCoach(code);
      onJoined();
      showAlert('', t.joinedCoach(coachName));
    } catch (err: any) {
      const key = joinErrorKey(err);
      showAlert('', key ? t[key] : err?.message ?? t.genericError);
    }
  };

  return (
    <ConfirmModal
      visible
      title={t.joinCoachTitle(invite.coachName)}
      message={t.joinCoachMsg(invite.coachName)}
      confirmLabel={t.joinCoachConfirm}
      cancelLabel={t.cancel}
      onConfirm={accept}
      onCancel={close}
    />
  );
}
