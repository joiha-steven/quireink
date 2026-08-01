import * as React from 'react';

/**
 * Overview — from quireink@2.0.0.
 */
export interface OverviewProps {
posts: number;
  pages: number;
  comments: number;
  originals: number;
  variants: number;
  files: number;
  totalBytes: number;
  categories: Taxo[];
  tags: Taxo[];
  recent: ActivityEntry[];
  activityEnabled: boolean;
  version: string;
  commit: string | null;
  system: SystemInfo;
  dashboard: DashboardData;
  seo: SeoHealth;
  sources: TrafficSources;
}

export declare const Overview: React.ComponentType<OverviewProps>;
