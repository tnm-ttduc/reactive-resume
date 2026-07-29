# Executive Brief

## Cơ hội

HR và recruitment agency thường nhận CV ở nhiều định dạng, phải chuẩn hóa thủ công, ẩn thông tin ứng viên, điều chỉnh theo job và gắn branding trước khi gửi khách hàng. Giá trị của HR Platform không nằm ở một CV builder phổ thông, mà ở việc giảm thời gian chuẩn hóa và tái sử dụng CV trong workflow B2B.

## Đề xuất sản phẩm

HR Platform là workspace cho recruiter với bốn lớp giá trị:

1. **Candidate Workspace:** một hồ sơ ứng viên gốc, nhiều CV theo job/khách hàng.
2. **Resume Operations:** builder, versioning, anonymization, branding, export.
3. **AI Assistance:** parse nội dung, rewrite có kiểm soát, dịch và kiểm tra tính nhất quán.
4. **Template Platform:** tạo/chỉnh template có cấu trúc; về sau nhập PDF/DOCX để sinh draft template.

## Chiến lược “foundation first”

Reactive Resume cung cấp sẵn phần lớn product shell: authentication, dashboard, builder, 15 template, PDF/DOCX/JSON export, import resume, version history, public sharing, AI và hệ thống UI. Bản snapshot nghiên cứu là nhánh `main`, commit `689e7e24d45a0744d33f39ed1f1cfe872d58e933`, package version `5.2.3`, ngày 2026-07-09.

Ta không fork rồi sửa mọi thứ cùng lúc. Kiến trúc chuyển đổi:

```text
Reactive Resume foundation
        ↓
HR domain + product configuration
        ↓
Canonical Resume adapter + Renderer bridge
        ↓
Template AST + AST renderer
        ↓
Template Editor + PDF/DOCX Template Compiler
```

## Phạm vi Pilot MVP

Pilot MVP cần có:

- Organization, member, role cơ bản.
- Candidate master profile.
- Nhiều resume cho một candidate.
- Duplicate/version history.
- Ẩn email, điện thoại, địa chỉ và trường tùy chọn.
- Logo, màu và cover/branding của agency.
- Builder/preview/export PDF ổn định với tiếng Việt và tiếng Anh.
- AI rewrite không tự bịa số liệu.
- Audit event tối thiểu cho dữ liệu nhạy cảm và export.

Chưa thuộc Pilot MVP:

- ATS score “thông minh” nhưng không giải thích được.
- Pipeline ATS/CRM hoàn chỉnh.
- Template marketplace.
- Editor kiểu Canva tự do.
- PDF/DOCX → template hoàn toàn tự động.
- Pixel-perfect DOCX cho template phức tạp.

## Kết quả cần đạt sau 16 tuần

- Tuần 1–4: baseline chạy ổn định, audit và rebrand, có architecture runway.
- Tuần 5–10: HR Pilot MVP dùng được bởi nhóm pilot.
- Tuần 11–16: Renderer Bridge và Template AST prototype chạy song song với legacy template.

## KPI đề xuất

| Mục tiêu | Chỉ số |
|---|---|
| Giảm thao tác thủ công | Thời gian từ CV nguồn đến PDF gửi khách hàng giảm ≥ 50% |
| Activation | ≥ 70% recruiter pilot tạo và export CV đầu tiên |
| Retention sớm | ≥ 40% recruiter pilot quay lại trong tuần kế tiếp |
| Chất lượng export | ≥ 95% golden cases không có lỗi layout mức blocker |
| Giá trị AI | ≥ 60% đề xuất được chấp nhận hoặc chỉnh nhẹ |
| Khả năng thương mại | 2–3 tổ chức pilot sẵn sàng trả tiền |

## Quyết định cần founder chốt

1. Pilot tập trung vào agency hay HR nội bộ doanh nghiệp.
2. Dữ liệu được host ở Việt Nam/khu vực nào và yêu cầu residency.
3. Sản phẩm sẽ fork public hay private; chính sách đóng góp upstream.
4. Mức fidelity cần cam kết cho PDF và DOCX.
5. Ai là chủ sở hữu product, architecture và privacy.

## Khuyến nghị

Bắt đầu bằng Sprint 0 hai tuần, không bắt đầu Template Compiler. Mục tiêu Sprint 0 là chứng minh baseline tự host, hiểu luồng data/render/import/export, chốt ranh giới pháp lý và tạo architecture bridge để tránh mắc kẹt trong fork.
