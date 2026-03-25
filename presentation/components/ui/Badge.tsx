type BadgeProps = {
  children: React.ReactNode;
  color?: string;
  className?: string;
};

export function Badge({ children, color = "bg-blue-100 text-blue-700", className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color} ${className}`}
    >
      {children}
    </span>
  );
}
