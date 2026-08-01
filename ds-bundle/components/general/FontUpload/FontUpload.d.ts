import * as React from 'react';

/**
 * FontUpload — from quireink@2.0.0.
 */
export interface FontUploadProps {
value: FontSettings;
  onChange: (font: FontSettings) => void;
}

export declare const FontUpload: React.ComponentType<FontUploadProps>;
