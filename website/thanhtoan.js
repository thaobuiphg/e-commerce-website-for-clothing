const cartKey = "cart";
const FREE_SHIP_THRESHOLD = 500000;
const SHIPPING_FEE_DEFAULT = 30000;

function loadCart() {
    try { return JSON.parse(localStorage.getItem(cartKey)) || []; }
    catch { return []; }
}

function formatVND(n) { return (n || 0).toLocaleString("vi-VN") + "đ"; }

function getCouponFromSession() { return (sessionStorage.getItem("coupon") || "").toUpperCase().trim(); }
function calcDiscount(subtotal, code) {
    if (code === "GIAM10") return Math.min(Math.round(subtotal * 0.1), 200000);
    return 0;
}

// ==================== RENDER TÓM TẮT ĐƠN HÀNG ====================
function renderCheckout() {
    const cart = loadCart();
    const wrap = document.getElementById("orderSummary");
    if (!wrap) return;

    // Xóa các item cũ
    wrap.querySelectorAll(".order-item").forEach(el => el.remove());

    let subtotal = 0;

    if (cart.length === 0) {
        wrap.innerHTML += '<div class="order-item text-center py-4"><p>Giỏ hàng trống</p></div>';
    } else {
        cart.forEach(item => {
            subtotal += item.price_promotion * item.quantity;
            const row = document.createElement("div");
            row.className = "order-item d-flex align-items-center py-3 border-bottom";
            row.innerHTML = `
                <img src="http://localhost:3000/${item.image_url}" alt="${item.product_name}" 
                     style="width:60px;height:60px;object-fit:cover;border-radius:8px;margin-right:12px;">
                <div class="flex-grow-1">
                    <p class="mb-1 fw-bold">${item.product_name}</p>
                    <small class="text-muted">Size: ${item.size || 'M'} × ${item.quantity}</small>
                </div>
                <p>
                <span class="text-dark text-decoration-line-through me-2">${formatVND(item.price)}</span>
                <span class="text-danger fw-bold">${formatVND(item.price_promotion)}</span>
                </p>
            `;
            wrap.insertBefore(row, wrap.querySelector(".summary-row"));
        });
    }

    // Tính toán
    const code = getCouponFromSession();
    const discount = calcDiscount(subtotal, code);
    const shippingFee = (subtotal - discount >= FREE_SHIP_THRESHOLD) ? 0 : SHIPPING_FEE_DEFAULT;
    const total = subtotal - discount + shippingFee;

    document.getElementById("subtotalText").textContent = formatVND(subtotal);
    document.getElementById("discountRow").style.display = discount > 0 ? "" : "none";
    document.getElementById("discountText").textContent = discount > 0 ? "-" + formatVND(discount) : "-0đ";
    document.getElementById("shippingText").textContent = shippingFee === 0 ? "Miễn phí" : formatVND(shippingFee);
    document.getElementById("totalText").innerHTML = `${formatVND(total)} <span>VND</span>`;
}

// ==================== ÁP MÃ GIẢM GIÁ ====================
document.getElementById("applyCouponBtn")?.addEventListener("click", () => {
    const code = document.getElementById("couponInput").value.trim().toUpperCase();
    if (!code) {
        sessionStorage.removeItem("coupon");
        alert("Đã xóa mã giảm giá");
    } else if (code === "GIAM10") {
        sessionStorage.setItem("coupon", code);
        alert("Áp dụng GIAM10 thành công! Giảm 10% (tối đa 200k)");
    } else {
        sessionStorage.removeItem("coupon");
        alert("Mã giảm giá không hợp lệ!");
    }
    renderCheckout();
});

// ==================== KIỂM TRA ĐĂNG NHẬP + HIỆN FORM ====================
function checkLoginAndShowForm() {
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");
    const userId = localStorage.getItem("user_id");

    const loginPrompt = document.getElementById("loginPrompt");
    const checkoutContent = document.getElementById("checkoutContent");

    if (token && username && userId) {
        // ĐÃ ĐĂNG NHẬP THẬT SỰ
        loginPrompt.style.display = "none";
        checkoutContent.style.display = "block";
        fillUserInfo(userId);
    } else {
        // CHƯA ĐĂNG NHẬP HOẶC THIẾU DỮ LIỆU
        loginPrompt.style.display = "block";
        checkoutContent.style.display = "none";
    }
}

async function fillUserInfo(userId) {
    try {
        const res = await fetch(`http://localhost:3000/api/users/${userId}/info`);
        if (!res.ok) throw new Error("Lỗi lấy thông tin");

        const user = await res.json();

        // ĐẢM BẢO CÁC ELEMENT ĐÃ TỒN TẠI TRƯỚC KHI GÁN
        const setValue = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = value || "";
        };

        setValue("fullname", user.username);
        setValue("email", user.email);
        setValue("phone", user.phone);
        setValue("address_line", user.address_line);
        setValue("city", user.city);
        setValue("district", user.district);

    } catch (err) {
        console.error("Không load được thông tin user:", err);
        alert("Không tải được thông tin cá nhân. Vui lòng nhập thủ công.");
    }
}

// ==================== GỌI KHI LOAD TRANG ====================
document.addEventListener("DOMContentLoaded", () => {
    checkLoginAndShowForm();
    renderCheckout();

    // Đồng bộ khi giỏ thay đổi ở tab khác
    window.addEventListener("storage", (e) => {
        if (e.key === cartKey) renderCheckout();
    });
});

// ==================== ĐẶT HÀNG ====================
document.querySelector("form")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const token = localStorage.getItem("token");
    const userId = localStorage.getItem("user_id");
    if (!token || !userId) {
        alert("Vui lòng đăng nhập lại!");
        window.location.href = "dangnhap.html";
        return;
    }

    const cart = loadCart();
    if (cart.length === 0) {
        alert("Giỏ hàng trống!");
        return;
    }

    // Lấy dữ liệu form
    const formData = {
        user_id: userId,
        customer_name: document.getElementById("fullname").value.trim(),
        email: document.getElementById("email").value.trim(),
        phone: document.getElementById("phone").value.trim(),
        address_line: document.getElementById("address_line").value.trim(),
        city: document.getElementById("city").value.trim(),
        district: document.getElementById("district").value.trim(),
        items: cart,
        payment_method: document.querySelector('input[name="payment"]:checked')?.id || "cod",
        subtotal: cart.reduce((s, i) => s + i.price_promotion * i.quantity, 0),
        discount: calcDiscount(cart.reduce((s, i) => s + i.price_promotion * i.quantity, 0), getCouponFromSession()),
        shippingFee: (cart.reduce((s, i) => s + i.price_promotion * i.quantity, 0) >= FREE_SHIP_THRESHOLD) ? 0 : SHIPPING_FEE_DEFAULT,
        total: 0 // backend sẽ tính lại
    };

    formData.total = formData.subtotal - formData.discount + formData.shippingFee;

    try {
        const res = await fetch("http://localhost:3000/api/orders", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(formData)
        });

        if (!res.ok) throw new Error("Lỗi server");

        alert("Đặt hàng thành công! Cảm ơn quý khách đã ủng hộ shop!");
        localStorage.removeItem(cartKey);
        sessionStorage.removeItem("coupon");
        window.location.href = "index.html";
    } catch (err) {
        console.error(err);
        alert("Đặt hàng thất bại, vui lòng thử lại!");
    }
});