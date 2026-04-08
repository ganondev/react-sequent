import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: "react-sequent",
  tagline:
    "Simple, flexible, multi-step flows without boilerplate",
  favicon: "img/favicon.ico",

  future: {
    v4: true,
  },

  url: "https://ganondev.github.io",
  baseUrl: "/react-sequent/",

  organizationName: "ganondev",
  projectName: "react-sequent",

  onBrokenLinks: "throw",

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  themes: ["@docusaurus/theme-live-codeblock"],

  plugins: ["./plugins/source-snippets"],

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          editUrl:
            "https://github.com/ganondev/react-sequent/tree/main/docs/",
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: "react-sequent",
      items: [
        {
          type: "docSidebar",
          sidebarId: "docsSidebar",
          position: "left",
          label: "Docs",
        },
        {
          type: "docSidebar",
          sidebarId: "demosSidebar",
          position: "left",
          label: "Demos",
        },
        {
          href: "https://github.com/ganondev/react-sequent",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Learn",
          items: [
            {
              label: "Getting Started",
              to: "/docs/getting-started",
            },
            {
              label: "Core Concepts",
              to: "/docs/concepts",
            },
          ],
        },
        {
          title: "Demos",
          items: [
            { label: "Subsection Flow", to: "/docs/demos/subsection-flow" },
            { label: "Modal", to: "/docs/demos/modal" },
            { label: "Full-Screen Wizard", to: "/docs/demos/wizard" },
            { label: "Toast", to: "/docs/demos/toast" },
          ],
        },
        {
          title: "API",
          items: [
            { label: "useSequentFlow", to: "/docs/api/use-sequent-flow" },
            { label: "useSequentStep", to: "/docs/api/use-sequent-step" },
            { label: "useSequentContext", to: "/docs/api/use-sequent-context" },
            { label: "Types", to: "/docs/api/types" },
          ],
        },
        {
          title: "More",
          items: [
            {
              label: "GitHub",
              href: "https://github.com/ganondev/react-sequent",
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} react-sequent contributors. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
    liveCodeBlock: {
      playgroundPosition: "bottom",
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
