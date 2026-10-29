import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md';
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  className = '',
  disabled,
  children,
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center font-sans select-none rounded-[0.375rem] transition-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer';

  const sizeClasses =
    size === 'sm'
      ? 'px-2.5 py-1 text-[13px] font-medium gap-1.5'
      : 'px-3.5 py-1.5 text-[14px] font-medium gap-2';

  const variantClasses =
    variant === 'primary'
      ? 'bg-brand hover:bg-brand-hover text-white shadow-sm border border-transparent'
      : 'bg-surface hover:bg-[rgba(43,42,42,0.04)] text-ink border border-border shadow-[0_1px_2px_rgba(43,42,42,0.05)]';

  return (
    <button
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
