import * as React from 'react';

/**
 * BrandFields — from quireink@2.0.0.
 */
export interface BrandFieldsProps {
s: SiteSettings;
  update: (p: Partial<SiteSettings>) => void;
}

export declare const BrandFields: React.ComponentType<BrandFieldsProps>;
