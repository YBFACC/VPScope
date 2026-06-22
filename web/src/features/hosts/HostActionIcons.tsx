import type { SVGProps } from "react";

export function ChevronUpIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" {...props}>
      <path d="M4.25 9.75 8 6l3.75 3.75" />
    </svg>
  );
}

export function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" {...props}>
      <path d="M4.25 6.25 8 10l3.75-3.75" />
    </svg>
  );
}

export function XIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" {...props}>
      <path d="m4.75 4.75 6.5 6.5M11.25 4.75l-6.5 6.5" />
    </svg>
  );
}

export function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" {...props}>
      <path d="M5.25 5.25v7M8 5.25v7M10.75 5.25v7M3.5 3.5h9M6 3.5V2.25h4V3.5M4.25 3.5l.5 10.25h6.5l.5-10.25" />
    </svg>
  );
}

export function TerminalIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" {...props}>
      <path d="m5 4.75 3.25 3.25L5 11.25M9 11.25h2.5" />
    </svg>
  );
}

export function DockerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" {...props}>
      <path d="M2.5 7.25h11l-.75 3.25a3 3 0 0 1-2.9 2.25H5.1A3 3 0 0 1 2.2 10.5L1.75 8.75" />
      <path d="M4 5.25h2.25v2H4zM6.25 5.25H8.5v2H6.25zM8.5 5.25h2.25v2H8.5zM6.25 3.25H8.5v2H6.25z" />
      <path d="M12.25 6.25c.55-.85 1.2-1.15 2-1" />
    </svg>
  );
}
