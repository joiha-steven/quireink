import * as React from 'react';

/**
 * FeaturedField — from quireink@2.0.0.
 */
export interface FeaturedFieldProps {
posts: { slug: string; title: string; }[];
  value: string[];
  onChange: (v: string[]) => void;
}

export declare const FeaturedField: React.ComponentType<FeaturedFieldProps>;
