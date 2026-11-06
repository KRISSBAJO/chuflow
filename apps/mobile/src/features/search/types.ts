/* Global search shapes, mirroring GlobalSearchResponse in apps/web/src/lib/types.ts. */

export type SearchEntityType = 'guests' | 'members' | 'branches' | 'users' | 'followups';

export type GlobalSearchResultItem = {
  _id: string;
  entityType: SearchEntityType | string;
  title: string;
  subtitle: string;
  meta?: string;
  /** Website path, e.g. /guests/123. */
  href: string;
};

export type GlobalSearchResponse = {
  query: string;
  type: 'all' | SearchEntityType;
  totals: { total: number; guests: number; members: number; branches: number; users: number; followUps: number };
  results: {
    guests: GlobalSearchResultItem[];
    members: GlobalSearchResultItem[];
    branches: GlobalSearchResultItem[];
    users: GlobalSearchResultItem[];
    followUps: GlobalSearchResultItem[];
  };
};
