import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  docsSidebar: [
    "getting-started",
    "concepts",
    {
      type: "category",
      label: "API",
      collapsed: false,
      items: [
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
    },
  ],
  demosSidebar: [
    "demos/subsection-flow",
    "demos/modal",
    "demos/wizard",
    "demos/toast",
  ],
};

export default sidebars;
