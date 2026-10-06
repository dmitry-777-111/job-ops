import type React from "react";

export const PathfinderMark: React.FC<{ className?: string }> = ({
  className,
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M6.2 7.1h11.6" />
    <path d="M8 6.9c.2-2 1.7-3.4 4-3.4s3.8 1.4 4 3.4" />
    <path d="M9.1 8.3c.2 2 1.3 3.2 2.9 3.2s2.7-1.2 2.9-3.2" />
    <path d="M5.2 20.2c.4-4.3 2.6-6.7 6.8-6.7s6.4 2.4 6.8 6.7" />
    <path d="m8.5 14.3 3.5 5 3.5-5" />
    <path d="M12 13.6v5.7" />
    <path d="m10.7 15.4 1.3 1.4 1.3-1.4" />
  </svg>
);
