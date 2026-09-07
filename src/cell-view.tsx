import { createElement, memo, type ReactNode } from "react";
import type { ICellRendererComp, ICellRendererParams } from "ag-grid-community";
import type { Row, Value } from "./model";

type Node =
  | string
  | { tag: string; attrs: Record<string, string>; children: Node[] };
const el = (
  tag: string,
  attrs: Record<string, string>,
  ...children: Node[]
): Node => ({ tag, attrs, children });
const span = (cls: string, ...children: Node[]) =>
  el("span", { class: cls }, ...children);
const tones = ["mint", "blue", "rose", "amber"];
export function valueLabel(v: Value): string {
  if (v.kind === "number")
    return `¥ ${(v.n * 137 + 1200).toLocaleString("en-US")}`;
  if (v.kind === "boolean") return v.n % 2 ? "已确认" : "待确认";
  if (v.kind === "rating") return `${1 + (v.n % 5)} / 5`;
  if (v.kind === "progress") return `${v.n % 101}%`;
  return v.text;
}
export function cellTree(v: Value, identity: string): Node {
  let children: Node[];
  switch (v.kind) {
    case "rating":
      children = [
        span(
          "stars",
          ...Array.from({ length: 5 }, (_, i) =>
            el(
              "span",
              {
                class: i < 1 + (v.n % 5) ? "star filled" : "star",
                "aria-hidden": "true",
              },
              el(
                "svg",
                { viewBox: "0 0 24 24", width: "17", height: "17" },
                el("path", {
                  d: "m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2 2 9.3l6.9-1z",
                }),
              ),
            ),
          ),
        ),
        span("muted rating-count", `${12 + v.n}条`),
      ];
      break;
    case "attachments":
      children = [
        span(
          "attachments",
          ...Array.from({ length: 3 }, (_, i) =>
            span(
              `thumbnail thumb-${(v.n + i) % 4}`,
              el(
                "svg",
                {
                  viewBox: "0 0 40 30",
                  width: "34",
                  height: "26",
                  "aria-hidden": "true",
                },
                el("circle", {
                  cx: String(9 + i * 5),
                  cy: "9",
                  r: "4",
                  fill: "#fff",
                  opacity: ".8",
                }),
                el("path", {
                  d: "M0 30 14 12 24 25 31 17 40 30Z",
                  fill: "#fff",
                  opacity: ".65",
                }),
              ),
            ),
          ),
        ),
        span("muted", `+${1 + (v.n % 4)}`),
      ];
      break;
    case "tags":
      children = [
        span(
          "tags",
          ...v.parts.map((p, i) => span(`tag ${tones[(v.n + i) % 4]}`, p)),
        ),
      ];
      break;
    case "person":
      children = [
        span(`avatar ${tones[v.n % 4]}`, v.text.slice(0, 1)),
        span(
          "person-copy",
          span("person-name", v.text),
          span("tiny muted", ["设计团队", "产品团队", "研发团队"][v.n % 3]),
        ),
      ];
      break;
    case "matrix":
      children = [
        span(
          "matrix",
          ...["清晰度", "完成度", "协作"].map((name, i) =>
            span(
              "matrix-row",
              span("tiny muted", name),
              span(
                "matrix-dots",
                ...Array.from({ length: 5 }, (_, j) =>
                  span(j <= (v.n + i) % 5 ? "dot on" : "dot", ""),
                ),
              ),
            ),
          ),
        ),
      ];
      break;
    case "items":
      children = [
        span(
          "items",
          ...["设计素材", "交付文档"].map((s, i) =>
            span(
              "item-line",
              span("file-icon", "▤"),
              span("tiny", s),
              span("muted tiny", `×${1 + ((v.n + i) % 9)}`),
            ),
          ),
        ),
      ];
      break;
    case "relation":
      children = [
        span(
          "relations",
          ...[0, 1].map((_, i) =>
            span(
              "relation-chip",
              span("relation-icon", "↗"),
              `${v.text.split(" ")[0]} #${((v.n + i) % 90) + 1}`,
            ),
          ),
        ),
      ];
      break;
    case "progress":
      children = [
        span(
          "progress-track",
          el("span", { class: "progress-fill", style: `width:${v.n % 101}%` }),
        ),
        span("numeric tiny", valueLabel(v)),
      ];
      break;
    case "status":
      children = [
        span(`status ${tones[v.n % 4]}`, span("status-dot", ""), v.text),
      ];
      break;
    case "boolean":
      children = [
        span(`check-box ${v.n % 2 ? "checked" : ""}`, v.n % 2 ? "✓" : ""),
        span("tiny", valueLabel(v)),
      ];
      break;
    case "number":
      children = [span("numeric", valueLabel(v))];
      break;
    case "date":
      children = [span("subtle-icon", "▦"), span("numeric tiny", v.text)];
      break;
    case "address":
      children = [span("subtle-icon", "⌖"), span("", v.text)];
      break;
    case "link":
      children = [
        el(
          "a",
          {
            href: "https://example.com/",
            target: "_blank",
            rel: "noreferrer",
            tabindex: "-1",
            class: "cell-link",
          },
          `${v.text.split(" ")[0]} ↗`,
        ),
      ];
      break;
    default:
      children = [span("text-value", v.text)];
  }
  return el(
    "div",
    {
      class: `cell-content kind-${v.kind}`,
      "data-content-id": identity,
      "data-value": `${v.kind}:${v.n}:${v.text}`,
      title: `${v.text} · ${valueLabel(v)}`,
    },
    ...children,
  );
}
export function cellText(value: Value, identity: string): string {
  const flatten = (node: Node): string =>
    typeof node === "string" ? node : node.children.map(flatten).join("");
  return flatten(cellTree(value, identity));
}
function toReact(node: Node, key = 0): ReactNode {
  if (typeof node === "string") return node;
  const props: Record<string, unknown> = { key };
  for (const [name, value] of Object.entries(node.attrs)) {
    if (name === "class") props.className = value;
    else if (name === "tabindex") props.tabIndex = Number(value);
    else if (name === "style") props.style = { width: value.slice(6) };
    else props[name] = value;
  }
  return createElement(
    node.tag,
    props,
    ...node.children.map((child, i) => toReact(child, i)),
  );
}
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
function toHtml(node: Node): string {
  if (typeof node === "string") return escape(node);
  return `<${node.tag}${Object.entries(node.attrs)
    .map(([k, v]) => ` ${k}="${escape(v)}"`)
    .join("")}>${node.children.map(toHtml).join("")}</${node.tag}>`;
}
const identity = (p: ICellRendererParams<Row, Value>) =>
  `${p.data!.id}:${p.column!.getColId()}`;
export const ReactCell = memo(function ReactCell(
  p: ICellRendererParams<Row, Value>,
) {
  return toReact(cellTree(p.value!, identity(p)));
});
export class DomCell implements ICellRendererComp<Row> {
  private gui!: HTMLElement;
  init(p: ICellRendererParams<Row, Value>) {
    const template = document.createElement("template");
    template.innerHTML = toHtml(cellTree(p.value!, identity(p)));
    this.gui = template.content.firstElementChild as HTMLElement;
  }
  getGui() {
    return this.gui;
  }
  refresh(p: ICellRendererParams<Row, Value>) {
    const tree = cellTree(p.value!, identity(p)) as Exclude<Node, string>;
    for (const [k, v] of Object.entries(tree.attrs))
      this.gui.setAttribute(k, v);
    this.gui.innerHTML = tree.children.map(toHtml).join("");
    return true;
  }
}
