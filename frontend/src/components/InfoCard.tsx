import { theme } from '../theme';

export function InfoCard({
  title,
  value,
  detail,
  onClick,
  disabled = false,
}: {
  title: string;
  value?: React.ReactNode;
  detail?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      style={{
        textAlign: 'left',
        border: `1px solid ${theme.colors.border}`,
        background: theme.colors.card,
        borderRadius: theme.radii.small,
        padding: theme.spacing.lg,
        boxShadow: theme.shadows.low,
        cursor: disabled ? 'not-allowed' : onClick ? 'pointer' : 'default',
        opacity: disabled ? 0.66 : 1,
        minHeight: 120,
        fontFamily: theme.fonts.body,
      }}
    >
      <div style={{ color: theme.colors.mutedText, fontSize: 14, fontWeight: 700 }}>{title}</div>
      {value !== undefined && <div style={{ color: theme.colors.primary, fontSize: 30, fontWeight: 800, marginTop: theme.spacing.sm }}>{value}</div>}
      {detail && <div style={{ color: theme.colors.mutedText, marginTop: theme.spacing.sm, lineHeight: 1.5 }}>{detail}</div>}
    </button>
  );
}
