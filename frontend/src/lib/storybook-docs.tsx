import {
  Controls,
  Description,
  Primary,
  Title,
} from "@storybook/addon-docs/blocks"

/** Shared compact Docs tab settings for frontend Storybook stories. */
export const compactDocsParameters = {
  page: () => (
    <>
      <Title />
      <Description />
      <Primary />
      <Controls />
    </>
  ),
  story: {
    height: "96px",
  },
}
