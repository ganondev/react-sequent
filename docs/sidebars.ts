import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  docsSidebar: [
    "getting-started",
    "concepts",
  ],
  apiSidebar: [
    {
      type: "category",
      label: "Hooks",
      items: [
        "api/use-flow-init",
        "api/use-step",
        "api/use-flow-context",
      ],
    },
    {
      type: "category",
      label: "Components",
      items: ["api/flow-outlet"],
    },
    "api/types",
  ],
};

export default sidebars;
