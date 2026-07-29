# Product Requirements — HR Platform

## 1. Product vision

Giúp recruiter biến hồ sơ ứng viên không đồng nhất thành CV chuyên nghiệp, đúng thương hiệu và phù hợp từng cơ hội trong vài phút, đồng thời kiểm soát dữ liệu cá nhân và lịch sử thay đổi.

## 2. Target users

### Primary: Recruitment agency recruiter

- Quản lý nhiều ứng viên và nhiều khách hàng.
- Thường phải ẩn thông tin ứng viên trước khi gửi.
- Cần template/branding theo agency hoặc client.
- Cần tạo nhiều CV version từ cùng một hồ sơ.

### Secondary: In-house HR / talent acquisition

- Chuẩn hóa CV cho hiring manager.
- Cần collaboration, notes, permission và audit.
- Có yêu cầu bảo mật và retention rõ hơn.

### Tertiary: Candidate

- Có thể tham gia nhập/chỉnh dữ liệu sau này, nhưng không phải trọng tâm Pilot MVP.

## 3. Jobs to be done

- Khi nhận một CV PDF/DOCX không đồng nhất, tôi muốn lấy nội dung vào hồ sơ có cấu trúc để giảm nhập liệu.
- Khi gửi CV cho khách hàng, tôi muốn ẩn dữ liệu nhạy cảm và áp branding đúng mà không làm hỏng bố cục.
- Khi ứng viên phù hợp nhiều vị trí, tôi muốn tạo các CV khác nhau mà không làm mất master profile.
- Khi AI viết lại nội dung, tôi muốn biết nó đã đổi gì và không muốn nó bịa thành tích.
- Khi công ty có mẫu CV riêng, tôi muốn đội vận hành tạo/chỉnh template nhanh mà không phải sửa code cho mọi thay đổi nhỏ.

## 4. Problem statement

Quy trình hiện tại phân mảnh giữa Word, PDF, email, drive và công cụ thiết kế. Dữ liệu ứng viên bị sao chép; version khó truy vết; ẩn thông tin và branding thủ công; CV dễ vỡ layout khi nội dung thay đổi. Các resume builder cá nhân không mô hình hóa Candidate → Multiple Resumes → Organization/Client.

## 5. Product principles

1. Structured first, creative where safe.
2. Candidate data và presentation data tách biệt.
3. AI đề xuất; người dùng chịu quyền quyết định cuối.
4. Không bịa số liệu hoặc kinh nghiệm.
5. Preview và PDF là quality contract; DOCX là editable export, không mặc định pixel-perfect.
6. Privacy by default, least privilege, auditability.
7. Template phức tạp dùng structured flow + visual decoration layer, tránh absolute positioning cho nội dung dài.

## 6. Scope theo giai đoạn

### Foundation release

- Self-host Reactive Resume baseline.
- Rebrand bằng product configuration.
- Kiểm tra auth, builder, import, versioning, PDF/DOCX/JSON export.
- Vietnamese font/layout test.

### Pilot MVP

- Organization, membership, Owner/Admin/Recruiter/Viewer.
- Candidate CRUD và master profile.
- Candidate document upload.
- Create/duplicate resume từ candidate.
- Anonymization policy và preview.
- Agency branding.
- Private notes.
- Version history và restore.
- PDF export và audit event.
- AI rewrite/translate/shorten với diff + user approval.

### Template Platform alpha

- Renderer registry: `legacy` và `ast`.
- Template AST v0.1.
- Design tokens, component registry, pagination metadata.
- Internal template editor.
- Một ATS template và một creative template chạy bằng AST.

### Compiler research

- PDF/DOCX page/block extraction.
- Layout/typography/color detection.
- Component matching và confidence report.
- Draft AST + human correction.

## 7. Core user flow

```text
Sign in → Organization → Candidate list → Create/import candidate
→ Review master profile → Create resume variant → Edit/AI assist
→ Apply anonymization + branding → Select template → Preview
→ Export PDF → Record audit/version
```

## 8. Functional requirements

### Candidate

- Mỗi candidate thuộc một organization.
- Candidate có master profile, source documents, tags, owner, notes.
- PII fields có thể mask theo policy mà không phá dữ liệu gốc.
- Xóa/retention phải xử lý cả file và derived data.

### Resume

- Một candidate có nhiều resume.
- Resume lưu content snapshot và presentation settings riêng.
- Có duplicate, version labels, compare/restore.
- Resume có mục tiêu job/client và trạng thái draft/approved/archived.

### Branding

- Logo, màu, contact footer, cover page và disclosure text.
- Có default organization brand và override theo client/template.
- Asset phải được kiểm tra type/size và permission.

### AI

- Các action: parse, summarize, rewrite, grammar, translate, shorten.
- Không tự tạo metric; nếu thiếu, dùng placeholder/question.
- Lưu provider/model, prompt version, input scope, output, user decision và timestamp ở mức phù hợp.
- Có cơ chế xóa dữ liệu AI theo retention/privacy policy.

### Export

- PDF A4/Letter, Unicode Vietnamese, multi-page.
- Tên file cấu hình được và loại bỏ ký tự không an toàn.
- Preview anonymization phải đúng với export.
- DOCX được ghi rõ là editable approximation đối với layout phức tạp.

## 9. Roles đề xuất

| Role | Quyền chính |
|---|---|
| Owner | Billing, security, organization, toàn bộ dữ liệu |
| Admin | Member, branding, template publish, policy |
| Recruiter | Candidate/resume CRUD, AI, export trong phạm vi được gán |
| Reviewer | Comment, approve, export nếu được cấp |
| Viewer | Read-only, không xem PII nếu policy chặn |

## 10. Success metrics

### North-star candidate

`Số CV client-ready được export thành công mỗi recruiter hoạt động mỗi tuần`.

### Funnel

- Organization created.
- Candidate created/imported.
- Resume variant created.
- Preview completed.
- PDF exported.
- Recruiter returns within 7 days.

### Guardrail

- Export failure rate.
- PII exposure incident.
- AI hallucination report.
- Restore/version failure.
- Template visual regression.

## 11. Acceptance of Pilot MVP

Pilot MVP đạt khi tối thiểu 5 recruiter thuộc 2 organization có thể hoàn tất luồng end-to-end với 30 CV thật, không có lỗi PII mức nghiêm trọng, PDF pass ≥ 95% golden cases và median time-to-client-ready giảm ít nhất 50% so với baseline thủ công.

## 12. Open questions

- Có cần client-level workspace ngay trong Pilot hay chỉ organization branding?
- Candidate có được đăng nhập/cộng tác không?
- Approval là bắt buộc hay tùy organization?
- Dữ liệu AI được phép gửi tới provider nào?
- Retention mặc định cho candidate bị reject/archived là bao lâu?
