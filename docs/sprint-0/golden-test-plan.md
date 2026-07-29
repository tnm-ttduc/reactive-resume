# Golden PDF Test Plan and Results

Ngày chạy: `2026-07-21`.

## Contract

Golden suite dùng dữ liệu tổng hợp, không chứa CV thật hoặc PII. Bốn mức dữ liệu tiếng Việt được render qua toàn bộ 15
template code-based bằng Node.js 24 và server PDF adapter.

| Dataset | Mục tiêu | Kết quả trên 15 template |
|---|---|---|
| `short-vi` | Nội dung tối thiểu, 1 trang | 15/15 tạo PDF 1 trang |
| `medium-vi` | Học vấn, 2 kinh nghiệm, dự án, skills | 15/15 tạo PDF 1 trang |
| `long-vi` | 8 kinh nghiệm, 5 dự án | 15/15 tạo PDF 2 trang |
| `very-long-vi` | 14 kinh nghiệm, 7 dự án | 15/15 tạo PDF 3 trang |

Tổng cộng: **60/60 PDF hợp lệ**. Kiểm tra text extraction theo từng trang không tìm thấy trang có dưới 80 ký tự. Các
trang đại diện được render sang PNG và rà trực quan; không thấy missing glyph, overlap, clipping hoặc lỗi dấu tiếng Việt.

## Regression được phát hiện và xử lý

Lần chạy đầu tìm thấy Scizor tách `LevelDisplay` khỏi item ngôn ngữ, tạo trailing page gần trắng. Shared section contract
đã được bổ sung `keepTogether` cho item kỹ năng/ngôn ngữ. Sau thay đổi:

- package PDF typecheck pass;
- 29 test files, 263 tests pass;
- 60 PDF được render lại;
- không còn low-content/trailing blank page trong corpus tổng hợp.

## Cách chạy lại

```bash
volta run --node 24.14.0 --pnpm 11.10.0 pnpm sprint0:render-golden
```

Artifacts và manifest được tạo trong `tmp/pdfs/golden/` và không commit vào Git. Fixture/harness được lưu tại
`tooling/sprint-0/`.

## Gate tiếp theo

- Thêm image diff có baseline được duyệt vào CI ở Sprint 1.
- Thêm dữ liệu missing fields, URL dài, bullet dài và ảnh đại diện.
- Chạy lại sau mọi thay đổi schema, font, template hoặc renderer.
