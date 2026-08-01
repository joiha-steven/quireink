import * as React from 'react';

/**
 * AnalyticsView — from quireink@2.0.0.
 */
export interface AnalyticsViewProps {
data: AnalyticsSummary;
  range: 1 | 7 | 30 | 365;
  titles: Record<string, string>;
}

export declare const AnalyticsView: React.ComponentType<AnalyticsViewProps>;
