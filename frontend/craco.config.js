// craco.config.js
const path = require("path");

module.exports = {
  eslint: {
    configure: {
      extends: ["plugin:react-hooks/recommended"],
      rules: {
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn",
      },
    },
  },
  webpack: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  devServer: (devServerConfig) => {
    // Local dev: proxy /api to the FastAPI backend (uvicorn on :8001).
    devServerConfig.proxy = { "/api": { target: "http://localhost:8001", changeOrigin: true } };
    return devServerConfig;
  },
};
