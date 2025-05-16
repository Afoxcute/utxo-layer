export interface IconProps {
    className?: string;
    size?: 18 | 14 | 12;
}

export default function LtcIcon({ className, size = 18 }: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 18 18"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            <circle cx="9" cy="9" r="9" fill="#345D9D" />
            <path
                d="M9.19 4.5L7.50902 9.96296L6 10.5L6.30541 11.6111L7.81443 11.0741L6.83607 13.5H12.5L13 11.6111H9.6967L10.3689 9.81481L11.8779 9.27778L12.1833 8.16667L10.6743 8.7037L11.9795 4.5H9.19Z"
                fill="white"
            />
        </svg>
    );
} 