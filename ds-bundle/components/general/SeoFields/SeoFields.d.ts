import * as React from 'react';

/**
 * SeoFields — from quireink@2.0.0.
 */
export interface SeoFieldsProps {
s: SiteSettings;
  update: (p: Partial<SiteSettings>) => void;
}

export declare const SeoFields: React.ComponentType<SeoFieldsProps>;
