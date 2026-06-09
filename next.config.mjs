import createMDX from "@next/mdx";

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ["ts", "tsx", "js", "jsx", "md", "mdx"],
  outputFileTracingRoot: import.meta.dirname,
};

const withMDX = createMDX({});

export default withMDX(nextConfig);
