import { HomeScreen } from '@/features/home/home-screen';
import { KidsHome } from '@/features/kids/home';
import { YouthOverview } from '@/features/youth/screens';
import { can } from '@/lib/permissions';
import { useSession } from '@/lib/session';

/** Home: the Kids board for children's workers, the dashboard for everyone else. */
export default function HomeRoute() {
  const { user } = useSession();
  if (can.kidsOnly(user?.role)) return <KidsHome />;
  if (can.youthOnly(user?.role)) return <YouthOverview embedded />;
  return <HomeScreen />;
}
