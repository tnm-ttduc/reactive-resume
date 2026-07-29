# Template Composer v0.2 and AI-first import

## Decision

Template imports use a bounded compiler pipeline:

```text
Source secured
  → AI Vision blueprint
  → deterministic evidence extraction
  → blueprint-guided composer mapping
  → schema validation
  → draft persistence
```

AI is a planning stage, not the final authority. It proposes page regions, section placement, section layout components, ordered content blocks and visual tokens before extraction. The deterministic compiler then reconciles that proposal with measurable PDF/DOCX evidence. Invalid or unavailable AI output falls back to deterministic compilation.

The previous “parse first, AI refine later” path is not used for initial imports. Manual AI Improve remains a separate editor action for comparing an existing draft with its source.

## Canonical model

`TemplateAst.schemaVersion = "0.2"` is the only canonical format during development. Existing test templates may be recreated.

The model has three levels:

1. `page.root`: a recursive page composition tree.
2. `nodes[]`: semantic flow nodes and bounded visual decorations.
3. `section.body`: a recursive content composition tree.

Page layout nodes use `stack`, `row`, `grid`, `columns` or `box`. Leaf slots reference semantic node IDs. A semantic section owns its layout component (`flow`, `timeline`, `cards`, `tags`, `table`, `list`) and a tree of `layout`, `repeat` and `block` nodes.

Content blocks select both:

- a bounded component (`heading`, `text`, `rich-text`, `meta`, `badge`, `list`, `table`, `image`, `contact`);
- a bounded binding (`section.title`, `section.content`, `item.primary`, `item.secondary`, `item.meta`, `item.description`, `item.keywords`, `item.value`).

No arbitrary JavaScript, executable expressions, raw HTML component definitions or unrestricted CSS are accepted.

## AI Vision blueprint

The blueprint deliberately does not contain resume content. It contains:

- page preset, region widths, padding, backgrounds and gap;
- header placement and component variant;
- semantic sections in source order;
- section region, layout component, local columns and heading treatment;
- ordered block components and bindings;
- token suggestions;
- confidence and short source evidence.

The blueprint is Zod-validated before the compiler can consume it. Region references must resolve, region widths must total approximately 100%, enums are closed, and all arrays are bounded.

## Reconciliation policy

- Deterministic extraction owns factual evidence such as recognized text headings, page count, measured font sizes and PDF/DOCX geometry.
- Parse + Mapping own semantic section presence, source heading, source order, content bindings, page-break evidence and measured placement.
- AI Vision only proposes presentation: bounded component variants, visual treatment, spacing and tokens.
- A Vision section suggestion is applied only when it matches one parsed section, clears the confidence threshold and includes source evidence. One suggestion can be consumed only once.
- Vision cannot create a semantic section, reorder parsed sections, replace a source heading, hide a parsed binding or remove deterministic default content blocks.
- A page-layout suggestion is accepted only when it agrees with the parser's detected preset. Disagreements stay in the compiler report for manual review.
- Semantic compiler confidence remains deterministic. Accepted Vision suggestions may improve visual-fidelity confidence; rejected suggestions do not.
- If no runnable AI provider exists, the job continues and produces a safe composer AST from deterministic evidence.

## Renderer contract

HTML preview and React PDF render `page.root` recursively and resolve slots by node ID. Section renderers consume `section.body` recursively. Both renderers use the same component/binding vocabulary, tokens and fallback rules.

The editor presents the model as `Page → Section → Content block`, not as a flat list of technical AST nodes.
Selecting a section edits section layout; selecting a content block edits its bounded component, deterministic data binding,
variant and visibility. Decorations remain an advanced secondary group. Preview and PDF export consume the same AST.

Repeat groups are first-class content blocks. A repeat group may expose a bounded item marker (`none`, `number`, or
`bullet`) and contains dynamic field blocks such as primary title, secondary text, metadata, rich-text/list description,
and keywords. Parser evidence can therefore preserve source structures such as:

- Skills rendered as grouped `Label: values` rows instead of generic tags.
- Experience rendered as numbered repeated items with a title/date row, organization field, bullet-rich description,
  and optional technology field.

When Parse + Mapping recognizes either structure, AI Vision cannot replace it with a tag cloud, timeline, or another
incompatible component family.

## Job stages

```text
queued → ai-vision → extracting → mapping → saving → completed
```

Jobs remain durable in Postgres, use row locking, reclaim stale work and support retry. UI progress describes the actual backend order.

## Follow-up capabilities

The bounded tree supports future additions without replacing the model:

- drag/drop page regions and nested boxes;
- reusable component presets;
- conditional blocks with a bounded predicate registry;
- asset slots for logos and images;
- grid/table cell spans;
- versioned component migrations;
- golden visual regression tests per component family.
