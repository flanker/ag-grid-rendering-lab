import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
} from "ag-grid-community";
import {
  fixtureHash,
  kindAt,
  LABELS,
  makeData,
  MODE_INFO,
  readConfig,
  type Mode,
  type Row,
  type Value,
} from "./model";
import { DomCell, ReactCell, valueLabel, cellText } from "./cell-view";
import { downloadJson, startTiming, type Timing } from "./measurement";
import "./style.css";

ModuleRegistry.registerModules([AllCommunityModule]);
const config = readConfig();
const info = MODE_INFO[config.mode];
const rowData = makeData(config);
const hash = fixtureHash(rowData);
const params = location.search;
const basePath = location.pathname
  .replace(/(?:react|dom-cells|dom-rows)\/(?:index\.html)?$/, "")
  .replace(/index\.html$/, "")
  .replace(/\/?$/, "/");
const modes = Object.keys(MODE_INFO) as Mode[];
const theme = themeQuartz.withParams({
  accentColor: "#287961",
  backgroundColor: "#ffffff",
  foregroundColor: "#31443f",
  borderColor: "#e2e8e4",
  rowBorder: { color: "#edf0ed", width: 1 },
  headerBackgroundColor: "#f5f7f4",
  headerTextColor: "#65716b",
  fontFamily: 'Arial, "PingFang SC", sans-serif',
  fontSize: 12,
  headerFontSize: 11,
  headerHeight: 40,
  rowHeight: 40,
  cellHorizontalPadding: 12,
  wrapperBorderRadius: 0,
  oddRowBackgroundColor: "#fff",
  rowHoverColor: "#f5f8f3",
});
const columnDefs: ColDef<Row, Value>[] = Array.from(
  { length: config.columns },
  (_, index) => ({
    colId: `c${index}`,
    headerName: `${LABELS[kindAt(config.preset, index)]} ${String(index + 1).padStart(2, "0")}`,
    width: 150,
    minWidth: 80,
    valueGetter: (p) => p.data?.values[index],
    valueFormatter: (p) => (p.value ? valueLabel(p.value) : ""),
    cellRenderer: config.mode === "react" ? ReactCell : DomCell,
    comparator: (a, b) => (a?.n ?? 0) - (b?.n ?? 0),
    cellDataType: false,
  }),
);
const defaultColDef: ColDef<Row> = {
  resizable: true,
  sortable: true,
  suppressMovable: false,
};
const context = {
  vanillaRows: config.mode === "dom-rows",
  labLifecycle:
    new URLSearchParams(params).get("lifecycle") === "1"
      ? { created: 0, destroyed: 0 }
      : undefined,
};
const getRowId = ({ data }: { data: Row }) => data.id;
type Lab = {
  api: GridApi<Row>;
  config: typeof config;
  hash: string;
  versions: Record<string, string>;
  data: Row[];
  startTiming: typeof startTiming;
  expected: (id: string, col: string) => string | undefined;
  expectedText: (id: string, col: string) => string | undefined;
  remount: () => void;
  lifecycle?: { created: number; destroyed: number };
};
declare global {
  interface Window {
    __LAB__?: Lab;
  }
}
function App() {
  const api = useRef<GridApi<Row> | null>(null);
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [result, setResult] = useState<
    (Timing & { fixtureModified: boolean }) | null
  >(null);
  const [guide, setGuide] = useState(false);
  const [changed, setChanged] = useState(false);
  const [generation, setGeneration] = useState(0);
  const onReady = (event: GridReadyEvent<Row>) => {
    api.current = event.api;
    if (new URLSearchParams(params).get("test") === "1")
      window.__LAB__ = {
        api: event.api,
        config,
        hash,
        data: rowData,
        versions: { react: "19.2.1", reactDom: "19.2.1", agGrid: "36.0.2" },
        startTiming,
        remount: () => setGeneration((value) => value + 1),
        lifecycle: context.labLifecycle,
        expected: (id, col) => {
          const v =
            event.api.getRowNode(id)?.data?.values[Number(col.slice(1))];
          return v ? `${v.kind}:${v.n}:${v.text}` : undefined;
        },
        expectedText: (id, col) => {
          const value =
            event.api.getRowNode(id)?.data?.values[Number(col.slice(1))];
          return value ? cellText(value, `${id}:${col}`) : undefined;
        },
      };
    setReady(true);
  };
  const measure = () => {
    setRecording(true);
    setResult(null);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const stop = startTiming();
        setTimeout(() => {
          setResult({ ...stop(), fixtureModified: changed });
          setRecording(false);
        }, 10000);
      }),
    );
  };
  const reset = () => {
    api.current?.ensureIndexVisible(0, "top");
    api.current?.ensureColumnVisible("c0", "start");
  };
  const updateSample = () => {
    const node = api.current?.getDisplayedRowAtIndex(0);
    if (!node?.data) return;
    const old = node.data;
    const data = {
      ...old,
      values: old.values.map((v) => ({
        ...v,
        n: (v.n + 1) % 1000,
        text: `${v.text.replace(/ · 更新$/, "")} · 更新`,
      })),
    };
    api.current?.applyTransaction({ update: [data] });
    setChanged(true);
  };
  return (
    <main>
      <header className="masthead">
        <a
          className="wordmark"
          href={`${basePath}react/${params}`}
          aria-label="Rendering Lab 首页"
        >
          <span className="logo-mark">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span>
            RENDERING<span className="wordmark-light"> / LAB</span>
          </span>
        </a>
        <div className="header-right">
          <span className="version-tag">React 19.2.1</span>
          <span className="version-tag">AG Grid 36.0.2</span>
          <a
            href="https://github.com/flanker/ag-grid-rendering-lab"
            target="_blank"
            rel="noreferrer"
          >
            源码 ↗
          </a>
        </div>
      </header>
      <section className="intro">
        <div>
          <p className="eyebrow">EXPERIMENT 001 · AG GRID REACT</p>
          <h1>
            相同的数据，<span>不同的渲染路径。</span>
          </h1>
          <p className="intro-description">
            把复杂字段放进视口，滚动观察。用可重复的实验，判断每一层渲染的成本。
          </p>
        </div>
        <div className="experiment-stamp">
          <span className="live-dot" /> 三组对照实验{" "}
          <span className="stamp-line">
            {config.rows.toLocaleString()} × {config.columns} /{" "}
            {config.preset === "rich" ? 15 : config.preset === "plain" ? 2 : 1}{" "}
            种字段
          </span>
        </div>
      </section>
      <nav className="mode-tabs" aria-label="渲染模式">
        {modes.map((mode) => {
          const item = MODE_INFO[mode];
          return (
            <a
              key={mode}
              className={`mode-tab ${mode === config.mode ? "active" : ""}`}
              href={`${basePath}${mode}/${params}`}
              aria-current={mode === config.mode ? "page" : undefined}
            >
              <span className="mode-letter">{item.letter}</span>
              <span className="mode-copy">
                <strong>{item.title}</strong>
                <span>{item.short}</span>
              </span>
              <span className="mode-arrow">↗</span>
            </a>
          );
        })}
      </nav>
      <section className="workspace" aria-label="滚动实验">
        <div className="toolbar">
          <div className="fixture-controls">
            <label>
              字段组合
              <select
                aria-label="字段组合"
                value={config.preset}
                onChange={(e) => {
                  const q = new URLSearchParams(params);
                  q.set("preset", e.target.value);
                  location.search = q.toString();
                }}
              >
                <option value="rich">丰富字段混合</option>
                <option value="rating">评分密集</option>
                <option value="attachments">附件密集</option>
                <option value="tags">标签密集</option>
                <option value="plain">文本 / 数字</option>
              </select>
            </label>
            <label>
              数据规模
              <select
                aria-label="数据规模"
                value={config.rows === 5000 ? "stress" : "standard"}
                onChange={(e) => {
                  const q = new URLSearchParams(params);
                  q.set("size", e.target.value);
                  location.search = q.toString();
                }}
              >
                <option value="standard">500 行 × 60 列</option>
                <option value="stress">5,000 行 × 50 列</option>
              </select>
            </label>
          </div>
          <div className="toolbar-actions">
            <button
              className="quiet-button"
              onClick={reset}
              disabled={!ready || recording}
            >
              回到起点
            </button>
            <button
              className="record-button"
              onClick={measure}
              disabled={!ready || recording}
            >
              <span
                className={recording ? "record-dot recording" : "record-dot"}
              />
              {recording ? "采集中 · 请滚动 10 秒" : "记录一次手动滚动"}
            </button>
          </div>
        </div>
        <div className="path-strip">
          <span className="path-label">当前路径</span>
          <span>
            字段内容 <b>{info.content}</b>
          </span>
          <span className="path-divider">→</span>
          <span>
            行 / 格子 <b>{info.rows}</b>
          </span>
          <span className="fixture-id">
            SEED {config.seed} · {hash}
          </span>
        </div>
        <div className="grid-frame" data-mode={config.mode}>
          <AgGridReact<Row>
            key={generation}
            theme={theme}
            rowData={rowData}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            rowHeight={40}
            headerHeight={40}
            rowBuffer={5}
            animateRows={false}
            getRowId={getRowId}
            context={context}
            onGridReady={onReady}
          />
        </div>
        <div className="grid-footer">
          <span>
            <i className={`status-led ${ready ? "ready" : ""}`} />
            {ready ? "已就绪" : "初始化中"}
            <span className="footer-separator">/</span>
            {config.rows.toLocaleString()} 行
            <span className="footer-separator">/</span>
            {config.columns} 列
          </span>
          <span>行列虚拟化开启 · 行缓冲 5 · 行高 40 px</span>
          <button
            className="text-button"
            onClick={updateSample}
            disabled={!ready || recording}
          >
            {changed ? "再次更新首行 ↻" : "验证首行更新 ↻"}
          </button>
        </div>
      </section>
      <section className="below-grid">
        <div className="measurement-panel">
          <div className="panel-heading">
            <span className="eyebrow">OBSERVATION</span>
            <button
              className="text-button"
              onClick={() => setGuide(!guide)}
              aria-expanded={guide}
            >
              实验说明 {guide ? "−" : "+"}
            </button>
          </div>
          {result ? (
            <>
              <div className="metric-row">
                <div>
                  <small>回调间隔 P95</small>
                  <strong>
                    {result.p95.toFixed(1)}
                    <em>ms</em>
                  </strong>
                </div>
                <div>
                  <small>最长回调间隔</small>
                  <strong>
                    {result.max.toFixed(1)}
                    <em>ms</em>
                  </strong>
                </div>
                <div>
                  <small>长任务</small>
                  <strong>
                    {result.longTaskSupported
                      ? result.longTasks.length
                      : "不支持"}
                    <em>次</em>
                  </strong>
                </div>
                <button
                  className="quiet-button"
                  onClick={() =>
                    downloadJson(
                      {
                        source: "manual browser session",
                        config,
                        initialFixtureHash: hash,
                        fixtureModified: result.fixtureModified,
                        userAgent: navigator.userAgent,
                        result,
                      },
                      `rendering-lab-${config.mode}.json`,
                    )
                  }
                >
                  导出 JSON ↓
                </button>
              </div>
              <p className="measurement-note">
                手动观察仅供探索；回调间隔是主线程响应代理，不代表实际显示帧率。CPU
                降速需在 Chrome DevTools 中设置。
              </p>
            </>
          ) : (
            <p className="empty-observation">
              {recording
                ? "请在表格内持续滚动。结束后显示回调间隔和长任务。"
                : "点击「记录一次手动滚动」，在表格中上下或左右滚动，10 秒后查看结果。"}
              <span>
                正式结论使用固定输入脚本、多次配对测量与独立画面检查。
              </span>
            </p>
          )}
        </div>
        <aside className="scope-panel">
          <span className="eyebrow">CONTROLLED VARIABLES</span>
          <p>{info.description}</p>
          <span>
            三组共用数据、样式、列宽及缓冲。C 保留 React 页面与 Grid
            入口，仅数据行 / 格子走原生路径。
          </span>
        </aside>
      </section>
      {guide && (
        <section className="guide">
          <h2>如何复现与比较</h2>
          <ol>
            <li>选择相同的字段组合和数据规模，确保复杂字段出现在当前视口。</li>
            <li>
              Chrome DevTools → Performance → CPU，分别设为不降速、4× 和
              6×；本页面不能自行降低 CPU 性能。
            </li>
            <li>
              在三组页面上尝试持续滚动、快速滚动后停下，以及横向滚动。比较空白、内容补齐和主线程响应。
            </li>
            <li>
              正式测量请运行仓库中的自动脚本。它使用浏览器输入、固定视口、预热和配对重复，并单独记录画面。
            </li>
          </ol>
          <p>
            这是 Community 版上的独立合成实验，未包含业务应用和 Enterprise
            功能。原生行桥接依赖内部接口。移除 React
            可能改善、没有明显差异，也可能退化。
          </p>
          <a href={`${basePath}report.html`}>查看实验协议与验收记录 ↗</a>
        </section>
      )}
      <footer className="page-footer">
        <span>独立合成数据 · 无后端 · 无外部图片或字体</span>
        <a href={`${basePath}report.html`}>协议、测量与验收 ↗</a>
        <span>
          BUILD{" "}
          <span id="build-id">{import.meta.env.VITE_BUILD_SHA || "local"}</span>
        </span>
      </footer>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
