import * as React from 'react';

/**
 * ThemeFields — from quireink@2.0.0.
 */
export interface ThemeFieldsProps {
presets: ThemePreset[];
  themes: Record<string, ThemeSettings>;
  defaultId: string;
  enabled: string[];
  onChangeThemes: (themes: Record<string, ThemeSettings>) => void;
  onSetDefault: (id: string) => void;
  onChangeEnabled: (ids: string[]) => void;
}

export declare const ThemeFields: React.ComponentType<ThemeFieldsProps>;
