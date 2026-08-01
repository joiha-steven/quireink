import * as React from 'react';

/**
 * SiteFields — from quireink@2.0.0.
 */
export interface SiteFieldsProps {
s: SiteSettings;
  update: (p: Partial<SiteSettings>) => void;
}

export declare const SiteFields: React.ComponentType<SiteFieldsProps>;
