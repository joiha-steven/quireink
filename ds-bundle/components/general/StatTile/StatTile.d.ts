import * as React from 'react';

/**
 * StatTile — from quireink@2.0.0.
 */
export interface StatTileProps {
label: ReactNode;
  value: string | number;
  prev?: number;
  sub?: ReactNode;
}

export declare const StatTile: React.ComponentType<StatTileProps>;
