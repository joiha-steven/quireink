import * as React from 'react';

/**
 * ExportFields — from quireink@2.0.0.
 */
export interface ExportFieldsProps {
backups: BackupSettings;
  onChange: (b: BackupSettings) => void;
}

export declare const ExportFields: React.ComponentType<ExportFieldsProps>;
