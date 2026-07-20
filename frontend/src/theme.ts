export const theme = {
  colors: {
    primary: '#0F172A',
    secondary: '#2563EB',
    accent: '#38BDF8',
    background: '#F8FAFC',
    card: '#FFFFFF',
    text: '#1E293B',
    mutedText: '#64748B',
    border: '#E2E8F0',
    success: '#16A34A',
    error: '#DC2626',
    warning: '#F59E0B',
    info: '#0284C7',
  },
  status: {
    pending: { background: '#FEF3C7', text: '#92400E' },
    underReview: { background: '#DBEAFE', text: '#1E40AF' },
    approved: { background: '#DCFCE7', text: '#166534' },
    rejected: { background: '#FEE2E2', text: '#991B1B' },
    needDocuments: { background: '#FFEDD5', text: '#9A3412' },
    completed: { background: '#E0E7FF', text: '#3730A3' },
  },
  radii: {
    small: '8px',
    medium: '16px',
    large: '24px',
    pill: '999px',
  },
  shadows: {
    low: '0 1px 3px rgba(15, 23, 42, 0.08)',
    medium: '0 10px 30px rgba(15, 23, 42, 0.12)',
    high: '0 20px 60px rgba(15, 23, 42, 0.16)',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '40px',
  },
  fonts: {
    body: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    heading: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    code: 'Menlo, Monaco, Consolas, "Courier New", monospace',
  },
};

export type Theme = typeof theme;
