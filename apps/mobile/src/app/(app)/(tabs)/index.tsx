import { HomeScreen } from '@/features/home/home-screen';
import { KidsHome } from '@/features/kids/home';
import { can } from '@/lib/permissions';
import { useSession } from '@/lib/session';

/** Home: the Kids board for children's workers, the dashboard for everyone else. */
export default function HomeRoute() {
  const { user } = useSession();
  if (can.kidsOnly(user?.role)) return <KidsHome />;
  return <HomeScreen />;
}
