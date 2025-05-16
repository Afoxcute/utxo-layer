export interface IconProps {
  className?: string;
  size?: 18 | 14 | 12;
}

export default function ZdogeIcon({ className, size = 18 }: IconProps) {
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
        fill="url(#dogegradient)"
        fillRule="evenodd"
        d="M9 0C4.03763 0 0 4.03763 0 9C0 13.9624 4.03763 18 9 18C13.9624 18 18 13.9624 18 9C18 4.03763 13.9624 0 9 0ZM8.46932 13.5H6.75V9.95455H5.625V8.04545H6.75V4.5H9.58636C11.61 4.5 13.275 5.93523 13.275 8.04545V9.95455C13.275 12.0648 11.61 13.5 9.58636 13.5H8.46932ZM8.46932 8.04545H9.35454C10.051 8.04545 10.6364 8.43409 10.6364 9C10.6364 9.56591 10.051 9.95455 9.35454 9.95455H8.46932V8.04545Z"
        clipRule="evenodd"
      />
      <defs>
        <linearGradient
          id="dogegradient"
          x1={12}
          x2={4.125}
          y1={0}
          y2={16.5}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset={0} stopColor="#FFD700" />
          <stop offset={0.36} stopColor="#FFB700" />
          <stop offset={0.777} stopColor="#FFA500" />
          <stop offset={1} stopColor="#FF8C00" />
        </linearGradient>
      </defs>
    </svg>
  );
}
