import * as React from 'react';

/**
 * MultiSelect — from quireink@2.0.0.
 */
export interface MultiSelectProps {
label: string;
  value: string[];
  options: string[];
  placeholder?: string;
  onChange: (next: string[]) => void;
  lowercase?: boolean;
}

export declare const MultiSelect: React.ComponentType<MultiSelectProps>;
