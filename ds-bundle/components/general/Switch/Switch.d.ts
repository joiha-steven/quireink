import * as React from 'react';

/**
 * Switch — from quireink@2.0.0.
 */
export interface SwitchProps {
checked: boolean;
  onChange: (v: boolean) => void;
}

export declare const Switch: React.ComponentType<SwitchProps>;
