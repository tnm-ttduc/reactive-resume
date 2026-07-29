# Discovery and Research Plan

## 1. Research questions

1. Recruiter đang mất bao lâu cho mỗi loại CV?
2. Bước nào gây lỗi/rework nhiều nhất?
3. Anonymization/branding có đủ giá trị để trả tiền không?
4. Một candidate thường có bao nhiêu CV version?
5. PDF hay DOCX là output chính, fidelity kỳ vọng ra sao?
6. Template creative/portfolio thực sự phổ biến đến mức nào?
7. Công ty có quyền sử dụng/chuyển đổi các template cung cấp không?

## 2. Participant plan

- 5–7 agency recruiters.
- 3–5 in-house HR/TA.
- 2 recruitment managers/admin.
- Nếu có: 2 client/hiring manager nhận CV đã chuẩn hóa.

Không chỉ hỏi ý kiến; yêu cầu participant trình diễn workflow thật với dữ liệu đã được phép dùng hoặc anonymized.

## 3. Interview guide

- Hãy mô tả CV gần nhất anh/chị phải chuẩn hóa.
- Input ở định dạng nào? Ai cung cấp?
- Các bước từ nhận file đến gửi khách hàng?
- Mỗi bước mất bao lâu, lỗi gì thường xảy ra?
- Trường nào cần ẩn và theo policy nào?
- Branding thay đổi theo agency/client/job không?
- Có bao nhiêu version và ai phê duyệt?
- DOCX có bắt buộc không? “Giống mẫu” nghĩa là gì?
- AI được phép xử lý dữ liệu ứng viên không?
- Nếu giảm 50% thời gian, mô hình giá hợp lý là gì?

## 4. Template corpus

Mục tiêu 20–30 mẫu hợp pháp để nghiên cứu:

| Nhóm | Số lượng | Biến thể |
|---|---:|---|
| ATS/simple | 5–7 | 1–3 trang, VI/EN |
| Corporate | 5–7 | branding, cover/footer |
| Two-column | 5–7 | sidebar trái/phải |
| Creative/portfolio | 5–7 | image, asymmetric grid, decoration |

Mỗi mẫu có metadata:

- source/owner/permission;
- PDF/DOCX/original editable source;
- pages/language;
- content-flow complexity;
- visual complexity;
- required fidelity;
- supported/unsupported feature notes.

Không đưa CV thật chứa PII vào corpus kỹ thuật nếu chưa có legal basis/consent và security control.

## 5. Complexity scoring

Chấm 0–3 cho từng trục:

- layout nesting/asymmetry;
- dynamic content flow;
- pagination;
- typography/font availability;
- visual layers/images/shapes;
- tables/charts/infographics;
- per-page variation;
- DOCX-specific constructs.

Chọn 3 golden template: ATS thấp, corporate trung bình, portfolio cao.

## 6. Technical experiments

### E1 — Baseline Vietnamese export

5 resume datasets, 15 legacy templates; đo missing glyph, overflow, orphan heading, page count stability.

### E2 — Canonical adapter round trip

Reactive JSON → canonical → Reactive JSON; xác định lossy fields và compatibility.

### E3 — Renderer Bridge parity

Output trước/sau bridge; visual diff và metadata/checksum.

### E4 — AST expressiveness

Mã hóa ATS và portfolio golden template; ghi lại escape hatch cần thiết.

### E5 — PDF visual extraction

Text boxes/font/color/image → candidate component mapping; đo semantic/layout accuracy.

### E6 — DOCX extraction

Đánh giá document XML/style/table/text box khác PDF; không giả định chung pipeline 100%.

## 7. Evidence repository

```text
research/
├── interviews/          # access restricted, redacted summaries
├── workflow-observations/
├── template-corpus/     # permission metadata
├── experiments/
├── golden-datasets/
└── decisions/
```

## 8. Synthesis outputs

- Current-state journey map.
- Time-on-task baseline.
- Ranked pain points.
- Persona/JTBD updates.
- Pilot scope changes.
- Template capability matrix.
- Compiler feasibility report.
- Pricing hypothesis.

## 9. Discovery exit criteria

- Ít nhất 8 interviews và 5 workflow observations.
- Có định lượng baseline time cho 3 use case chính.
- Có 3 pilot organizations/candidates hoặc lý do pivot.
- Corpus có quyền sử dụng rõ.
- Product scope và technical gates được cập nhật từ evidence.
