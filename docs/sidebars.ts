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
  examplesSidebar: [
    "examples/subsection-flow",
    "examples/modal",
    "examples/wizard",
  ],
};

export default sidebars;
