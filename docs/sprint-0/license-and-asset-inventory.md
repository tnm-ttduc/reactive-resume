# License and Asset Inventory

Ngày snapshot: `2026-07-21`.

## Kết quả tự động

- Root project license: MIT; notice upstream được giữ trong `LICENSE`.
- Production dependency graph: 1,197 dependencies, gồm 284 optional dependencies.
- Các nhóm license phổ biến: MIT 806, Apache-2.0 68, ISC 37, BSD-3-Clause 15, BSD-2-Clause 11.
- Các license cần review riêng xuất hiện trong graph: MPL-2.0, LGPL-3.0-or-later, CC-BY-4.0, OFL-1.1 và các biểu thức
  dual-license.
- `THIRD_PARTY_NOTICES.md` đã được tạo ở repository root.

Lệnh tái tạo:

```bash
pnpm licenses list --prod --json
pnpm audit --prod --json
```

## Security advisory snapshot

Audit production ghi nhận 0 critical, 0 high, 1 moderate. Advisory moderate thuộc
`@better-auth/oauth-provider` phiên bản `>=1.4.8 <1.7.0-beta.4`: access token có thể không được ràng buộc đúng audience
trong một luồng resource indicator.

Quyết định Sprint 0: không nâng một dependency auth beta tách khỏi upstream chỉ để xử lý advisory này. Owner kỹ thuật
phải xác nhận HR Platform không bật OAuth-provider capability liên quan, theo dõi upstream Better Auth và nâng qua một
baseline đã được test trước production. Bất kỳ việc bật capability này đều là release blocker cho tới khi patched.

## Asset register

| Nhóm | Vị trí | Sprint 0 decision |
|---|---|---|
| Product logo/icons | `apps/web/public/{logo,icon}` | Thay bằng HR Platform trước public launch |
| PWA/favicon/Open Graph | `apps/web/public/` | Tạo lại khi có brand kit |
| Screenshots/video/audio | `apps/web/public/{screenshots,videos,sounds}` | Không tái sử dụng marketing nếu chưa clear |
| Sponsor marks | `apps/web/public/sponsors` | Loại bỏ hoặc xin quyền khi rebrand |
| Sample picture | `apps/web/public/photos` | Thay bằng synthetic/cleared asset |
| Template previews | `apps/web/public/templates` | Giữ trong internal baseline; review trước commercial use |
| Bundled fonts | `apps/web/public/fonts` | Xác minh origin/OFL notice và tạo font manifest |
| Runtime font catalog | `packages/fonts` | Google Fonts metadata; review caching/redistribution policy |

## Exit decision

Không có license blocker đã biết cho local Sprint 0. Commercial/public release vẫn bị chặn cho tới khi hoàn tất asset
clearance, font notices, dependency attribution và legal review.
