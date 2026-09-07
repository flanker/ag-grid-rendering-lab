import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { nativeRowBridge } from "./tooling/native-row-bridge.mjs";

export default defineConfig({
  base: "./",
  plugins: [
    nativeRowBridge(),
    react(),
    {
      name: "lab-favicon",
      transformIndexHtml(_, context) {
        return [
          {
            tag: "link",
            attrs: {
              rel: "icon",
              href:
                context.filename === resolve("index.html")
                  ? "./favicon.svg"
                  : "../favicon.svg",
              type: "image/svg+xml",
            },
            injectTo: "head",
          },
        ];
      },
    },
  ],
  optimizeDeps: { exclude: ["ag-grid-community", "ag-grid-react"] },
  build: {
    rollupOptions: {
      input: Object.fromEntries(
        [
          "index.html",
          "react/index.html",
          "dom-cells/index.html",
          "dom-rows/index.html",
        ].map((file) => [file, resolve(file)]),
      ),
    },
  },
});
