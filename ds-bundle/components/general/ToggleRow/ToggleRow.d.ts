import * as React from 'react';

/**
 * ToggleRow — from quireink@2.0.0.
 */
export interface ToggleRowProps {
checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  desc?: string;
  badge?: string;
}

export declare const ToggleRow: React.ComponentType<ToggleRowProps>;
