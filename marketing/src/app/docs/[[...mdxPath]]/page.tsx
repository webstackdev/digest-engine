import { generateStaticParamsFor, importPage } from 'nextra/pages'

export const generateStaticParams = generateStaticParamsFor('docs')

export default async function Page(props: { params: Promise<{ mdxPath: string[] }> }) {
  const params = await props.params
  const { default: MDXPage } = await importPage(params.mdxPath)
  return <MDXPage />
}
