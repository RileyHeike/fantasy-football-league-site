/** Static export: the whole site is plain files, rebuilt after each nightly sync. */
const nextConfig = {
  output: "export",
  images: { unoptimized: true },
  transpilePackages: ["@league/core"],
  trailingSlash: true,
};
export default nextConfig;
