import { theme } from '../theme';

type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'success' | 'error';

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    backgroundColor: theme.colors.primary,
    color: theme.colors.card,
    border: `1px solid ${theme.colors.primary}`,
  },
  secondary: {
    backgroundColor: theme.colors.secondary,
    color: theme.colors.card,
    border: `1px solid ${theme.colors.secondary}`,
  },
  accent: {
    backgroundColor: theme.colors.accent,
    color: theme.colors.primary,
    border: `1px solid ${theme.colors.accent}`,
  },
  success: {
    backgroundColor: theme.colors.success,
    color: theme.colors.card,
    border: `1px solid ${theme.colors.success}`,
  },
  error: {
    backgroundColor: theme.colors.error,
    color: theme.colors.card,
    border: `1px solid ${theme.colors.error}`,
  },
};

export function Button({
  children,
  variant = 'primary',
  onClick,
  type = 'button',
  disabled = false,
  style,
}: {
  children: React.ReactNode;
  variant?: ButtonVariant;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className="app-button"
      style={{
        padding: `${theme.spacing.sm} ${theme.spacing.md}`,
        borderRadius: theme.radii.medium,
        boxShadow: theme.shadows.low,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: theme.fonts.body,
        fontWeight: 600,
        transition: 'transform 0.15s ease, opacity 0.15s ease',
        opacity: disabled ? 0.6 : 1,
        ...variantStyles[variant],
        ...style,
      }}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
