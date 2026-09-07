/**
 * ImportValidationError -- an import source document could not be parsed
 * or validated (400). Fatal problems reject the whole import: additive
 * formats keep going on row-level problems instead (reported as
 * warnings in the parse result); this error means the document as a
 * whole is unusable or the restore snapshot is inconsistent.
 */

import { AppError } from '../../errors/AppError';
import type { ImportIssue } from '../../types/import';

export class ImportValidationError extends AppError {
    constructor(message: string, issues: ImportIssue[] = []) {
        super(message, 400, true, issues.length > 0 ? { issues } : undefined, 'IMPORT_ERROR');
        this.name = 'ImportValidationError';
    }
}
