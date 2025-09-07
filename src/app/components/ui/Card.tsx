import * as React from 'react';

export type CardProps = React.HTMLAttributes<HTMLDivElement>;

export function Card({ className = '', children, ...props }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm p-6 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export default Card;
