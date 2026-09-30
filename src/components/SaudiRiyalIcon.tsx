import React from 'react'

export function SaudiRiyalIcon({
  size = 16,
  style,
  className,
}: {
  size?: number
  style?: React.CSSProperties
  className?: string
}) {
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.round(size * 0.85),
        fontWeight: 800,
        lineHeight: 1,
        width: size,
        height: size,
        ...style,
      }}
    >
      ﷼
    </span>
  )
}

export default SaudiRiyalIcon
