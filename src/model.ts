export type Kind =
  | "rating"
  | "attachments"
  | "tags"
  | "person"
  | "matrix"
  | "items"
  | "relation"
  | "progress"
  | "text"
  | "number"
  | "date"
  | "status"
  | "boolean"
  | "address"
  | "link";
export type Preset = "rich" | "rating" | "attachments" | "tags" | "plain";
export type Mode = "react" | "dom-cells" | "dom-rows";
export type Value = { kind: Kind; text: string; n: number; parts: string[] };
export type Row = { id: string; values: Value[] };
export type Config = {
  mode: Mode;
  preset: Preset;
  rows: number;
  columns: number;
  seed: number;
};
export const KINDS: Kind[] = [
  "rating",
  "attachments",
  "tags",
  "person",
  "matrix",
  "items",
  "relation",
  "progress",
  "text",
  "number",
  "date",
  "status",
  "boolean",
  "address",
  "link",
];
export const LABELS: Record<Kind, string> = {
  rating: "体验评分",
  attachments: "交付附件",
  tags: "项目标签",
  person: "负责人",
  matrix: "评估矩阵",
  items: "采购明细",
  relation: "关联记录",
  progress: "完成进度",
  text: "项目名称",
  number: "项目预算",
  date: "交付日期",
  status: "当前状态",
  boolean: "已确认",
  address: "项目地址",
  link: "参考链接",
};
export const MODE_INFO: Record<
  Mode,
  {
    letter: string;
    title: string;
    short: string;
    content: string;
    rows: string;
    description: string;
  }
> = {
  react: {
    letter: "A",
    title: "React 基线",
    short: "React",
    content: "React",
    rows: "React",
    description: "字段内容、数据行和格子均由 React 渲染。",
  },
  "dom-cells": {
    letter: "B",
    title: "原生字段内容",
    short: "DOM cells",
    content: "原生 DOM",
    rows: "React",
    description: "字段内容使用 DOM renderer，行和格子仍由 React 渲染。",
  },
  "dom-rows": {
    letter: "C",
    title: "原生行与格子",
    short: "DOM rows + cells",
    content: "原生 DOM",
    rows: "原生 DOM",
    description: "沿用 B 的字段内容，数据行和格子切换为 AG Grid 原生实现。",
  },
};
export function readConfig(): Config {
  const q = new URLSearchParams(location.search);
  const tail = location.pathname
    .split("/")
    .filter((part) => part && part !== "index.html")
    .at(-1);
  const mode: Mode =
    tail === "dom-cells" || tail === "dom-rows" ? tail : "react";
  const preset = q.get("preset") as Preset;
  return {
    mode,
    preset: ["rich", "rating", "attachments", "tags", "plain"].includes(preset)
      ? preset
      : "rich",
    rows: q.get("size") === "stress" ? 5000 : 500,
    columns: q.get("size") === "stress" ? 50 : 60,
    seed: 16692,
  };
}
export function kindAt(preset: Preset, column: number): Kind {
  if (preset === "plain") return column % 2 ? "number" : "text";
  return preset === "rich" ? KINDS[column % KINDS.length] : preset;
}
const names = [
  "林予安",
  "陈知夏",
  "周可欣",
  "许见山",
  "沈一舟",
  "李望舒",
  "顾清和",
  "何闻溪",
];
const projects = [
  "海岸计划",
  "城市花园",
  "山野来信",
  "雨林观察",
  "星际漫游",
  "青禾工作室",
  "岛屿档案",
  "夜航指南",
];
const tags = [
  "视觉设计",
  "体验研究",
  "重点项目",
  "本周交付",
  "需求确认",
  "已评审",
  "团队协作",
  "持续跟进",
];
export function makeData(config: Config): Row[] {
  let state = config.seed;
  const rand = () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return (value ^ (value >>> 14)) >>> 0;
  };
  return Array.from({ length: config.rows }, (_, r) => ({
    id: `R${String(r + 1).padStart(5, "0")}`,
    values: Array.from({ length: config.columns }, (_, c) => {
      const n = rand() % 1000;
      const kind = kindAt(config.preset, c);
      const text =
        kind === "person"
          ? names[n % 8]
          : kind === "date"
            ? `2026-${String(1 + (n % 12)).padStart(2, "0")}-${String(1 + (n % 28)).padStart(2, "0")}`
            : kind === "status"
              ? ["待开始", "进行中", "待评审", "已完成"][n % 4]
              : kind === "address"
                ? ["上海 · 徐汇", "北京 · 朝阳", "杭州 · 西湖", "成都 · 武侯"][
                    n % 4
                  ]
                : `${projects[n % 8]} ${r + 1}`;
      return {
        kind,
        text,
        n,
        parts: Array.from(
          { length: 2 + (n % 3) },
          (_, i) => tags[(n + i * 3) % 8],
        ),
      };
    }),
  }));
}
export function fixtureHash(rows: Row[]): string {
  let hash = 2166136261;
  const serialized = JSON.stringify(rows);
  for (let i = 0; i < serialized.length; i++)
    hash = Math.imul(hash ^ serialized.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, "0");
}
