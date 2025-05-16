export interface IconProps {
    className?: string;
    size?: 18 | 14 | 12;
}

export default function DogeIcon({ className, size = 18 }: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 18 18"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            <circle cx="9" cy="9" r="9" fill="#C2A633" />
            <path
                d="M6.75 5.25H9.75C11.4069 5.25 12.75 6.59315 12.75 8.25V9.75C12.75 11.4069 11.4069 12.75 9.75 12.75H6.75V5.25Z"
                fill="white"
            />
            <path
                d="M5.25 8.25H10.5"
                stroke="#C2A633"
                strokeWidth="1.2"
                strokeLinecap="round"
            />
        </svg>
    );
} 