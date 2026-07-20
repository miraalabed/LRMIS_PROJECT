export function createApplicationObjection(
  applicationId: string,
  data: {
    reason: string;
    submitted_by: string;
    actor_type: string;
    supporting_document_ids?: string[];
  },
): Promise<Record<string, unknown>>;

export function getApplicationObjections(applicationId: string): Promise<Record<string, unknown>[]>;
