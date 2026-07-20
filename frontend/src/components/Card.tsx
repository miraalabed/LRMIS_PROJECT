import { theme } from '../theme';

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <section
      style={{
        backgroundColor: theme.colors.card,
        color: theme.colors.text,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.radii.large,
        boxShadow: theme.shadows.medium,
        padding: theme.spacing.lg,
        ...style,
      }}
    >
      {children}
    </section>
  );
}
