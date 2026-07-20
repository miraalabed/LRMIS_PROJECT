import { theme } from '../theme';

const statusTheme = {
  submitted: theme.status.pending,
  pre_checked: theme.status.underReview,
  survey_required: theme.status.underReview,
  surveyed: theme.status.underReview,
  legal_review: theme.status.underReview,
  approved: theme.status.approved,
  certificate_issued: theme.status.completed,
  closed: theme.status.completed,
  rejected: theme.status.rejected,
  on_hold: theme.status.needDocuments,
  missing_documents: theme.status.needDocuments,
  under_objection: { background: '#FCE7F3', text: '#9D174D' },
  pending: theme.status.pending,
  underReview: theme.status.underReview,
  needDocuments: theme.status.needDocuments,
  completed: theme.status.completed,
} as const;

export function formatStatus(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function StatusBadge({
  label,
  status,
}: {
  label?: string;
  status: keyof typeof statusTheme | string;
}) {
  const token = status in statusTheme ? statusTheme[status as keyof typeof statusTheme] : theme.status.pending;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
        borderRadius: theme.radii.pill,
        backgroundColor: token.background,
        color: token.text,
        fontWeight: 700,
        fontSize: '0.875rem',
      }}
    >
      {label ?? formatStatus(status)}
    </span>
  );
}
