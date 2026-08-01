import * as React from 'react';

/**
 * IconUpload — from quireink@2.0.0.
 */
export interface IconUploadProps {
kind: "favicon" | "app-icon";
  value: string;
  onChange: (url: string) => void;
  previewClassName: string;
}

export declare const IconUpload: React.ComponentType<IconUploadProps>;
