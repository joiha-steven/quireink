import * as React from 'react';

/**
 * LayoutMenuFields — from quireink@2.0.0.
 */
export interface LayoutMenuFieldsProps {
s: SiteSettings;
  update: (p: Partial<SiteSettings>) => void;
  posts: { slug: string; title: string; }[];
  pages: { slug: string; title: string; }[];
}

export declare const LayoutMenuFields: React.ComponentType<LayoutMenuFieldsProps>;
