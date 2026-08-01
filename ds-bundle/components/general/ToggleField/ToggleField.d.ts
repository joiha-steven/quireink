import * as React from 'react';

/**
 * ToggleField — from quireink@2.0.0.
 */
export interface ToggleFieldProps {
checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}

export declare const ToggleField: React.ComponentType<ToggleFieldProps>;
