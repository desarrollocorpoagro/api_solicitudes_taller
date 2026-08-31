import React from 'react';

export interface SanLuisLogoProps {
  variant?: 'light' | 'inverse' | 'isotype' | 'hidrocarburos';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'custom';
  height?: number | string;
  width?: number | string;
  className?: string;
  subtext?: string;
}

export const SanLuisLogo: React.FC<SanLuisLogoProps> = ({
  variant = 'light',
  size = 'md',
  height,
  width,
  className = '',
  subtext,
}) => {
  // Height sizing
  const sizeMap: Record<string, number> = {
    xs: 24,
    sm: 32,
    md: 42,
    lg: 56,
    xl: 72,
    custom: typeof height === 'number' ? height : 42,
  };

  const calculatedHeight = height || sizeMap[size] || 42;
  const isInverse = variant === 'inverse';

  if (variant === 'isotype') {
    return (
      <svg
        viewBox="0 0 110 120"
        height={calculatedHeight}
        width={typeof calculatedHeight === 'number' ? (calculatedHeight * 110) / 120 : 'auto'}
        className={`inline-block select-none ${className}`}
        style={{ verticalAlign: 'middle' }}
        aria-label="Isotipo San Luis"
      >
        <g transform="skewX(-14) translate(22, 10)">
          <rect
            x="5"
            y="5"
            width="85"
            height="100"
            rx="22"
            ry="22"
            fill={isInverse ? '#FFFFFF' : '#002D62'}
          />
          <rect
            x="9"
            y="9"
            width="77"
            height="92"
            rx="18"
            ry="18"
            fill={isInverse ? '#002347' : '#FFFFFF'}
          />
          <path
            d="M 28 14 L 68 14 C 77 14, 82 20, 82 28 L 82 45 L 52 45 L 52 56 L 82 56 L 82 72 C 82 80, 77 86, 68 86 L 28 86 C 19 86, 14 80, 14 72 L 14 28 C 14 20, 19 14, 28 14 Z"
            fill="#76BC21"
          />
          <path
            d="M 24 52 L 48 52 L 48 44 L 78 44 L 78 76 C 78 86, 70 94, 58 94 L 28 94 C 18 94, 15 88, 15 80 L 24 52 Z"
            fill={isInverse ? '#003366' : '#002D62'}
          />
          <path
            d="M 32 26 L 48 26 L 48 68 L 68 68 L 68 80 L 32 80 Z"
            fill="#FFFFFF"
          />
        </g>
      </svg>
    );
  }

  if (variant === 'hidrocarburos') {
    return (
      <svg
        viewBox="0 0 380 340"
        height={calculatedHeight}
        width={typeof calculatedHeight === 'number' ? (calculatedHeight * 380) / 340 : 'auto'}
        className={`inline-block select-none ${className}`}
        style={{ verticalAlign: 'middle' }}
        aria-label="Logotipo San Luis Hidrocarburos"
      >
        <g transform="translate(130, 20)">
          <g transform="skewX(-14) translate(20, 0)">
            <rect x="5" y="5" width="85" height="100" rx="22" ry="22" fill="#002D62" />
            <rect x="9" y="9" width="77" height="92" rx="18" ry="18" fill="#FFFFFF" />
            <path d="M 28 14 L 68 14 C 77 14, 82 20, 82 28 L 82 45 L 52 45 L 52 56 L 82 56 L 82 72 C 82 80, 77 86, 68 86 L 28 86 C 19 86, 14 80, 14 72 L 14 28 C 14 20, 19 14, 28 14 Z" fill="#76BC21" />
            <path d="M 24 52 L 48 52 L 48 44 L 78 44 L 78 76 C 78 86, 70 94, 58 94 L 28 94 C 18 94, 15 88, 15 80 L 24 52 Z" fill="#002D62" />
            <path d="M 32 26 L 48 26 L 48 68 L 68 68 L 68 80 L 32 80 Z" fill="#FFFFFF" />
          </g>
        </g>
        <text x="190" y="210" textAnchor="middle" fontFamily="'Rubik', 'Montserrat', sans-serif" fontWeight="800" fontStyle="italic" fontSize="50" fill="#002D62" letterSpacing="1">
          SAN LUIS
        </text>
        <g transform="translate(40, 235)">
          <rect x="0" y="0" width="135" height="22" fill="#002D62" rx="3" ry="3" />
          <text x="67" y="16" textAnchor="middle" fontFamily="'Rubik', sans-serif" fontWeight="700" fontStyle="italic" fontSize="11" fill="#FFFFFF" letterSpacing="1.5">
            HIDROCARBUROS
          </text>
          <g transform="translate(142, 5)">
            <rect x="0" y="0" width="160" height="2.5" fill="#76BC21" rx="1" />
            <rect x="0" y="4.5" width="160" height="2.5" fill="#76BC21" rx="1" />
            <rect x="0" y="9" width="160" height="2.5" fill="#76BC21" rx="1" />
          </g>
        </g>
      </svg>
    );
  }

  // Standard horizontal logo (Light or Inverse)
  const textColor = isInverse ? '#FFFFFF' : '#002D62';
  const barColor = isInverse ? '#FFFFFF' : '#002D62';
  const outerBorderColor = isInverse ? '#FFFFFF' : '#002D62';
  const innerBgColor = isInverse ? '#002347' : '#FFFFFF';
  const innerNavyColor = isInverse ? '#003366' : '#002D62';

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`} style={{ verticalAlign: 'middle' }}>
      <svg
        viewBox="0 0 490 120"
        height={calculatedHeight}
        width={typeof calculatedHeight === 'number' ? (calculatedHeight * 490) / 120 : 'auto'}
        style={{ display: 'block' }}
        aria-label="Grupo San Luis"
      >
        {/* Isotipo Badge */}
        <g transform="translate(5, 5)">
          <g transform="skewX(-14) translate(20, 0)">
            <rect x="5" y="5" width="85" height="100" rx="22" ry="22" fill={outerBorderColor} />
            <rect x="9" y="9" width="77" height="92" rx="18" ry="18" fill={innerBgColor} />
            <path
              d="M 28 14 L 68 14 C 77 14, 82 20, 82 28 L 82 45 L 52 45 L 52 56 L 82 56 L 82 72 C 82 80, 77 86, 68 86 L 28 86 C 19 86, 14 80, 14 72 L 14 28 C 14 20, 19 14, 28 14 Z"
              fill="#76BC21"
            />
            <path
              d="M 24 52 L 48 52 L 48 44 L 78 44 L 78 76 C 78 86, 70 94, 58 94 L 28 94 C 18 94, 15 88, 15 80 L 24 52 Z"
              fill={innerNavyColor}
            />
            <path
              d="M 32 26 L 48 26 L 48 68 L 68 68 L 68 80 L 32 80 Z"
              fill="#FFFFFF"
            />
          </g>
        </g>

        {/* SAN LUIS Wordmark */}
        <g transform="translate(138, 5)">
          <text
            x="0"
            y="72"
            fontFamily="'Rubik', 'Montserrat', 'Arial Black', sans-serif"
            fontWeight="800"
            fontStyle="italic"
            fontSize="74"
            fill={textColor}
            letterSpacing="1"
          >
            SAN LUIS
          </text>

          {/* Underline: solid bar under SAN */}
          <rect x="0" y="88" width="138" height="11" fill={barColor} rx="2" ry="2" />

          {/* 3 Green Stripes under LUIS */}
          <g transform="translate(144, 88)">
            <rect x="0" y="0" width="190" height="3" fill="#76BC21" rx="1.5" />
            <rect x="0" y="4" width="190" height="3" fill="#76BC21" rx="1.5" />
            <rect x="0" y="8" width="190" height="3" fill="#76BC21" rx="1.5" />
          </g>
        </g>
      </svg>

      {subtext && (
        <span
          style={{
            fontSize: typeof calculatedHeight === 'number' ? Math.max(10, calculatedHeight * 0.28) : 12,
            color: isInverse ? '#9DB8D4' : 'var(--slate)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
            borderLeft: isInverse ? '1px solid rgba(255,255,255,0.2)' : '1px solid var(--line)',
            paddingLeft: 8,
            marginLeft: 2,
            lineHeight: 1.2,
          }}
        >
          {subtext}
        </span>
      )}
    </div>
  );
};

export default SanLuisLogo;
