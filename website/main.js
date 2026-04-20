/* ============== CONFIG ============== */
const API_BASE = 'http://localhost:3000/api';
// const IMG_BASE = 'http://127.0.0.1:5500/website/';
const IMG_BASE = "http://localhost:3000/";

function toImgUrl(apiPath) {
    if (!apiPath) return "placeholder.png"; // nếu không có ảnh
    return IMG_BASE + apiPath; // ghép với server trả về
}



/* ============== HELPERS ============== */
console.log('[DEBUG] main.js boot', location.pathname);

// function toImgUrl(path) {
//   if (!path) return '';
//   if (/^https?:\/\//i.test(path)) return path;
//   let p = String(path).trim().replace(/^[\\/]+/, '').replace(/\\/g, '/');
//   p = p.replace(/^img\//i, 'image/')
//        .replace(/^images\//i, 'image/')
//        .replace(/^public\//i, '');
//   if (!/^image\//i.test(p) && /^(ao|aokieu|vayngan|vaydai|chanvay|setbo)\//i.test(p)) p = 'image/' + p;
//   return IMG_BASE + p;
// }
    function updateUserAccount() {
        const user = localStorage.getItem('username'); // Lấy tên người dùng từ localStorage
        const userAccount = document.getElementById('userAccount');
        if (user) {
            userAccount.innerHTML = `<img src="icon3.jpg" alt=""> Xin chào, ${user} <span style="color: red;"></span>`;
            userAccount.href = '#';
            userAccount.onclick = function (e) {
                e.preventDefault();
                if (confirm('Bạn có muốn đăng xuất?')) {
                    localStorage.removeItem('username');
                    localStorage.removeItem('token'); // Xóa token nếu có
                    window.location.href = 'dangnhap.html';
                }
            };
        } else {
            userAccount.innerHTML = `<img src="icon3.jpg" alt=""> Tài khoản`;
            userAccount.href = 'dangnhap.html';
        }
    }

    // Gọi hàm khi trang tải
window.onload = updateUserAccount;
// LƯU TRANG HIỆN TẠI TRƯỚC KHI CHUYỂN QUA ĐĂNG NHẬP
function goToLogin() {
    // Lưu lại URL hiện tại (trừ trang login và register)
    const currentPage = window.location.pathname.split('/').pop();
    const forbidden = ['dangnhap.html', 'dangky.html', 'thanhtoan.html'];
    
    if (!forbidden.includes(currentPage)) {
        localStorage.setItem('redirectAfterLogin', window.location.href);
    } else if (currentPage === 'thanhtoan.html') {
        // Đặc biệt: nếu đang ở thanh toán → bắt buộc quay lại đó
        localStorage.setItem('redirectAfterLogin', window.location.href);
    }

    window.location.href = 'dangnhap.html';
}

function goToThanhToan() {
    if (cart.length === 0) {
        alert("Giỏ hàng trống!");
    } else{
        window.location.href = 'thanhtoan.html';
    }
}
function getQueryParam(k) { return new URLSearchParams(location.search).get(k); }
function setText(id, t)   { const el = document.getElementById(id); if (el) el.textContent = t; }
function money(v)         { return Number(v || 0).toLocaleString('vi-VN'); }
function slugify(s) {
  return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,'-');
}
/* ============== MENU COLLECTIONS ============== */
async function loadCollections() {
  try {
    const r = await fetch(`${API_BASE}/collections`);
    const cols = await r.json();
    const dd = document.querySelector('.dropdown-content');
    if (!dd) return;
    dd.innerHTML = '';
    cols.forEach(c => {
      const a = document.createElement('a');
      a.href = `collections.html?collection=${encodeURIComponent(c.collection_id)}`;
      a.textContent = c.collection_name;
      dd.appendChild(a);
    });
  } catch (e) {
    console.error('collections error', e);
  }
}

