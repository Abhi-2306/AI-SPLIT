import { type InputHTMLAttributes, forwardRef } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  suffix?: string;
  prefix?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, suffix, prefix, className = "", id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {prefix && (
            <span className="absolute left-3 text-slate-500 text-sm select-none">{prefix}</span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`w-full rounded-lg border border-slate-300 bg-white dark:bg-slate-800 dark:border-slate-600 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${prefix ? "pl-8" : ""} ${suffix ? "pr-8" : ""} ${error ? "border-red-400 focus:ring-red-400" : ""} ${className}`}
            {...props}
          />
          {suffix && (
            <span className="absolute right-3 text-slate-500 text-sm select-none">{suffix}</span>
          )}
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
