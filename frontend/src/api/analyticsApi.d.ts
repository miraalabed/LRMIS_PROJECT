export function getKpis(): Promise<Record<string, unknown>>;
export function getApplicationsByStatus(): Promise<Record<string, unknown>[]>;
export function getApplicationsByZone(): Promise<Record<string, unknown>[]>;
export function getProcessingTime(): Promise<Record<string, unknown>[]>;
export function getSurveyorAnalytics(): Promise<Record<string, unknown>[]>;
export function getRegistrarAnalytics(): Promise<Record<string, unknown>[]>;
export function getParcelsGeoFeed(params?: Record<string, unknown>): Promise<Record<string, unknown>>;
export function getPendingHeatmap(): Promise<Record<string, unknown>>;
