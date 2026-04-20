// 🔍 Khi người dùng bấm Enter hoặc nút tìm kiếm
function searchProducts() {
    const query = document.getElementById('searchInput').value.trim();
    if (query) {
        window.location.href = `search.html?query=${encodeURIComponent(query)}`;
    } else {
        alert('Vui lòng nhập từ khóa tìm kiếm');
    }
}

// 📥 Lấy tham số từ URL
function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

// 📦 Hiển thị danh sách sản phẩm
function displaySearchResults(products) {
    const grid = document.getElementById('searchResultsGrid');
    if (!grid) return;

    grid.innerHTML = '';

    if (!products || products.length === 0) {
        grid.innerHTML = '<p>Không tìm thấy sản phẩm nào phù hợp.</p>';
        return;
    }

    grid.innerHTML = products.map(product => `
        <div class="product-card" onclick="viewProductDetail('${encodeURIComponent(JSON.stringify(product))}')">
            <img src="${product.image_url}" alt="${product.product_name}">
            <h3>${product.product_name}</h3>
            <p class="price">
                <span class="price-promotion">${formatCurrency(product.price_promotion)}đ</span>
                <span class="price-original">${formatCurrency(product.price)}đ</span>
            </p>
        </div>
    `).join('');
}

// 💸 Format tiền
function formatCurrency(value) {
    return Number(value).toLocaleString('vi-VN');
}

// 📌 Chuyển sang trang chi tiết
function viewProductDetail(productString) {
    window.location.href = `xemchitietsp.html?product=${productString}`;
}

// 📊 Gọi API tìm kiếm
async function fetchSearchResults(query) {
    try {
        const res = await fetch(`${API_BASE}/products`);
        const products = await res.json();

        const filtered = products.filter(p =>
            p.product_name.toLowerCase().includes(query.toLowerCase())
        );

        displaySearchResults(filtered);
    } catch (err) {
        console.error('Lỗi tải sản phẩm:', err);
        displaySearchResults([]);
    }
}

// ⚙️ Khi trang search.html load
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');

    // Gõ Enter thì tìm
    if (searchInput) {
        searchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                searchProducts();
            }
        });
    }

    // Nếu đang ở search.html và có query
    if (window.location.pathname.includes('search.html')) {
        const query = getQueryParam('query');
        if (query) {
            if (searchInput) searchInput.value = query;
            fetchSearchResults(query);
        }
    }
});
