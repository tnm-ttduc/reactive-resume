# Template Platform Specification v0.2

## 1. Objective

Biểu diễn template CV từ ATS đơn giản đến portfolio phức tạp bằng dữ liệu có thể validate/version/edit/render, nhưng vẫn bảo đảm nội dung động và phân trang. AST không nhằm sao chép mọi thiết kế đồ họa bất kỳ; nó là DSL giới hạn cho domain resume.

## 2. Core model

```text
TemplatePackage
├── metadata
├── compatibility
├── tokens
├── pages / layout AST
├── component variants
├── visual layers
├── pagination policy
└── assets
```

Template được render từ:

```text
Canonical Resume + Presentation + Template Package + Branding + Policy
```

## 3. Two-layer rule

### Structured content layer

Dùng document flow cho dữ liệu dài: summary, experience, education, projects, skills, custom sections. Node có thể split/keep-with-next theo rule.

### Visual decoration layer

Dùng absolute positioning có giới hạn cho shape, background, watermark, logo, illustration, floating label. Không bind visual node vào mảng nội dung dài nếu node không có overflow contract.

```text
Template = Structured Flow + Visual Decoration
```

## 4. AST node families

### Layout primitives

`Page`, `Flow`, `Stack`, `Row`, `Column`, `Grid`, `Box`, `Spacer`, `Divider`, `Repeat`.

### Semantic components

`ProfileHeader`, `ContactList`, `SummarySection`, `ExperienceSection`, `EducationSection`, `SkillList`, `LanguageList`, `ProjectSection`, `CertificationSection`, `CustomSection`.

### Visual nodes

`Image`, `Shape`, `Icon`, `Background`, `Watermark`, `AbsoluteLayer`.

### Control/binding nodes

`Bind`, `If`, `ForEach`, `Text`, `RichText`, `FormatDate`, `LocalizedLabel`.

Không cho phép arbitrary JavaScript, raw executable expression hoặc unrestricted CSS.

## 5. Example skeleton

```json
{
  "schemaVersion": "0.2",
  "layout": {
    "preset": "two-column",
    "sidebarWidth": 32,
    "sidebarPosition": "left",
    "pagePadding": 32
  },
  "tokens": {
    "primaryColor": "#173B57",
    "textColor": "#101828",
    "backgroundColor": "#FFFFFF",
    "sidebarColor": "#F3F6F8",
    "headingFont": "Inter",
    "bodyFont": "Inter",
    "bodySize": 10,
    "sectionGap": 18,
    "itemGap": 8,
    "radius": 6
  },
  "page": {
    "root": {
      "id": "page-root",
      "type": "layout",
      "component": "columns",
      "props": { "gap": 20 },
      "children": [
        {
          "id": "region-sidebar",
          "type": "layout",
          "component": "stack",
          "props": { "width": 32, "background": "sidebar" },
          "children": [{ "id": "slot-skills", "type": "slot", "nodeId": "skills" }]
        },
        {
          "id": "region-main",
          "type": "layout",
          "component": "stack",
          "props": { "width": 68 },
          "children": [
            { "id": "slot-header", "type": "slot", "nodeId": "header" },
            { "id": "slot-experience", "type": "slot", "nodeId": "experience" }
          ]
        }
      ]
    }
  },
  "nodes": [
    {
      "id": "experience",
      "type": "section",
      "section": "experience",
      "body": {
        "component": "timeline",
        "root": {
          "id": "experience-body",
          "type": "layout",
          "component": "stack",
          "props": { "rowGap": 8 },
          "children": [
            {
              "id": "experience-heading",
              "type": "block",
              "component": "heading",
              "binding": "section.title",
              "variant": "accent",
              "visible": true
            },
            {
              "id": "experience-items",
              "type": "repeat",
              "binding": "section.items",
              "children": [
                {
                  "id": "experience-item",
                  "type": "layout",
                  "component": "stack",
                  "props": { "border": "divider" },
                  "children": [
                    {
                      "id": "experience-role",
                      "type": "block",
                      "component": "text",
                      "binding": "item.primary",
                      "variant": "strong",
                      "visible": true
                    }
                  ]
                }
              ]
            }
          ]
        }
      }
    },
    {
      "id": "header",
      "type": "header",
      "variant": "split"
    },
    {
      "id": "skills",
      "type": "section",
      "section": "skills",
      "body": {
        "component": "tags",
        "root": {
          "id": "skills-body",
          "type": "layout",
          "component": "stack",
          "props": {},
          "children": [
            {
              "id": "skills-items",
              "type": "repeat",
              "binding": "section.items",
              "children": [
                {
                  "id": "skills-badge",
                  "type": "block",
                  "component": "badge",
                  "binding": "item.primary",
                  "variant": "pill",
                  "visible": true
                }
              ]
            }
          ]
        }
      }
    }
  ]
}
```

