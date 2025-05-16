export interface IconProps {
  className?: string;
  size?: 18 | 14 | 12;
}

export default function ZltcIcon({ className, size = 18 }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 18 18"
      className={className}
      fill="none"
    >
      <path
        fill="url(#ltcgradient)"
        fillRule="evenodd"
        d="M9 0C4.03763 0 0 4.03763 0 9C0 13.9624 4.03763 18 9 18C13.9624 18 18 13.9624 18 9C18 4.03763 13.9624 0 9 0ZM9.19 4.5L7.509 9.963L6 10.5L6.305 11.611L7.814 11.074L6.836 13.5H12.5L13 11.611H9.697L10.369 9.815L11.878 9.278L12.183 8.167L10.674 8.704L11.98 4.5H9.19ZM10.236 7.335L9.532 9.278L8.218 8.982L8.922 7.038L10.236 7.335Z"
        clipRule="evenodd"
      />
      <defs>
        <linearGradient
          id="ltcgradient"
          x1={12}
          x2={4.125}
          y1={0}
          y2={16.5}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset={0} stopColor="#345D9D" />
          <stop offset={0.36} stopColor="#4D7CC3" />
          <stop offset={0.777} stopColor="#6E96D8" />
          <stop offset={1} stopColor="#88AAE3" />
        </linearGradient>
      </defs>
    </svg>
  );
} 