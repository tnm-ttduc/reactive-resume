# Feature Verification Matrix

Status values: `PASS`, `PARTIAL`, `FAIL`, `BLOCKED`, `NOT RUN`.

| Area | Scenario | Status | Evidence / next action |
|---|---|---|---|
| Runtime | Install frozen dependencies | PASS | pnpm 11.10.0; 1,490 lock entries verified |
| Quality | Typecheck | PASS | 18/18 tasks |
| Quality | Unit tests | PASS | Full monorepo rerun passed |
| Quality | Package boundaries | PASS | 1,016 files checked in latest run |
| Quality | Production build | PASS | Node 24.14.0; server + web |
| Infrastructure | PostgreSQL starts and becomes healthy | PASS | Docker healthcheck passed |
| Infrastructure | Apply all migrations | PASS | Drizzle migrations completed |
| Infrastructure | Local filesystem storage | PASS | API health reports read/write access |
| Application | API health endpoint | PASS | Service/database/storage healthy |
| Application | Landing page HTTP response | PASS | HTTP 200 |
| Application | Landing page browser render | PASS | Main navigation, hero, features and templates visible |
| Auth | Register | PASS | Local account `sprint0.recruiter@example.com` created |
| Auth | Login/logout | PASS | Local QA account logged out and signed in again successfully |
| Auth | Password reset | PASS | Reset request accepted; dev email confirmation screen displayed |
| Resume | Create/edit | PASS | Created `Vietnamese Golden Baseline`; autosave reported `Saved` |
| Resume | Duplicate/delete | PASS | Copy created, opened, then deleted; original retained |
| Resume | Reorder/hide sections | PARTIAL | Hide/persistence pass; drag between main/sidebar remains pending |
| Resume | Version snapshot/restore | PASS | Manual snapshot and non-destructive restore confirmed; versions retained |
| Import | JSON import | NOT RUN | Prepare synthetic fixture |
| Import | Input PDF/DOCX corpus | PASS | 7/7 files readable; 19 rendered pages visually inspected |
| Import | PDF/DOCX AI extraction | PASS | Provider connection pass; one PDF + one DOCX returned valid resume schema |
| Export | JSON export | PASS | Browser download produced valid JSON file |
| Export | PDF export | PASS | Browser download produced A4 PDF; visual Vietnamese QA pass |
| Export | DOCX export | PASS | Browser download produced Microsoft Word 2007+ file |
| Sharing | Public/private/password share | PASS | Public URL, password state, and return to private verified |
| Localization | Vietnamese resume content | PASS | Diacritics rendered correctly in live preview |
| Localization | Vietnamese UI locale | PASS | UI switched to `vi-VN`; navigation/settings rendered in Vietnamese |
| Rendering | 15-template smoke test | PASS | 60/60 PDFs: 15 templates x 4 Vietnamese datasets |
| Rendering | Source corpus page/layout inspection | PASS | A4/Letter, 1/2-column, tables, image and decoration covered |
| Rendering | 1/2/3-page Vietnamese PDF | PASS | All 15 templates produce 1/2/3 pages for medium/long/very-long fixtures |
| Optional infra | Redis/AI workspace | NOT RUN | Cần khi bắt đầu tích hợp AI |
| Optional infra | S3/SeaweedFS | NOT RUN | Local storage selected for first smoke test |
