import * as React from 'react';

/**
 * MediaToolbar — from quireink@2.0.0.
 */
export interface MediaToolbarProps {
count: number;
  totalSize: number;
  query: string;
  onQuery: (v: string) => void;
  sort: "new" | "name" | "size";
  onSort: (s: MediaSort) => void;
}

export declare const MediaToolbar: React.ComponentType<MediaToolbarProps>;
