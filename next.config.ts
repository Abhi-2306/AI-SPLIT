import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["tesseract.js", "pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
