import * as React from 'react';

/**
 * BarList — from quireink@2.0.0.
 */
export interface BarListProps {
title: ReactNode;
  rows: BarRow[];
  unit: ReactNode;
  empty: ReactNode;
}

export declare const BarList: React.ComponentType<BarListProps>;
