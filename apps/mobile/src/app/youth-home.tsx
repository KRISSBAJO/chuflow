import { AppLockGate } from '@/components/app-lock';
import { YouthHomePreview } from '@/features/youth/home-preview';

export default function YouthHomeRoute() {
  return <AppLockGate><YouthHomePreview participant /></AppLockGate>;
}
