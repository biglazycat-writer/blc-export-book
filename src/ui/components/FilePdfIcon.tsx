import type { SVGProps } from 'react'

export type FilePdfIconProps = SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number }

// 自绘 file-pdf：页面 + 折角 + 实心铭牌（镂空 PDF 字母），见图标语义规范。
export function FilePdfIcon({ size = 24, strokeWidth = 2, ...rest }: FilePdfIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <path d="M7.2 2.5h6.6l5.2 5.2V19.5a2 2 0 0 1-2 2H7.2a2 2 0 0 1-2-2V4.5A2 2 0 0 1 7.2 2.5z" />
      <path d="M13.8 2.5v3.4a1.8 1.8 0 0 0 1.8 1.8H19" />
      <path
        fillRule="evenodd"
        fill="currentColor"
        stroke="none"
        d="M7.6 13.9H16.6A1 1 0 0 1 17.6 14.9V17.9A1 1 0 0 1 16.6 18.9H7.6A1 1 0 0 1 6.6 17.9V14.9A1 1 0 0 1 7.6 13.9ZM7.4 14.8H10V16.6H8.3V18H7.4ZM8.3 15.7H9.1V16.6H8.3ZM10.8 14.8H12.3A1.65 1.65 0 0 1 13.6 16.45A1.65 1.65 0 0 1 12.3 18H10.8ZM11.8 15.7H12.55V16.9H11.8ZM14.4 14.8H16.8V15.7H15.3V16.1H16.5V17H15.3V18H14.4Z"
      />
    </svg>
  )
}
