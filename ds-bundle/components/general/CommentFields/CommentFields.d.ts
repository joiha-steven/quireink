import * as React from 'react';

/**
 * CommentFields — from quireink@2.0.0.
 */
export interface CommentFieldsProps {
comments: CommentSettings;
  onChange: (c: CommentSettings) => void;
}

export declare const CommentFields: React.ComponentType<CommentFieldsProps>;
