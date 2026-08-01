import * as React from 'react';

/**
 * Textarea — from quireink@2.0.0.
 */
export interface TextareaProps {
label?: string;
  note?: ReactNode;
  /* plus the standard props inherited from react */
  [key: string]: unknown;
}

export declare const Textarea: React.ComponentType<TextareaProps>;
