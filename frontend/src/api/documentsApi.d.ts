export function uploadApplicationDocument(
  applicationId: string,
  data: {
    document_type: string;
    uploaded_by: string;
    actor_type?: string;
    notes?: string;
    file: File;
  },
): Promise<Record<string, unknown>>;

export function replaceApplicationDocument(
  applicationId: string,
  documentId: string,
  data: {
    document_type: string;
    uploaded_by: string;
    actor_type?: string;
    notes?: string;
    file: File;
  },
): Promise<Record<string, unknown>>;

export function getApplicationDocuments(applicationId: string): Promise<Record<string, unknown>[]>;
export function deleteApplicationDocument(applicationId: string, documentId: string): Promise<Record<string, unknown>>;
export function reviewApplicationDocument(applicationId: string, documentId: string, data: Record<string, unknown>): Promise<Record<string, unknown>>;
