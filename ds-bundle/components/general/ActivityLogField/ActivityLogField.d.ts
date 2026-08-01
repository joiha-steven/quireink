import * as React from 'react';

/**
 * ActivityLogField — from quireink@2.0.0.
 */
export interface ActivityLogFieldProps {
features: FeatureSettings;
  onChange: (f: FeatureSettings) => void;
}

export declare const ActivityLogField: React.ComponentType<ActivityLogFieldProps>;
