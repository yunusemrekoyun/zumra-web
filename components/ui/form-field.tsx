import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function FormField({
  children,
  className,
  description,
  error,
  htmlFor,
  label,
  optionalLabel,
  required = false,
}: {
  children: ReactNode;
  className?: string;
  description?: string;
  error?: string;
  htmlFor?: string;
  label: string;
  optionalLabel?: string;
  required?: boolean;
}) {
  return (
    <div
      className={cn('space-y-2', className)}
      data-field-error={error ? 'true' : undefined}
    >
      <label
        htmlFor={htmlFor}
        className="flex items-center gap-1.5 text-xs font-bold text-[#2E286C]/60"
      >
        <span>{label}</span>
        {required ? (
          <span aria-hidden="true" className="text-red-500">
            *
          </span>
        ) : optionalLabel ? (
          <span className="font-medium text-[#2E286C]/30">
            ({optionalLabel})
          </span>
        ) : null}
      </label>
      {description && !error && (
        <p className="text-xs leading-5 text-[#2E286C]/40">{description}</p>
      )}
      {children}
      {error && (
        <p role="alert" className="text-xs font-semibold text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

