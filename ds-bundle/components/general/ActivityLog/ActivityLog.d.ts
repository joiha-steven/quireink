import * as React from 'react';

/**
 * ActivityLog — from quireink@2.0.0.
 */
export interface ActivityLogProps {
entries: ActivityEntry[];
  enabled: boolean;
}

export declare const ActivityLog: React.ComponentType<ActivityLogProps>;
