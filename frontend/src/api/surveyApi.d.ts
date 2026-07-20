export function listStaff(params?: Record<string, unknown>): Promise<{ data: Record<string, unknown>[]; total: number; page: number; limit: number }>;
export function getStaff(staffId: string): Promise<Record<string, unknown>>;
export function listSurveyTasks(params?: Record<string, unknown>): Promise<{ data: Record<string, unknown>[]; total: number; page: number; limit: number }>;
export function autoAssignSurveyor(applicationId: string): Promise<{ message: string; task_id: string; task_code: string; surveyor_id: string; surveyor_name: string }>;
export function updateSurveyMilestone(applicationId: string, data: Record<string, unknown>): Promise<{ message: string; task_status: string }>;
export function uploadSurveyReport(applicationId: string, data: Record<string, unknown>): Promise<{ message: string }>;
export function getSurveyReport(applicationId: string): Promise<Record<string, unknown>>;
export function registrarReview(applicationId: string, data: Record<string, unknown>): Promise<{ message: string; decision: string }>;
