import { theme } from '../theme';

export function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ display: 'grid', gap: theme.spacing.md }}>
      <h2 style={{ fontSize: 18, margin: 0, color: theme.colors.primary }}>{title}</h2>
      <div className="form-grid">{children}</div>
    </section>
  );
}
