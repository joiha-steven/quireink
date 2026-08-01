import * as React from 'react';

/**
 * AdvancedFields — from quireink@2.0.0.
 */
export interface AdvancedFieldsProps {
typography: TypographySettings;
  onTypography: (t: TypographySettings) => void;
  ideChrome: boolean;
  onIdeChrome: (v: boolean) => void;
  motion: MotionSettings;
  onMotion: (m: MotionSettings) => void;
}

export declare const AdvancedFields: React.ComponentType<AdvancedFieldsProps>;
