import * as React from 'react';

/**
 * PostFeatureFields — from quireink@2.0.0.
 */
export interface PostFeatureFieldsProps {
features: FeatureSettings;
  onChange: (f: FeatureSettings) => void;
  relatedCount: number;
  onRelatedCount: (n: number) => void;
}

export declare const PostFeatureFields: React.ComponentType<PostFeatureFieldsProps>;
