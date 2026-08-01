import * as React from 'react';

/**
 * Input — from quireink@2.0.0.
 */
export interface InputProps {
label?: string;
  note?: ReactNode;
  /* plus the standard props inherited from react */
  [key: string]: unknown;
}

export declare const Input: React.ComponentType<InputProps>;
