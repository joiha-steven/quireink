import * as React from 'react';

/**
 * FontFields — from quireink@2.0.0.
 */
export interface FontFieldsProps {
value: string;
  onChange: (fontPreset: string, typography: TypographySettings) => void;
  chromeFont: string;
  onChromeFont: (v: string) => void;
}

export declare const FontFields: React.ComponentType<FontFieldsProps>;
