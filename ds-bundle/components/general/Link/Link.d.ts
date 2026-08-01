import * as React from 'react';

/**
 * Link — from quireink@2.0.0.
 */
export interface LinkProps {
/** Accepted and ignored: Next prefetches, this bundle is already loaded. */
  prefetch?: boolean;
  scroll?: boolean;
  replace?: boolean;
  /* plus the standard props inherited from react */
  [key: string]: unknown;
}

export declare const Link: React.ComponentType<LinkProps>;
