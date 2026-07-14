# PRD: Ứng dụng Quản lý Giải đấu Billiard (PWA)

## 📌 THÔNG TIN CHUNG (PROJECT OVERVIEW)
*   **Mục tiêu:** Xây dựng ứng dụng Web App (PWA) để quản lý, ghi điểm và xếp hạng cho giải đấu Billiard quy mô nhỏ.
*   **Môi trường chạy:** Hoàn toàn dưới Local (Client-side), không cần Backend Server, không có Database tập trung.
*   **Host:** Deploy file tĩnh (Static Hosting) lên Vercel hoặc Netlify. Có thể cài đặt thành App trên điện thoại thông qua tính năng "Add to Home Screen" (PWA).

## 🛠 CÔNG NGHỆ SỬ DỤNG (TECH STACK)
*   **Core:** ReactJS (build bằng Vite).
*   **Styling:** Tailwind CSS (kết hợp các UI components không style nếu cần).
*   **State Management & Local DB:** Zustand kết hợp middleware `persist` (lưu tự động xuống `localStorage`).
*   **PWA Plugin:** `vite-plugin-pwa` để hỗ trợ cache offline và tạo file `manifest.json`.

## ⚙️ CẤU TRÚC DỮ LIỆU (DATA SCHEMA)

**1. Bảng `teams` (Danh sách đội thi đấu)**
```json
{
  "id": "string",
  "name": "string",
  "played": "number",
  "won": "number",
  "lost": "number",
  "framesWon": "number",
  "framesLost": "number",
  "points": "number"
}
```

**2. Bảng `matches` (Lịch & Kết quả trận đấu)**
```json
{
  "id": "string",
  "team1Id": "string",
  "team2Id": "string",
  "score1": "number | null",
  "score2": "number | null",
  "status": "pending | completed"
}
```

## 🚀 CÁC TÍNH NĂNG CỐT LÕI (CORE FEATURES)

### 1. Khởi tạo giải đấu (Tournament Setup)
*   Cho phép nhập danh sách 5-6 đội thi đấu.
*   Hệ thống tự động sử dụng thuật toán **Round-robin (Vòng tròn một lượt)** để sinh ra toàn bộ lịch thi đấu (10 trận cho 5 đội, 15 trận cho 6 đội).

### 2. Ghi điểm trận đấu (Match Scoring)
*   Luật thi đấu: **Chạm 4**. (thắng 4 trận)
*   Validation: Khi submit kết quả, bắt buộc phải có một đội đạt đúng `4` điểm, đội còn lại đạt từ `0` đến `3` điểm (các tỷ số hợp lệ: 4-0, 4-1, 4-2, 4-3).
*   Cập nhật `status` của trận đấu thành `completed` sau khi lưu.

### 3. Bảng xếp hạng Real-time (Leaderboard)
*   Được tính toán tự động (on-the-fly) mỗi khi có một trận đấu chuyển sang `completed`.
*   **Thuật toán xếp hạng áp dụng theo thứ tự ưu tiên:**
    1.  **Match Points (Điểm trận):** Thắng 1 điểm (hoặc 3 tuỳ config), thua 0 điểm.
    2.  **Frame Difference (Hiệu số ván):** Tổng `framesWon` trừ đi `framesLost`.
    3.  **Head-to-head (Đối đầu trực tiếp):** Nếu 2 đội bằng điểm và hiệu số, kiểm tra kết quả trận đấu trực tiếp giữa 2 đội đó.
