import * as React from 'react';

/**
 * ThemeToggle — from quireink@2.0.0.
 */
export interface ThemeToggleProps {
lang: "vi" | "en" | "de" | "ja" | "zh" | "ko";
  variant?: "icon" | "text";
  triggerClassName?: string;
}

export declare const ThemeToggle: React.ComponentType<ThemeToggleProps>;
