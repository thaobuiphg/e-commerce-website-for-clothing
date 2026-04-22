# Website bán quần áo nữ

![GitHub repo size](https://img.shields.io/github/repo-size/thaobuiphg/e-commerce-website-for-clothing)
![GitHub stars](https://img.shields.io/github/stars/thaobuiphg/e-commerce-website-for-clothing?style=social)
![GitHub forks](https://img.shields.io/github/forks/thaobuiphg/e-commerce-website-for-clothing?style=social)
![Platform](https://img.shields.io/badge/platform-Web-blue)
![Frontend](https://img.shields.io/badge/frontend-HTML%2FCSS%2FJS-orange)
![Backend](https://img.shields.io/badge/backend-Node.js-green)
![Database](https://img.shields.io/badge/database-SQL%20Server-red)

---

## Giới thiệu
Đây là website bán quần áo nữ được xây dựng nhằm mục đích học tập trong học phần **Thực tập cơ sở ngành**.

Hệ thống cung cấp các chức năng cơ bản của một website thương mại điện tử, bao gồm quản lý sản phẩm, giỏ hàng và đơn hàng, đồng thời hỗ trợ quản trị hệ thống thông qua trang admin.

---

## Mục tiêu
- Xây dựng website bán hàng cơ bản  
- Áp dụng kiến thức về **Node.js** và **SQL Server**  
- Hiểu quy trình phát triển hệ thống web (frontend + backend)  
- Thực hành CRUD và xử lý dữ liệu  

---

## Tính năng

### Trang người dùng
- Đăng ký / Đăng nhập  
- Xem danh sách sản phẩm theo danh mục, bộ sưu tập  
- Xem chi tiết sản phẩm  
- Thêm / sửa / xoá sản phẩm trong giỏ hàng  
- Đặt hàng  

---

### Trang quản trị (Admin)
- Đăng nhập hệ thống  
- Thống kê doanh thu:
  - Theo ngày / tháng  
  - Theo phương thức thanh toán  

- Quản lý người dùng (CRUD)  
- Quản lý sản phẩm (CRUD)  
- Quản lý đơn hàng (CRUD)  
- Quản lý bộ sưu tập (CRUD)  

---

## Công nghệ sử dụng
- **Front-end:** HTML, CSS, JavaScript  
- **Back-end:** Node.js  
- **Database:** SQL Server  
- **Công cụ:** Visual Studio Code, SQL Server Management Studio  

---

## Kiến trúc hệ thống
Client (Browser)  
↓  
Node.js Server  
↓  
SQL Server Database  

---
---

## Đóng góp cá nhân (Bùi Phương Thảo)

### Chức năng đặt hàng (User)
- Xây dựng quy trình đặt hàng:
  - Thêm sản phẩm vào giỏ hàng  
  - Cập nhật số lượng, xoá sản phẩm  
  - Tính tổng tiền đơn hàng  
- Xử lý logic:
  - Lưu thông tin đơn hàng vào database  
  - Liên kết giữa bảng **Users – Orders – OrderDetails**  
- Kiểm tra dữ liệu đầu vào trước khi đặt hàng  

---

### Phát triển Backend (Admin)
- Xây dựng API bằng **Node.js** cho trang quản trị  
- Thiết kế và triển khai các chức năng:
  - Quản lý người dùng (CRUD)  
  - Quản lý sản phẩm (CRUD)  
  - Quản lý đơn hàng (CRUD)  
  - Quản lý bộ sưu tập (CRUD)  

- Xử lý:
  - Kết nối **SQL Server**  
  - Viết truy vấn SQL cho thêm / sửa / xoá / tìm kiếm  
  - Xây dựng API trả dữ liệu dạng JSON  

---

### Xử lý kỹ thuật
- Kết nối frontend với backend bằng **Fetch API**  
- Xử lý lỗi và kiểm tra dữ liệu (validation)  
- Cập nhật giao diện sau khi thao tác (re-render data)  

---

## Hướng phát triển
- Tích hợp thanh toán online (Momo, VNPay)  
- Cải thiện UI/UX  
- Tối ưu hiệu năng  
- Triển khai lên server (deploy)  

---

## Thông tin
Dự án được thực hiện trong học phần:  
**Thực tập cơ sở ngành (2025)**
