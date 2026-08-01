import * as React from 'react';

/**
 * Editor — from quireink@2.0.0.
 */
export interface EditorProps {
initialContent: string;
  onChange: (markdown: string) => void;
  onDirty: () => void;
  onPickImage: () => void;
  onPickGallery: () => void;
  onUploadFile: (file: File) => Promise<string | null>;
  apiRef: MutableRefObject<EditorApi | null>;
  contentWidth: number;
  toolbarTop?: number;
  typewriterEffects: boolean;
}

export declare const Editor: React.ComponentType<EditorProps>;
