import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverLift?: boolean;
  as?: 'div' | 'section' | 'article';
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  hoverLift = false,
  as: Component = 'div',
  ...props
}) => {
  return (
    <Component
      className={`bg-surface border border-border rounded-[0.75rem] shadow-[0_1px_2px_rgba(43,42,42,0.06)] ${
        hoverLift ? 'hover-lift' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
};
