import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{children}</svg>;
}

export const Icons = {
  grid: (p: IconProps) => <Icon {...p}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></Icon>,
  table: (p: IconProps) => <Icon {...p}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 9v11M15 9v11"/></Icon>,
  rbd: (p: IconProps) => <Icon {...p}><rect x="2" y="8" width="6" height="8" rx="1"/><rect x="16" y="8" width="6" height="8" rx="1"/><path d="M8 12h8M5 8V5h14v3M5 16v3h14v-3"/></Icon>,
  fta: (p: IconProps) => <Icon {...p}><rect x="8" y="2" width="8" height="5" rx="1"/><path d="M12 7v4M5 11h14M5 11v4M12 11v4M19 11v4"/><circle cx="5" cy="18" r="3"/><path d="M9 21h6l-3-6-3 6Z"/><rect x="16" y="15" width="6" height="6" rx="1"/></Icon>,
  shield: (p: IconProps) => <Icon {...p}><path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></Icon>,
  search: (p: IconProps) => <Icon {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></Icon>,
  bell: (p: IconProps) => <Icon {...p}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></Icon>,
  plus: (p: IconProps) => <Icon {...p}><path d="M12 5v14M5 12h14"/></Icon>,
  upload: (p: IconProps) => <Icon {...p}><path d="M12 16V3m0 0L7 8m5-5 5 5M4 15v5h16v-5"/></Icon>,
  download: (p: IconProps) => <Icon {...p}><path d="M12 3v13m0 0 5-5m-5 5-5-5M4 19v2h16v-2"/></Icon>,
  save: (p: IconProps) => <Icon {...p}><path d="M5 3h12l3 3v15H4V3h1Z"/><path d="M8 3v6h8V3M8 21v-8h8v8"/></Icon>,
  chevron: (p: IconProps) => <Icon {...p}><path d="m9 18 6-6-6-6"/></Icon>,
  more: (p: IconProps) => <Icon {...p}><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/></Icon>,
  logout: (p: IconProps) => <Icon {...p}><path d="M10 17l5-5-5-5M15 12H3M14 3h7v18h-7"/></Icon>,
  pointer: (p: IconProps) => <Icon {...p}><path d="m5 3 14 9-7 2-3 7L5 3Z"/><path d="m12 14 5 5"/></Icon>,
  block: (p: IconProps) => <Icon {...p}><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 12H1M23 12h-2"/></Icon>,
  link: (p: IconProps) => <Icon {...p}><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/></Icon>,
  line: (p: IconProps) => <Icon {...p}><path d="M4 12h16"/></Icon>,
  elbow: (p: IconProps) => <Icon {...p}><path d="M4 5v14h16"/></Icon>,
  undo: (p: IconProps) => <Icon {...p}><path d="M9 7 4 12l5 5"/><path d="M5 12h8a6 6 0 0 1 6 6"/></Icon>,
  redo: (p: IconProps) => <Icon {...p}><path d="m15 7 5 5-5 5"/><path d="M19 12h-8a6 6 0 0 0-6 6"/></Icon>,
  align: (p: IconProps) => <Icon {...p}><path d="M4 5h16M4 19h16M8 8v8M16 8v8"/></Icon>,
  distribute: (p: IconProps) => <Icon {...p}><path d="M4 5v14M20 5v14M8 8v8M16 8v8"/></Icon>,
  play: (p: IconProps) => <Icon {...p}><path d="m9 5 10 7-10 7V5Z"/></Icon>,
};
