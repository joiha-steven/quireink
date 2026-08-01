import * as React from 'react';

/**
 * TypographyFields — from quireink@2.0.0.
 */
export interface TypographyFieldsProps {
typography: TypographySettings;
  /** The chosen reading font, so Reset restores ITS setup and not another font's. */
  fontPreset: string;
  onChange: (typography: TypographySettings) => void;
}

export declare const TypographyFields: React.ComponentType<TypographyFieldsProps>;
