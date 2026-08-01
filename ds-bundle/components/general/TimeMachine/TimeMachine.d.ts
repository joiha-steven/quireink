import * as React from 'react';

/**
 * TimeMachine — from quireink@2.0.0.
 */
export interface TimeMachineProps {
slug: string;
  onRestore: (rev: PostRevision) => void;
  onClose: () => void;
}

export declare const TimeMachine: React.ComponentType<TimeMachineProps>;
