import * as React from 'react';

/**
 * TrendChart — from quireink@2.0.0.
 */
export interface TrendChartProps {
points: DailyPoint[];
  peakLabel: string;
  viewsLabel: string;
  visitorsLabel: string;
}

export declare const TrendChart: React.ComponentType<TrendChartProps>;