## 6. Component Registry contract

Mỗi component definition khai báo:

- identifier và schema version;
- supported variants;
- accepted bindings/data shape;
- editable properties và constraints;
- design token slots;
- pagination behavior;
- renderer compatibility;
- fallback behavior;
- accessibility/semantic metadata nếu có HTML output.

Registry phải reject unknown node/prop và có migration cho deprecated variants.

## 7. Design tokens

Token categories tối thiểu:

- color;
- typography/font/fontSize/lineHeight/weight;
- spacing;
- border/radius;
- image treatment;
- divider;
- page/background.

Branding override chỉ được phép trên token/slot được template đánh dấu `brandable`. Điều này ngăn logo/màu làm hỏng layout.

## 8. Pagination contract

Node structured có thể khai báo:

- `breakBefore`, `breakAfter`;
- `breakInside: auto|avoid`;
- `keepWithNext`;
- `minLinesBefore/After`;
- `repeatOnPage`;
- `overflow: split|clip|shrink|error`.

Quality rules:

- Không để section title một mình cuối trang.
- Không cắt item ngắn khi có thể chuyển cả item.
- Item dài có split point ở paragraph/bullet.
- Decoration không che nội dung sau pagination.
- Font loading failure phải phát warning/error có thể quan sát.

## 9. Template lifecycle

```text
Draft → Review → Published → Deprecated → Archived
```

- Published version là immutable.
- Resume reference đến exact template version để reproducible export.
- Draft test bằng nhiều golden resume dataset.
- Publish yêu cầu schema validation, asset validation, render test và reviewer.

## 10. Internal Template Editor v0.2

Ba panel:

```text
Node tree/layers | Live preview | Properties/tokens
```

Hỗ trợ đầu tiên:

- select/reorder/add/remove supported node;
- component variant;
- typography/color/spacing;
- one/two-column/grid presets;
- decoration position/size/rotation/opacity/z-index;
- pagination settings;
- test dataset switch;
- draft/save/version/publish.

Không hỗ trợ arbitrary custom code/CSS hoặc customer-facing collaboration ở alpha.

## 11. Template Compiler pipeline

```text
Input PDF/DOCX
→ render/extract page structure
→ text blocks + coordinates + font/color/image
→ semantic section detection
→ layout classification
→ component/variant matching
→ token extraction
→ draft AST + unmapped visual fragments
→ render comparison
→ confidence report
→ human correction
```

Đầu ra phải phân loại:

- exact/supported mapping;
- approximated mapping;
- unsupported element;
- manual review required.

## 12. Compiler success metrics

- Time-to-published-template giảm ≥ 70% so với coding thủ công.
- ≥ 80% semantic sections được map đúng trên corpus mục tiêu.
- ≥ 70% layout/tokens được sinh usable trước manual edit.
- Không publish tự động nếu có unsupported element hoặc confidence dưới threshold.
- Visual diff đạt ngưỡng theo từng nhóm template, không dùng một pixel threshold cho mọi loại.

## 13. Prototype gates

### Gate A — AST viability

Một ATS template và một portfolio template render đúng với 5 dataset có độ dài khác nhau.

### Gate B — Editor viability

Operator không sửa code có thể đổi branding/layout/variant và publish version an toàn.

### Gate C — Compiler viability

Ba input đại diện tạo draft giúp giảm ít nhất 50% thời gian so với tạo template từ đầu.

Chỉ đầu tư compiler production sau khi qua cả ba gate.
