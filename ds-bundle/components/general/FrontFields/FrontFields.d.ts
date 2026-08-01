import * as React from 'react';

/**
 * FrontFields — from quireink@2.0.0.
 */
export interface FrontFieldsProps {
front: FrontSettings;
  onChange: (f: FrontSettings) => void;
  posts: { slug: string; title: string; }[];
  categories: string[];
}

export declare const FrontFields: React.ComponentType<FrontFieldsProps>;
