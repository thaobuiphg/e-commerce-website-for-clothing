let cart = [];
let currentUser = null;

function getCurrentUser() {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}

async function loadCart() {
  currentUser = getCurrentUser();

  if (currentUser) {
    try {
      const res = await fetch(`http://localhost:3000/api/cart?user_id=${currentUser.user_id}`);
      if (res.ok) cart = await res.json();
    } catch (err) {
      console.error('Lỗi load giỏ:', err);
    }
  } else {
    const local = localStorage.getItem('cart');
    if (local) cart = JSON.parse(local);
  }

  renderCart();
}

function renderCart() {
  const container = document.getElementById('cartContent');
  const totalEl = document.getElementById('sum');

  if (cart.length === 0) {
    container.innerHTML = '<p class="text-center text-muted py-5">Giỏ hàng trống</p>';
    totalEl.textContent = '0đ';
    return;
  }

  container.innerHTML = cart.map(item => `
    <div class="cart-item d-flex align-items-center py-3 border-bottom">
      <img src="http://localhost:3000/${item.image_url}" 
           alt="${item.product_name}"
           class="me-3"
           style="width: 70px; height: 70px; object-fit: cover; border-radius: 8px;"
           onerror="this.src='https://via.placeholder.com/70?text=No+Image'">
      
      <div class="flex-grow-1">
        <h6 class="mb-1 fw-bold">${item.product_name}</h6>
        <p class="mb-1 text-danger fw-bold">
          ${Number(item.price_promotion).toLocaleString('vi-VN')}đ × ${item.quantity}
        </p>
        <small class="text-muted">Size: <strong>${item.size || 'M'}</strong></small>
      </div>

      <button class="btn btn-sm btn-outline-danger ms-3"
              onclick="removeFromCart(${item.product_id}, '${item.size || 'M'}')">
        ×
      </button>
    </div>
  `).join('');

  const total = cart.reduce((sum, item) => sum + item.price_promotion * item.quantity, 0);
  totalEl.textContent = total.toLocaleString('vi-VN') + 'đ';
}

async function removeFromCart(productId, size = 'M') {
  if (currentUser) {
    await fetch('http://localhost:3000/api/cart', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: currentUser.user_id, product_id: productId, size })
    });
  } else {
    cart = cart.filter(i => !(i.product_id == productId && (i.size || 'M') === size));
    localStorage.setItem('cart', JSON.stringify(cart));
  }
  loadCart();
}

async function addToCart(product) {
  const sizeEl = document.querySelector('input[name="size"]:checked');
  const size = sizeEl ? sizeEl.value : 'M';
  const qty = parseInt(document.getElementById('qtyInput')?.value) || 1;

  if (currentUser) {
    await fetch('http://localhost:3000/api/cart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        user_id: currentUser.user_id,
        product_id: product.product_id,
        quantity: qty,
        size: size  // chắc chắn có gửi size
    })
    });
  } else {
    const existingIndex = cart.findIndex(i => i.product_id == product.product_id && (i.size || 'M') === size);
    if (existingIndex > -1) {
      cart[existingIndex].quantity += qty;
    } else {
      cart.push({ ...product, quantity: qty, size });
    }
    localStorage.setItem('cart', JSON.stringify(cart));
  }

  alert('Đã thêm vào giỏ hàng!');
  loadCart();
}

function toggleCart() {
  document.getElementById('cartOverlay').classList.toggle('active');
  loadCart();
}

// Khởi động
window.addEventListener('load', loadCart);

// // Lấy giỏ hàng từ localStorage
// let cart = JSON.parse(localStorage.getItem('cart')) || [];

// // Cập nhật giỏ hàng overlay
// function updateCart() {
//     const cartContent = document.getElementById('cartContent');
//     cartContent.innerHTML = cart.map(item => `
//         <div class="cart-item">
//             <img src="${item.image_url || 'placeholder.jpg'}" alt="${item.product_name}">
//             <div class="item-details">
//                 <p>${item.product_name} - ${Number(item.price_promotion).toLocaleString('vi-VN')}đ</p>
//                 <p>Size: ${item.size || 'M'}, Số lượng: ${item.quantity}</p>
//             </div>
//             <button class="remove-btn" style="float: right;" onclick="removeFromCart(${cart.indexOf(item)}, event)">×</button>
//         </div>
//     `).join('');
//     document.getElementById('sum').textContent = cart.reduce((sum, item) => sum + item.price_promotion * item.quantity, 0).toLocaleString('vi-VN') + 'đ';
// }

// // Xóa sản phẩm khỏi giỏ hàng
// function removeFromCart(index, event) {
//     event.stopPropagation();
//     cart.splice(index, 1);
//     localStorage.setItem('cart', JSON.stringify(cart));
//     updateCart();
// }

// // Toggle giỏ hàng overlay
// function toggleCart() {
//     const overlay = document.getElementById('cartOverlay');
//     overlay.classList.toggle('active');
//     updateCart();
// }

// // Thêm sản phẩm vào giỏ hàng
// function addToCart(product) {
//     const size = document.querySelector('input[name="size"]:checked')?.value;
//     if (!size) {
//         alert('Vui lòng chọn size trước khi thêm vào giỏ!');
//         return;
//     }
//     const quantity = parseInt(document.getElementById('qtyInput').value) || 1;
//     const item = { ...product, quantity, size };
//     cart.push(item);
//     localStorage.setItem('cart', JSON.stringify(cart));
//     alert('Đã thêm vào giỏ hàng!');
//     updateCart();
// }

// // Mua ngay (chuyển đến trang thanh toán)
// function buyNow(product) {
//     const size = document.querySelector('input[name="size"]:checked')?.value;
//     if (!size) {
//         alert('Vui lòng chọn size trước khi mua!');
//         return;
//     }
//     const quantity = parseInt(document.getElementById('qtyInput').value) || 1;
//     const item = { ...product, quantity, size };
//     cart.push(item);
//     localStorage.setItem('cart', JSON.stringify(cart));
//     window.location.href = 'thanhtoan.html';
// }

// // Khởi tạo giỏ hàng khi tải trang
// window.addEventListener('load', updateCart);

