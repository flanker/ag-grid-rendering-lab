import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";

const digest = (value) => createHash("sha256").update(value).digest("hex");
function replaceOnce(source, needle, replacement) {
  if (source.split(needle).length !== 2)
    throw new Error(
      `AG Grid 36.0.2 bridge anchor mismatch: ${needle.slice(0, 90)}`,
    );
  return source.replace(needle, replacement);
}
export function nativeRowBridge() {
  const sources = {};
  const versions = {
    react: "19.2.1",
    "react-dom": "19.2.1",
    "ag-grid-community": "36.0.2",
    "ag-grid-react": "36.0.2",
  };
  for (const [name, version] of Object.entries(versions)) {
    const actual = JSON.parse(
      readFileSync(`node_modules/${name}/package.json`, "utf8"),
    ).version;
    if (actual !== version)
      throw new Error(`Pinned version mismatch: ${name} ${actual}`);
  }
  return {
    name: "ag-grid-36-native-row-bridge",
    enforce: "pre",
    transform(source, id) {
      const path = id.split("?")[0];
      if (path.endsWith("/ag-grid-community/dist/package/main.esm.mjs")) {
        if (!source.includes("var RowComp = class extends Component"))
          throw new Error("Native RowComp missing");
        sources.community = { upstreamSha256: digest(source) };
        const code = `${source}\nexport { RowComp as __LabNativeRowComp };\n`;
        sources.community.transformedSha256 = digest(code);
        return { code, map: null };
      }
      if (!path.endsWith("/ag-grid-react/dist/package/index.esm.mjs")) return;
      sources.react = { upstreamSha256: digest(source) };
      const start = source.indexOf("var RowContainerComp = (");
      const end = source.indexOf("var rowContainerComp_default =", start);
      if (start < 0 || end < 0)
        throw new Error("React RowContainerComp missing");
      let section = source.slice(start, end);
      section = replaceOnce(
        section,
        "const { context, gos } = useContext13(BeansContext);",
        `const beans = useContext13(BeansContext);
  const { context, gos } = beans;
  const nativeRows = !!gos.get("context")?.vanillaRows;
  const lifecycle = gos.get("context")?.labLifecycle;
  const nativeComponents = useRef13(null);
  if (!nativeComponents.current) nativeComponents.current = { rows: new Map(), spans: new Map() };
  const clearNative = () => {
    for (const components of Object.values(nativeComponents.current)) {
      for (const component of components.values()) {
        component.getGui().remove();
        component.destroy();
        if (lifecycle) lifecycle.destroyed++;
      }
      components.clear();
    }
  };`,
      );
      section = replaceOnce(
        section,
        "const updateRowCtrlsOrdered = (useFlushSync) => {",
        `const syncNative = (controllers, isSpan) => {
      const host = isSpan ? eSpanContainerForCtrl : eContainerForCtrl;
      const components = isSpan ? nativeComponents.current.spans : nativeComponents.current.rows;
      if (!host) return;
      const remaining = new Map(components);
      components.clear();
      let previous = null;
      for (const controller of controllers) {
        const key = controller.instanceId;
        let component = remaining.get(key);
        const isNew = !component;
        if (!component) {
          if (!controller.rowNode.displayed) continue;
          component = new __LabNativeRowComp(controller, beans, containerOptions.type);
          if (lifecycle) lifecycle.created++;
        }
        remaining.delete(key);
        components.set(key, component);
        const element = component.getGui();
        if (domOrderRef.current) {
          const next = previous ? previous.nextSibling : host.firstChild;
          if (next !== element) host.insertBefore(element, next);
          previous = element;
        } else if (isNew) host.appendChild(element);
      }
      for (const component of remaining.values()) {
        component.getGui().remove();
        component.destroy();
        if (lifecycle) lifecycle.destroyed++;
      }
    };
    const updateRowCtrlsOrdered = (useFlushSync) => {
      if (nativeRows) { syncNative(rowCtrlsRef.current, false); return; }`,
      );
      section = replaceOnce(
        section,
        "const updateSpannedRowCtrlsOrdered = (useFlushSync) => {",
        "const updateSpannedRowCtrlsOrdered = (useFlushSync) => {\n      if (nativeRows) { syncNative(spannedRowCtrlsRef.current, true); return; }",
      );
      section = replaceOnce(
        section,
        "() => () => {\n      rowContainerCtrlRef.current",
        "() => () => {\n      clearNative();\n      rowContainerCtrlRef.current",
      );
      const code =
        'import { __LabNativeRowComp } from "ag-grid-community";\n' +
        source.slice(0, start) +
        section +
        source.slice(end);
      sources.react.transformedSha256 = digest(code);
      return { code, map: null };
    },
    generateBundle() {
      if (!sources.react || !sources.community)
        throw new Error(
          "Bridge did not transform both pinned AG Grid packages",
        );
      const sourceFiles = [
        ...readdirSync("src").map((name) => `src/${name}`),
        "vite.config.mjs",
        "tooling/native-row-bridge.mjs",
        "pnpm-lock.yaml",
      ];
      const sourceSha256 = digest(
        sourceFiles
          .sort()
          .map((file) => `${file}\n${readFileSync(file, "utf8")}`)
          .join("\n"),
      );
      this.emitFile({
        type: "asset",
        fileName: "build-manifest.json",
        source: JSON.stringify(
          {
            sourceSha256,
            installedVersions: versions,
            versions: {
              react: "19.2.1",
              reactDom: "19.2.1",
              agGridCommunity: "36.0.2",
              agGridReact: "36.0.2",
            },
            revision: process.env.VITE_BUILD_SHA || "local",
            bridgeSha256: digest(
              readFileSync(new URL("./native-row-bridge.mjs", import.meta.url)),
            ),
            lockfileSha256: digest(readFileSync("pnpm-lock.yaml")),
            bridge:
              "Export upstream native RowComp; reuse it in the React row container only when context.vanillaRows is true. Scheduling unchanged.",
            sources,
          },
          null,
          2,
        ),
      });
    },
  };
}