/* ============== RENDER ============== */
function updateProductGrid(id, items) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!Array.isArray(items) || items.length === 0) {
    el.innerHTML = '<p>Không có sản phẩm.</p>';
    return;
  }
  el.innerHTML = items.map(p => `
    <div class="product-card" onclick="viewProductDetail('${encodeURIComponent(JSON.stringify(p))}')">
      <div class="product-thumb">
        <img loading="lazy" src="${toImgUrl(p.image_url)}" alt="${p.product_name}"
             onerror="this.onerror=null;this.src='${IMG_BASE}image/placeholder.png'">
      </div>
      <h3 class="product-name">${p.product_name}</h3>
      <p class="price">${
        Number(p.price) === Number(p.price_promotion)
          ? `<span class="price-promotion">${money(p.price)}đ</span>`
          : `<span class="price-promotion">${money(p.price_promotion)}đ</span>
             <span class="price-original">${money(p.price)}đ</span>`
      }</p>
    </div>
  `).join('');
}

/* ============== EVENTS / NAV ============== */
function viewProductDetail(s) { location.href = `xemchitietsp.html?product=${s}`; }
function filterProducts(name) { location.href = `category.html?category=${slugify(name)}`; }
function sortProducts(type)   {
  const u = new URL(location.href);
  if (type && type !== 'all') u.searchParams.set('sort', type);
  else u.searchParams.delete('sort');
  location.href = u.toString();
}
window.filterProducts = filterProducts;
window.sortProducts   = sortProducts;

