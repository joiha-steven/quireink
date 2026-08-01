import * as React from 'react';

/**
 * PostsTable — from quireink@2.0.0.
 */
export interface PostsTableProps {
initialPosts: Post[];
  views: Record<string, number>;
  commentCounts: Record<string, number>;
  commentsEnabled: boolean;
}

export declare const PostsTable: React.ComponentType<PostsTableProps>;
