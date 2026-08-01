import * as React from 'react';

/**
 * Button — from quireink@2.0.0.
 */
export interface ButtonProps {
variant?: "primary" | "secondary" | "ghost" | "danger";
  /* plus the standard props inherited from react */
  [key: string]: unknown;
}

export declare const Button: React.ComponentType<ButtonProps>;
