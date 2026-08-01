import * as React from 'react';

/**
 * CheckField — from quireink@2.0.0.
 */
export interface CheckFieldProps {
checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}

export declare const CheckField: React.ComponentType<CheckFieldProps>;