/* ============== LOAD BY PAGE ============== */
async function loadProducts() {
  try {
    const path = location.pathname;
    // Xác định trang index cả khi mở /website/ (không có index.html)
    const isIndex = /\/(index\.html)?$/.test(path) || /\/website\/?$/.test(path);

  // ----- CATEGORY -----
// Luôn lọc ở client để không phụ thuộc BE
if (/\/category\.html$/i.test((location.pathname || '').toLowerCase())) {
  const cat  = getQueryParam('category') || '';
  const sort = getQueryParam('sort');

  // Quy tắc lọc theo THƯ MỤC ẢNH + TỪ KHÓA BỎ DẤU
  const RULES = {
    'vay-ngan': { dirs: ['vayngan'], keywords: ['vay ngan'] },
    'vay-dai' : { dirs: ['vaydai'] , keywords: ['vay dai']  },
    'chan-vay': { dirs: ['chanvay'], keywords: ['chan vay'] },
    'ao'      : { dirs: ['ao','aokieu'], keywords: ['ao'] },
    'set-bo'  : { dirs: ['setbo'], keywords: ['set', 'set bo'] }
  };
  const rule = RULES[cat] || { dirs: [], keywords: [] };

  // helper bỏ dấu
  const unsign = s => String(s||'')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase();

  // 1) Lấy toàn bộ rồi lọc ở client
  const resp = await fetch(`${API_BASE}/products`);
  const all  = await resp.json();

  const list = all.filter(p => {
    const name = unsign(p.product_name);
    const url  = (p.image_url || '').toLowerCase().replace(/\\/g,'/');
    const hitDir = rule.dirs.some(d => url.includes('/' + d + '/'));
    const hitKw  = rule.keywords.some(k => name.includes(k));
    // nếu không có rule (cat lạ) -> trả tất cả
    return rule.dirs.length || rule.keywords.length ? (hitDir || hitKw) : true;
  });

  // 2) Sắp xếp nếu có ?sort=
  let items = [...list];
  if (sort === 'sale') {
    items.sort((a,b) => Number(a.price_promotion || a.price) - Number(b.price_promotion || b.price));
  } else if (sort === 'new') {
    items.sort((a,b) => Number(b.product_id) - Number(a.product_id));
  } else if (sort === 'hot') {
    items.sort((a,b) => Number(b.sold_count || 0) - Number(a.sold_count || 0));
  }

  // 3) Tiêu đề
  const title = ({
    'vay-ngan':'VÁY NGẮN',
    'vay-dai' :'VÁY DÀI',
    'ao'      :'ÁO',
    'chan-vay':'CHÂN VÁY',
    'set-bo'  :'SET BỘ'
  }[cat]) || (cat||'').replace(/-/g,' ').toUpperCase();

  setText('pageTitle', title);
  setText('categoryTitle', title);
  updateProductGrid('categoryGrid', items);
  return;
}





    // ----- COLLECTION -----
    if (path.includes('collections.html')) {
      const id = getQueryParam('collection');
      const sort = getQueryParam('sort');

      const cRes = await fetch(`${API_BASE}/collections/${id}`);
      const col  = await cRes.json();
      setText('pageTitle', col.collection_name);
      setText('collectionTitle', col.collection_name);

      const url = new URL(`${API_BASE}/products`);
      url.searchParams.set('collection', id || '');
      if (sort && sort !== 'all') url.searchParams.set('sort', sort);

      const r = await fetch(url.toString());
      const list = await r.json();
      updateProductGrid('collectionGrid', list);
      return;
    }

    /* =============== GIẢM GIÁ (spgiamgia.html) =============== */
if (/\/spgiamgia\.html$/i.test((location.pathname || '').toLowerCase())) {
  const sort = getQueryParam('sort'); // nếu bạn có nút Lọc & Sắp xếp

  // 1) lấy toàn bộ rồi lọc sản phẩm có giảm giá
  const r = await fetch(`${API_BASE}/products`);
  const all = await r.json();

  const sale = all.filter(p => {
    const price = Number(p.price);
    const promo = Number(p.price_promotion || p.price);
    return price > 0 && promo < price;        // chỉ giữ sản phẩm đang giảm
  });

  // 2) sắp xếp (tùy chọn)
  let items = [...sale];
  if (sort === 'percent') {
    // theo % giảm giá (cao -> thấp)
    const pct = x => (Number(x.price) - Number(x.price_promotion || x.price)) / Number(x.price || 1);
    items.sort((a, b) => pct(b) - pct(a));
  } else if (sort === 'low') {
    // giá khuyến mãi thấp -> cao
    items.sort((a, b) => Number(a.price_promotion || a.price) - Number(b.price_promotion || b.price));
  } else if (sort === 'new') {
    // hàng mới (tạm theo id)
    items.sort((a, b) => Number(b.product_id) - Number(a.product_id));
  } else {
    // mặc định: ưu tiên mức giảm tuyệt đối (cao -> thấp), rồi theo sold_count
    const disc = x => Math.max(0, Number(x.price) - Number(x.price_promotion || x.price));
    items.sort((a, b) => (disc(b) - disc(a)) || (Number(b.sold_count || 0) - Number(a.sold_count || 0)));
  }

  // 3) render
  // (nếu có <h1 id="pageTitle"> thì bạn có thể set luôn)
  setText && setText('pageTitle', 'SIÊU GIẢM GIÁ');
  updateProductGrid('saleGrid', items);
  return;
}





    // ----- INDEX -----
    if (isIndex) {
      const r = await fetch(`${API_BASE}/products`);
      const products = await r.json();

      // Best seller: lấy 8 item có mức giảm cao nhất (không kiểm tra ảnh để render ngay)
      const withDiscount = products
        .map(p => ({ ...p, _discount: Number(p.price) - Number(p.price_promotion || p.price) }))
        .sort((a,b) => b._discount - a._discount);
      updateProductGrid('bestSellerGrid', withDiscount.slice(0, 8));

      // Các lưới khác theo thư mục ảnh
      const inDirs = (p, dirs) => (p.image_url||'').toLowerCase().replace(/\\/g,'/')
        && dirs.some(d => (p.image_url||'').toLowerCase().includes('/'+d+'/'));  
      updateProductGrid('vayNganGrid', products.filter(p => inDirs(p, ['vayngan'])));
      updateProductGrid('chanVayGrid', products.filter(p => inDirs(p, ['chanvay'])));
      updateProductGrid('vayDaiGrid',  products.filter(p => inDirs(p, ['vaydai'])));
      updateProductGrid('setBoGrid',   products.filter(p => inDirs(p, ['setbo'])));
      updateProductGrid('aoGrid',      products.filter(p => inDirs(p, ['ao','aokieu'])));
      return;
    }

  } catch (e) {
    console.error('loadProducts error', e);
    const slot = document.getElementById('bestSellerGrid')
      || document.getElementById('categoryGrid')
      || document.getElementById('collectionGrid');
    if (slot) slot.innerHTML = '<p>Lỗi tải sản phẩm. Vui lòng thử lại.</p>';
  }
}

/* ============== BOOT ============== */
document.addEventListener('DOMContentLoaded', () => {
  loadCollections();
  loadProducts();
});


function pickBestSellers(all, limit = 8) {
  return (all || [])
    .map(p => ({
      ...p,
      _disc: Math.max(0, Number(p.price) - Number(p.price_promotion || p.price)),
      _sold: Number(p.sold_count || 0)
    }))
    .sort((a, b) => (b._disc - a._disc) || (b._sold - a._sold))
    .slice(0, limit);
}
