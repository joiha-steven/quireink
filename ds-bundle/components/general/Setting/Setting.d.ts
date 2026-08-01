import * as React from 'react';

/**
 * Setting — from quireink@2.0.0.
 */
export interface SettingProps {
label?: ReactNode;
  note?: ReactNode;
  badge?: string;
  inline?: boolean;
  children: ReactNode;
  className?: string;
}

export declare const Setting: React.ComponentType<SettingProps>;
