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
            "api/define-sequent-flow",
            "api/use-sequent-flow",
            "api/use-sequent-step",
            "api/use-sequent-context",
          ],
        },
        "api/flow-outlet",
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
