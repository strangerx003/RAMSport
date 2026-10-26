export type ProjectFileKind = "RBD" | "FTA" | "Register";

export type ProjectFile = {
  name: string;
  kind: ProjectFileKind;
  href: string;
};

export type Project = {
  id: string;
  name: string;
  client: string;
  updated: string;
  files: ProjectFile[];
};

export const projects: Project[] = [
  {
    id: "GMRC",
    name: "GMRC System Assurance",
    client: "Metro Programme",
    updated: "Today, 10:42",
    files: [
      { name: "01_GMRC", kind: "RBD", href: "/rbd" },
      { name: "02_GMRC", kind: "FTA", href: "/fta" },
      { name: "GMRC Component Register", kind: "Register", href: "/data-register" },
    ],
  },
  {
    id: "DEPOT",
    name: "Depot Power Analysis",
    client: "Power Systems",
    updated: "Yesterday",
    files: [
      { name: "01_DEPOT", kind: "RBD", href: "/rbd" },
      { name: "DEPOT Component Register", kind: "Register", href: "/data-register" },
    ],
  },
  {
    id: "HVAC",
    name: "Rolling Stock HVAC",
    client: "Rolling Stock",
    updated: "21 Oct 2026",
    files: [
      { name: "01_HVAC", kind: "FTA", href: "/fta" },
      { name: "HVAC Component Register", kind: "Register", href: "/data-register" },
    ],
  },
];
