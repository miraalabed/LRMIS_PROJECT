export function createApplicant(data: Record<string, unknown>): Promise<Record<string, unknown>>;
export function updateApplicant(applicantId: string, data: Record<string, unknown>): Promise<Record<string, unknown>>;
export function getApplicantById(applicantId: string): Promise<Record<string, unknown>>;
export function getApplicantApplications(applicantId: string): Promise<Record<string, unknown>>;
