import * as React from 'react';

/**
 * CacheFields — from quireink@2.0.0.
 */
export interface CacheFieldsProps {
cache: CacheSettings;
  onChange: (c: CacheSettings) => void;
}

export declare const CacheFields: React.ComponentType<CacheFieldsProps>;
