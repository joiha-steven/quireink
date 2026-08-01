import * as React from 'react';

/**
 * ListingFeatureFields — from quireink@2.0.0.
 */
export interface ListingFeatureFieldsProps {
features: FeatureSettings;
  onChange: (f: FeatureSettings) => void;
}

export declare const ListingFeatureFields: React.ComponentType<ListingFeatureFieldsProps>;
