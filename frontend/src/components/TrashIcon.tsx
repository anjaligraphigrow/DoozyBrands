import type { CSSProperties } from "react";

type TrashIconProps = {
  size?: number;
  className?: string;
  style?: CSSProperties;
};

export default function TrashIcon({
  size = 18,
  className,
  style,
}: TrashIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      style={{
        display: "inline-block",
        verticalAlign: "middle",
        ...style,
      }}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4.75A1.75 1.75 0 0 1 9.75 3h4.5A1.75 1.75 0 0 1 16 4.75V6" />
      <path d="M6 6l1.1 13.2A2 2 0 0 0 9.09 21h5.82a2 2 0 0 0 1.99-1.8L18 6" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  );
}
