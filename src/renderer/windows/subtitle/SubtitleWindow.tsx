import { useIPC } from '../../hooks/useIPC';
import { useSession } from '../../hooks/useSession';
import { SubtitleOverlay } from '../../components/SubtitleOverlay/SubtitleOverlay';

export function SubtitleWindow() {
  const ipc = useIPC();
  const session = useSession({ ipc });

  return (
    <SubtitleOverlay
      currentTranscript={session.currentTranscript}
      confirmedTranscripts={session.confirmedTranscripts}
      currentTranslation={session.currentTranslation}
      confirmedTranslations={session.confirmedTranslations}
      sessionState={session.sessionState}
    />
  );
}
