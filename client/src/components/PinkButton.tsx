import React from 'react';
import { Loader2 } from 'lucide-react';

// ============================================================
// Design: ビビッド・フォーム
// PinkButton: PANTONE Pink C (#D62598) ブランドボタン
// ============================================================

interface PinkButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
}

export default function PinkButton({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  children,
  className = '',
  disabled,
  ...props
}: PinkButtonProps) {
  const baseStyles = `
    inline-flex items-center justify-center font-semibold rounded-xl
    transition-all duration-150 ease-out
    active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
  `;

  const sizeStyles = {
    sm: 'h-9 px-4 text-sm gap-1.5',
    md: 'h-12 px-6 text-sm gap-2',
    lg: 'h-14 px-8 text-base gap-2',
  };

  const variantStyles = {
    primary: `
      text-white shadow-sm
      focus-visible:ring-[#D62598]
    `,
    outline: `
      border-2 bg-transparent
      focus-visible:ring-[#D62598]
    `,
    ghost: `
      bg-transparent
      focus-visible:ring-[#D62598]
    `,
  };

  const variantInlineStyles = {
    primary: {
      background: disabled ? '#e8a0d4' : 'linear-gradient(135deg, #D62598, #c01f88)',
    },
    outline: {
      borderColor: '#D62598',
      color: '#D62598',
    },
    ghost: {
      color: '#D62598',
    },
  };

  return (
    <button
      className={`
        ${baseStyles}
        ${sizeStyles[size]}
        ${variantStyles[variant]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      style={variantInlineStyles[variant]}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}
