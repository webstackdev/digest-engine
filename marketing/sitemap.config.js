const siteUrl = "https://acme.torqbit.com";

const sitemapConfig = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || siteUrl,
  generateRobotsTxt: true,
  outDir: "./out", // matches your static export directory
  changefreq: "weekly",
  priority: 0.7,
  sitemapSize: 7000,
};

export default sitemapConfig;
