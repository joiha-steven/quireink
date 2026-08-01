import * as React from 'react';

/**
 * PostSettings — from quireink@2.0.0.
 */
export interface PostSettingsProps {
draft: Draft;
  update: (partial: Partial<Draft>) => void;
  allCategories: string[];
  allTags: string[];
  allSeries: string[];
  onPickFeatured: () => void;
  onPickCover: () => void;
}

export declare const PostSettings: React.ComponentType<PostSettingsProps>;
