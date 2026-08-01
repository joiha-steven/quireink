import * as React from 'react';

/**
 * CommentIntegrations — from quireink@2.0.0.
 */
export interface CommentIntegrationsProps {
comments: CommentSettings;
  env: CommentEnv;
  onChange: (c: CommentSettings) => void;
}

export declare const CommentIntegrations: React.ComponentType<CommentIntegrationsProps>;
