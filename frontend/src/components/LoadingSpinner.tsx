import { theme } from '../theme';

export function LoadingSpinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div style={{ color: theme.colors.mutedText, fontWeight: 700, padding: `${theme.spacing.md} 0` }}>
      {label}...
    </div>
  );
}
