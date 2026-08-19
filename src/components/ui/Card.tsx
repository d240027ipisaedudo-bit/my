import { type ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const padMap = { none: '', sm: 'p-4', md: 'p-6', lg: 'p-8' };

export function Card({ children, className = '', padding = 'md' }: CardProps) {
  return <div className={`card ${padMap[padding]} ${className}`}>{children}</div>;
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  trend?: { value: string; positive: boolean };
  accent?: 'orange' | 'blue' | 'emerald' | 'amber' | 'rose' | 'violet';
}

const accentMap = {
  orange: 'bg-brand-500/10 text-brand-600 dark:text-brand-400',
  blue: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
};

export function StatCard({ label, value, icon, trend, accent = 'orange' }: StatCardProps) {
  return (
    <div className="card p-5 hover:shadow-md transition-shadow duration-300 animate-fade-in-up">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm text-slate-500 dark:text-ink-400 font-medium">{label}</p>
          <p className="mt-2 text-2xl font-bold font-display text-ink-900 dark:text-white tracking-tight truncate">{value}</p>
        </div>
        <div className={`flex-shrink-0 h-11 w-11 rounded-xl flex items-center justify-center ${accentMap[accent]}`}>
          {icon}
        </div>
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1.5 text-xs">
          <span className={`font-semibold ${trend.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {trend.positive ? '↑' : '↓'} {trend.value}
          </span>
          <span className="text-slate-400 dark:text-ink-500">vs. mes anterior</span>
        </div>
      )}
    </div>
  );
}

export function Badge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${className}`}>
      {children}
    </span>
  );
}
