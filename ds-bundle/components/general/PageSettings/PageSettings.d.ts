import * as React from 'react';

/**
 * PageSettings — from quireink@2.0.0.
 */
export interface PageSettingsProps {
draft: PageDraft;
  update: (partial: Partial<PageDraft>) => void;
  onPickFeatured: () => void;
}

export declare const PageSettings: React.ComponentType<PageSettingsProps>;
