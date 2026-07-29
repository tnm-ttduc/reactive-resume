# Input CV Verification

Ngày kiểm tra: `2026-07-21`.

## Phạm vi

- 7 file: 4 PDF và 3 DOCX.
- File nguồn nằm trong `research/input-cvs/` và bị Git ignore.
- Báo cáo không lưu nội dung hoặc PII trích xuất từ CV.

## Kết quả

| Nhóm kiểm tra | Kết quả |
|---|---|
| Mở/đọc file | 7/7 pass |
| PDF encryption | 4/4 không mã hóa |
| PDF JavaScript | 4/4 không có |
| Render PDF | 11/11 trang render được |
| Render DOCX | 8/8 trang render được |
| Font/ký tự nhìn thấy | Không thấy missing glyph ở vòng kiểm tra trực quan |
| Layout | Có đủ single-column, two-column, bảng, ảnh và decoration để làm corpus ban đầu |
| AI extraction smoke test | Một PDF và DOCX cùng nội dung đều trả về resume data đúng schema |

## Edge cases đã ghi nhận

- Một cặp PDF/DOCX có số trang khác nhau: PDF 4 trang, DOCX 3 trang; trang cuối PDF trống.
- Một PDF độc lập có 2 trang nhưng trang thứ hai trống.
- Corpus có cả A4 và Letter, phù hợp để kiểm thử chuẩn hóa page format.

Các trang trắng được giữ nguyên làm golden cases cho phát hiện blank-page và pagination. Không chỉnh sửa file nguồn.

## Provider compatibility

- Provider thực tế trả response non-stream với header `text/event-stream` và marker `[DONE]`; adapter chỉ chuẩn hóa trường hợp JSON non-stream này.
- PDF attachment trực tiếp không tạo JSON ổn định với model hiện tại. Pipeline dùng PDF.js để trích text cục bộ trước khi gửi AI; nếu PDF không có text layer, hệ thống mới fallback về file attachment.
- DOCX tiếp tục được trích text OOXML cục bộ trước khi gửi AI.
