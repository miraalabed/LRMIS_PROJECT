import { theme } from '../theme';

export function ErrorMessage({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <div
      style={{
        whiteSpace: 'pre-wrap',
        border: `1px solid ${theme.colors.error}`,
        borderRadius: theme.radii.small,
        background: '#FEF2F2',
        color: '#991B1B',
        padding: theme.spacing.md,
        lineHeight: 1.5,
      }}
    >
      {message}
    </div>
  );
}
