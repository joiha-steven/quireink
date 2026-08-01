import * as React from 'react';

/**
 * TrashView — from quireink@2.0.0.
 */
export interface TrashViewProps {
posts: Post[];
  pages: Page[];
  media: MediaItem[];
  files: FileItem[];
  comments: AdminComment[];
}

export declare const TrashView: React.ComponentType<TrashViewProps>;
