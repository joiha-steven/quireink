import * as React from 'react';

/**
 * FileUploader — from quireink@2.0.0.
 */
export interface FileUploaderProps {
onUploaded: (items: FileItem[]) => void;
  accept?: string;
  label?: string;
}

export declare const FileUploader: React.ComponentType<FileUploaderProps>;
