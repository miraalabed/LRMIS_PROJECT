export function registerUser(data: Record<string, unknown>): Promise<Record<string, unknown>>;
export function loginUser(data: Record<string, unknown>): Promise<{ token: string; expires_at: string }>;
export function getCurrentUser(): Promise<Record<string, unknown>>;
