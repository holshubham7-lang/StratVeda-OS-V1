"use client";

import { type ReactNode } from "react";

/** Inline `**bold**`, `*italic*` and `` `code` `` from the brief agent, without raw HTML. */
function parseInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${match.index}`;
    if (token.startsWith("**")) nodes.push(<strong key={key}>{token.slice(2, -2).trim()}</strong>);
    else if (token.startsWith("`")) nodes.push(<code key={key}>{token.slice(1, -1).trim()}</code>);
    else nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    cursor = match.index + token.length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

/** The Foundry agent answers in markdown; this shows it as formatted text rather than literal ### markers. */
export function AgentOutput({ source }: { source: string }) {
  const blocks: ReactNode[] = [];
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let paragraph: string[] = [];
  let listItems: { ordered: boolean; text: string }[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const text = paragraph.join(" ").trim();
    if (text) blocks.push(<p key={`p-${blocks.length}`}>{parseInline(text, `p${blocks.length}`)}</p>);
    paragraph = [];
  };

  const flushList = () => {
    if (!listItems.length) return;
    const ordered = listItems[0].ordered;
    const Tag = ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={`l-${blocks.length}`}>
        {listItems.map((item, index) => <li key={index}>{parseInline(item.text, `l${blocks.length}-${index}`)}</li>)}
      </Tag>
    );
    listItems = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) { flushList(); flushParagraph(); continue; }
    if (/^(---|___|\*\*\*)$/.test(line)) { flushList(); flushParagraph(); blocks.push(<hr key={`hr-${blocks.length}`} />); continue; }

    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (heading) {
      flushList(); flushParagraph();
      const level = /^#{3,}$/.test(line.split(" ")[0]) ? 4 : 3;
      blocks.push(level === 3
        ? <h3 key={`h-${blocks.length}`}>{parseInline(heading[1].trim(), `h${blocks.length}`)}</h3>
        : <h4 key={`h-${blocks.length}`}>{parseInline(heading[1].trim(), `h${blocks.length}`)}</h4>);
      continue;
    }

    const standaloneBold = /^\*\*(.{1,80})\*\*:?$/.exec(line);
    if (standaloneBold) {
      flushList(); flushParagraph();
      blocks.push(<h4 key={`h-${blocks.length}`}>{parseInline(standaloneBold[1].trim(), `h${blocks.length}`)}</h4>);
      continue;
    }

    const bullet = /^[-*+]\s+(.*)$/.exec(line);
    if (bullet) { flushParagraph(); if (listItems.some((item) => item.ordered)) flushList(); listItems.push({ ordered: false, text: bullet[1].trim() }); continue; }

    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    if (numbered) { flushParagraph(); if (listItems.some((item) => !item.ordered)) flushList(); listItems.push({ ordered: true, text: numbered[1].trim() }); continue; }

    flushList();
    paragraph.push(line);
  }
  flushList();
  flushParagraph();

  return <div className="decision-center-agent-text">{blocks}</div>;
}
