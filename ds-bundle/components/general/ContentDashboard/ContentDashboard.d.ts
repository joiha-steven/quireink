import * as React from 'react';

/**
 * ContentDashboard — from quireink@2.0.0.
 */
export interface ContentDashboardProps {
posts: Post[];
  pages: Page[];
  views: Record<string, number>;
  commentCounts: Record<string, number>;
  commentsEnabled: boolean;
}

export declare const ContentDashboard: React.ComponentType<ContentDashboardProps>;
