import * as React from 'react';

/**
 * StatCard — from quireink@2.0.0.
 */
export interface StatCardProps {
label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  href?: string;
}

export declare const StatCard: React.ComponentType<StatCardProps>;
