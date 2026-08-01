import * as React from 'react';

/**
 * Combobox — from quireink@2.0.0.
 */
export interface ComboboxProps {
label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  options: string[];
}

export declare const Combobox: React.ComponentType<ComboboxProps>;
