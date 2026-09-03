// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  tutorialSidebar: [
    {
      type: "doc",
      id: "intro",
      label: "Introduction",
    },
    {
      type: "category",
      label: "Guides",
      items: [
        "api-security",
        "blockchain",
        "binary-search-tree",
        "performance",
      ],
    },
  ],
};

export default sidebars;
