process.env.TZ = 'Asia/Ho_Chi_Minh';

const express = require('express');
const sql = require('mssql');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());
app.use(express.static('public'));

const dbConfig = {
  user: 'sa',
  password: '123456',
  server: 'localhost',
  database: 'myweb',
  options: { encrypt: false, trustServerCertificate: true }
};

let pool;
async function connectDB() {
  try {
    pool = await sql.connect(dbConfig);
    console.log('Connected to DB');
  } catch (err) {
    console.error('DB Connection Failed', err);
  }
}
connectDB();

async function getPool() {
  if (!pool || !pool.connected) {
    pool = await sql.connect(dbConfig);
    console.log('Reconnected to DB');
  }
  return pool;
}

app.use(async (req, res, next) => {
  if (res.headersSent) {
    return next();
  }
  try {
    req.pool = await getPool();
    next();
  } catch (err) {
    console.error('DB Connection Failed:', err);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Lỗi kết nối cơ sở dữ liệu' });
    }
  }
});
// --------------------- helper: ensure dirs ---------------------
const UPLOAD_ROOT = path.join(__dirname, 'public', 'uploads');
const PRODUCTS_DIR = path.join(UPLOAD_ROOT, 'products');
const COLLECTIONS_DIR = path.join(UPLOAD_ROOT, 'collections');

function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log('Tạo folder:', dir);
  }
}
ensureDirSync(PRODUCTS_DIR);
ensureDirSync(COLLECTIONS_DIR);

// --------------------- auth helper ---------------------
async function checkLogin(username, password) {
  const p = pool || await getPool();
  const result = await p.request()
    .input('username', sql.NVarChar, username)
    .query('SELECT * FROM Users WHERE username = @username');
  const user = result.recordset[0];
  if (!user) return { error: 'Tên đăng nhập không tồn tại' };

  let passwordMatch = false;
  if (typeof user.password === 'string' && user.password.startsWith && user.password.startsWith('$2b$')) {
    passwordMatch = await bcrypt.compare(password, user.password);
  } else {
    passwordMatch = user.password === password;
  }
  if (!passwordMatch) return { error: 'Mật khẩu không đúng' };
  return { user };
}

// --------------------- AUTH endpoints ---------------------
app.post('/api/auth/admin-login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const { user, error } = await checkLogin(username, password);
    if (error) return res.status(401).json({ message: error });
    if (user.role !== 1) return res.status(403).json({ message: 'Bạn không có quyền đăng nhập admin' });
    res.json({ message: 'Đăng nhập admin thành công', username: user.username });
  } catch (err) {
    console.error('Login admin error:', err);
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
});

app.post('/api/auth/user-login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const { user, error } = await checkLogin(username, password);
    if (error) return res.status(401).json({ message: error });
    if (user.role === 1) return res.status(403).json({ message: 'Bạn không có quyền đăng nhập user' });
    res.json({
      message: 'Đăng nhập user thành công',
      username: user.username,
      user_id: user.user_id,
      token: 'your-jwt-token',
      redirectUrl: '/index.html'
    });
  } catch (err) {
    console.error('Login user error:', err);
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
});

// --------------------- USERS ---------------------
app.get('/api/users', async (req, res) => {
  try {
    const result = await req.pool.request().query('SELECT user_id, username, email, role FROM Users');
    res.json(result.recordset);
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ message: 'Lỗi khi lấy danh sách người dùng', error: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  const { username, password, email, role } = req.body;
  try {
    const checkUsername = await req.pool.request()
      .input('username', sql.NVarChar, username)
      .query('SELECT 1 FROM Users WHERE username = @username');
    if (checkUsername.recordset.length > 0) return res.status(400).json({ message: 'Tên đăng nhập đã tồn tại' });

    const checkEmail = await req.pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT 1 FROM Users WHERE email = @email');
    if (checkEmail.recordset.length > 0) return res.status(400).json({ message: 'Email đã tồn tại' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await req.pool.request()
      .input('username', sql.NVarChar, username)
      .input('password', sql.VarChar, hashedPassword)
      .input('email', sql.NVarChar, email)
      .input('role', sql.Int, role !== undefined ? role : 0)
      .query('INSERT INTO Users (username, password, email, role) OUTPUT INSERTED.user_id VALUES (@username, @password, @email, @role)');
    res.status(201).json({ id: result.recordset[0].user_id });
  } catch (err) {
    console.error('Insert user error:', err);
    res.status(500).json({ message: 'Lỗi khi tạo người dùng', error: err.message });
  }
});

app.put('/api/users/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { username, password, email, role } = req.body;
  try {
    const request = req.pool.request()
      .input('id', sql.Int, id)
      .input('username', sql.NVarChar, username)
      .input('email', sql.NVarChar, email)
      .input('role', sql.Int, role);
    let query = `UPDATE Users SET username = @username, email = @email, role = @role`;
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += `, password = @password`;
      request.input('password', sql.VarChar, hashedPassword);
    }
    query += ` WHERE user_id = @id`;
    await request.query(query);
    res.sendStatus(200);
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ message: 'Lỗi khi cập nhật người dùng', error: err.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    await req.pool.request().input('id', sql.Int, req.params.id).query('DELETE FROM Users WHERE user_id = @id');
    res.sendStatus(200);
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ message: 'Lỗi khi xóa người dùng', error: err.message });
  }
});

app.get('/api/users/:id/info', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ message: 'Thiếu userId' });
    const result = await req.pool.request()
      .input('user_id', sql.Int, id)
      .query(`
        SELECT U.user_id, U.username, U.email,
               A.address_id, A.address_line, A.city, A.district, A.phone
        FROM Users U
        LEFT JOIN Addresses A ON U.user_id = A.user_id
        WHERE U.user_id = @user_id
      `);
    if (result.recordset.length === 0) return res.status(404).json({ message: 'User không tồn tại' });
    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Get user info error:', err);
    res.status(500).json({ message: 'Lỗi khi lấy thông tin người dùng', error: err.message });
  }
});

// --------------------- ADDRESSES ---------------------
app.post('/api/addresses', async (req, res) => {
  const { user_id, city, district, address_line, phone } = req.body;
  try {
    if (!user_id || !city || !district || !address_line || !phone) {
      return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' });
    }
    await req.pool.request()
      .input('user_id', sql.Int, user_id)
      .input('city', sql.NVarChar, city)
      .input('district', sql.NVarChar, district)
      .input('address_line', sql.NVarChar, address_line)
      .input('phone', sql.NVarChar, phone)
      .query('INSERT INTO Addresses (user_id, city, district, address_line, phone) VALUES (@user_id, @city, @district, @address_line, @phone)');
    res.sendStatus(201);
  } catch (err) {
    console.error('Insert address error:', err);
    res.status(500).json({ message: 'Lỗi khi lưu địa chỉ', error: err.message });
  }
});

app.get('/api/addresses/:user_id', async (req, res) => {
  try {
    const result = await req.pool.request()
      .input('user_id', sql.Int, req.params.user_id)
      .query('SELECT address_id, user_id, city, district, address_line, phone FROM Addresses WHERE user_id = @user_id');
    if (result.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy địa chỉ cho người dùng này' });
    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Get address error:', err);
    res.status(500).json({ message: 'Lỗi khi lấy địa chỉ', error: err.message });
  }
});

// --------------------- PRODUCTS ---------------------
app.get('/api/products', async (req, res) => {
  const { collection, category, sort } = req.query;
  let query = 'SELECT * FROM Products WHERE 1=1';
  const reqQ = req.pool.request();
  if (collection) {
    query += ' AND collection_id = @collection';
    reqQ.input('collection', sql.Int, parseInt(collection));
  }
  if (category) {
    query += ' AND product_name LIKE @category';
    reqQ.input('category', sql.NVarChar, `%${category}%`);
  }
  if (sort) {
    if (sort === 'new') query += ' ORDER BY created_at DESC';
    else if (sort === 'hot') query += ' ORDER BY sold_count DESC';
    else if (sort === 'sale') query += ' ORDER BY price_promotion ASC';
  }
  try {
    const result = await reqQ.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({ message: 'Lỗi khi lấy dữ liệu sản phẩm', error: err.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const { product_name, price, image_url, price_promotion, detail, collection_id, status } = req.body;
    await req.pool.request()
      .input('product_name', sql.NVarChar, product_name)
      .input('price', sql.Decimal(18, 2), price || 0)
      .input('image_url', sql.NVarChar, image_url || '')
      .input('price_promotion', sql.Decimal(18, 2), price_promotion || 0)
      .input('detail', sql.NVarChar(sql.MAX), detail || '')
      .input('collection_id', sql.Int, collection_id || null)
      .input('status', sql.Int, status !== undefined ? status : 1)
      .query('INSERT INTO Products (product_name, price, image_url, price_promotion, detail, collection_id, status) VALUES (@product_name, @price, @image_url, @price_promotion, @detail, @collection_id, @status)');
    res.sendStatus(201);
  } catch (err) {
    console.error('Insert product error:', err);
    res.status(500).json({ message: 'Lỗi khi tạo sản phẩm', error: err.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { product_name, price, image_url, price_promotion, detail, collection_id, status } = req.body;
    await req.pool.request()
      .input('id', sql.Int, id)
      .input('product_name', sql.NVarChar, product_name)
      .input('price', sql.Decimal(18, 2), price || 0)
      .input('image_url', sql.NVarChar, image_url || '')
      .input('price_promotion', sql.Decimal(18, 2), price_promotion || 0)
      .input('detail', sql.NVarChar(sql.MAX), detail || '')
      .input('collection_id', sql.Int, collection_id || null)
      .input('status', sql.Int, status !== undefined ? status : 1)
      .query('UPDATE Products SET product_name = @product_name, price = @price, image_url = @image_url, price_promotion = @price_promotion, detail = @detail, collection_id = @collection_id, status = @status WHERE product_id = @id');
    res.sendStatus(200);
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ message: 'Lỗi khi cập nhật sản phẩm', error: err.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    await req.pool.request().input('id', sql.Int, req.params.id).query('DELETE FROM Products WHERE product_id = @id');
    res.sendStatus(200);
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ message: 'Lỗi khi xóa sản phẩm', error: err.message });
  }
});

// --------------------- COLLECTIONS ---------------------
app.get('/api/collections', async (req, res) => {
  try {
    const result = await req.pool.request().query('SELECT * FROM Collections');
    res.json(result.recordset);
  } catch (err) {
    console.error('Get collections error:', err);
    res.status(500).json({ message: 'Lỗi khi lấy collections', error: err.message });
  }
});

app.get('/api/collections/:id', async (req, res) => {
  try {
    const result = await req.pool.request()
      .input('id', sql.Int, req.params.id)
      .query('SELECT * FROM Collections WHERE collection_id = @id');
    if (result.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy bộ sưu tập' });
    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Get collection error:', err);
    res.status(500).json({ message: 'Lỗi khi lấy thông tin bộ sưu tập', error: err.message });
  }
});

app.post('/api/collections', async (req, res) => {
  try {
    const { collection_name, year_launch, image_url } = req.body;
    await req.pool.request()
      .input('collection_name', sql.NVarChar, collection_name)
      .input('year_launch', sql.NVarChar, year_launch || '')
      .input('image_url', sql.NVarChar, image_url || '')
      .query('INSERT INTO Collections (collection_name, year_launch, image_url) VALUES (@collection_name, @year_launch, @image_url)');
    res.sendStatus(201);
  } catch (err) {
    console.error('Insert collection error:', err);
    res.status(500).json({ message: 'Lỗi khi tạo collection', error: err.message });
  }
});

app.put('/api/collections/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { collection_name, year_launch, image_url } = req.body;
    await req.pool.request()
      .input('id', sql.Int, id)
      .input('collection_name', sql.NVarChar, collection_name)
      .input('year_launch', sql.NVarChar, year_launch || '')
      .input('image_url', sql.NVarChar, image_url || '')
      .query('UPDATE Collections SET collection_name = @collection_name, year_launch = @year_launch, image_url = @image_url WHERE collection_id = @id');
    res.sendStatus(200);
  } catch (err) {
    console.error('Update collection error:', err);
    res.status(500).json({ message: 'Lỗi khi cập nhật collection', error: err.message });
  }
});

app.delete('/api/collections/:id', async (req, res) => {
  try {
    await req.pool.request().input('id', sql.Int, req.params.id).query('DELETE FROM Collections WHERE collection_id = @id');
    res.sendStatus(200);
  } catch (err) {
    console.error('Delete collection error:', err);
    res.status(500).json({ message: 'Lỗi khi xóa collection', error: err.message });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/'),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, unique + '-' + file.originalname);
  }
});
const upload = multer({ storage });

app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file' });
  
  res.json({ 
    image_url: `/uploads/${req.file.filename}` 
  });
});

// --------------------- ORDER ---------------------
app.get('/api/orders', async (req, res) => {
  try {
    const result = await req.pool.request().query('SELECT * FROM Orders ORDER BY order_date DESC');
    const rows = result.recordset.map(r => {
      try {
        r.status_history_parsed = r.status_history ? JSON.parse(r.status_history) : [];
      } catch (e) {
        r.status_history_parsed = [];
      }
      return r;
    });
    res.json(rows);
  } catch (err) {
    console.error('Get orders error:', err);
    res.status(500).json({ message: 'Lỗi khi lấy đơn hàng', error: err.message });
  }
});

app.get('/api/orders/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await req.pool.request().input('id', sql.Int, id).query('SELECT * FROM Orders WHERE order_id = @id');
    if (result.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy order' });
    const order = result.recordset[0];
    try { order.status_history_parsed = order.status_history ? JSON.parse(order.status_history) : []; } catch (e) { order.status_history_parsed = []; }
    res.json(order);
  } catch (err) {
    console.error('Get order by id error:', err);
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    console.log('Bắt đầu tạo order từ user:', req.body.user_id);
    const data = req.body;
    const user_id = data.user_id || 1;
    const total_amount = data.total || data.total_amount || 0;
    const status = data.status || 1; 
    let orderDate = data.order_date ? new Date(data.order_date) : new Date();
    orderDate = new Date(orderDate.getTime()); 

    const historyEntry = { time: orderDate.toISOString(), status: status, note: data.note || 'Khởi tạo đơn' };
    const status_history = JSON.stringify([historyEntry]);

    const result = await req.pool.request()
      .input('user_id', sql.Int, user_id)
      .input('total_amount', sql.Decimal(18, 2), total_amount)
      .input('status', sql.Int, status)
      .input('order_date', sql.DateTime, orderDate)
      .input('status_history', sql.NVarChar(sql.MAX), status_history)
      .query('INSERT INTO Orders (user_id, total_amount, status, order_date, status_history) OUTPUT INSERTED.order_id VALUES (@user_id, @total_amount, @status, @order_date, @status_history)');

    const orderId = result.recordset[0].order_id;

if (Array.isArray(data.items) && data.items.length > 0) {
  const validItems = [];
  for (const item of data.items) {
    try {
      // Kiểm tra product_id có tồn tại không
      const checkProduct = await req.pool.request()
        .input('product_id', sql.Int, item.product_id)
        .query('SELECT 1 FROM Products WHERE product_id = @product_id');
      
      if (checkProduct.recordset.length === 0) {
        console.warn(`Sản phẩm không tồn tại: product_id = ${item.product_id}. Bỏ qua item này.`);
        continue; // bỏ qua item lỗi
      }

      await req.pool.request()
        .input('order_id', sql.Int, orderId)
        .input('product_id', sql.Int, item.product_id)
        .input('quantity', sql.Int, item.quantity || 1)
        .input('unit_price', sql.Decimal(18, 2), item.price_promotion || item.price || 0)
        .input('pay_method', sql.Int, item.pay_method || 0)
        .query('INSERT INTO OrderDetails (order_id, product_id, quantity, unit_price, pay_method) VALUES (@order_id, @product_id, @quantity, @unit_price, @pay_method)');
      
      validItems.push(item);
      console.log(`Insert detail thành công: product_id ${item.product_id}`);
    } catch (detailErr) {
      console.error(`Lỗi insert detail cho product_id ${item.product_id}:`, detailErr.message);
    }
  }

  if (validItems.length === 0 && data.items.length > 0) {
    // có thể xóa order chính nếu không có detail nào thành công
    // await req.pool.request().input('order_id', sql.Int, orderId).query('DELETE FROM Orders WHERE order_id = @order_id');
    // return res.status(400).json({ message: 'Không có sản phẩm hợp lệ trong đơn hàng' });
  }
}
    console.log('Tạo order thành công, orderId:', orderId);
    console.log('Insert details hoàn tất');

    res.status(201).json({ message: 'Đơn hàng đã được lưu thành công', order_id: orderId });
    console.log('Đã gửi response 201 về client');
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ message: 'Lỗi khi lưu đơn hàng', error: err.message });
  }
});

app.put('/api/orders/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { user_id, total_amount, status } = req.body;
    await req.pool.request()
      .input('id', sql.Int, id)
      .input('user_id', sql.Int, user_id)
      .input('total_amount', sql.Decimal(18, 2), total_amount)
      .input('status', sql.Int, status)
      .query('UPDATE Orders SET user_id = @user_id, total_amount = @total_amount, status = @status WHERE order_id = @id');
    res.sendStatus(200);
  } catch (err) {
    console.error('Update order error:', err);
    res.status(500).json({ message: 'Lỗi khi cập nhật đơn hàng', error: err.message });
  }
});

app.delete('/api/orders/:id', async (req, res) => {
  try {
    await req.pool.request().input('id', sql.Int, req.params.id).query('DELETE FROM Orders WHERE order_id = @id');
    res.sendStatus(200);
  } catch (err) {
    console.error('Delete order error:', err);
    res.status(500).json({ message: 'Lỗi khi xóa đơn hàng', error: err.message });
  }
});

// --------------------- ORDER DETAILS ---------------------
app.get('/api/orderdetails/:order_id', async (req, res) => {
  try {
    const result = await req.pool.request()
      .input('order_id', sql.Int, req.params.order_id)
      .query('SELECT * FROM OrderDetails WHERE order_id = @order_id');
    res.json(result.recordset);
  } catch (err) {
    console.error('Get orderdetails error:', err);
    res.status(500).json({ message: 'Lỗi khi lấy order details', error: err.message });
  }
});

app.post('/api/orderdetails', async (req, res) => {
  try {
    const { order_id, product_id, quantity, unit_price, pay_method } = req.body;
    await req.pool.request()
      .input('order_id', sql.Int, order_id)
      .input('product_id', sql.Int, product_id)
      .input('quantity', sql.Int, quantity)
      .input('unit_price', sql.Decimal(18, 2), unit_price)
      .input('pay_method', sql.Int, pay_method)
      .query('INSERT INTO OrderDetails (order_id, product_id, quantity, unit_price, pay_method) VALUES (@order_id, @product_id, @quantity, @unit_price, @pay_method)');
    res.sendStatus(201);
  } catch (err) {
    console.error('Insert orderdetail error:', err);
    res.status(500).json({ message: 'Lỗi khi thêm order detail', error: err.message });
  }
});

app.put('/api/orderdetails/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { order_id, product_id, quantity, unit_price, pay_method } = req.body;
    await req.pool.request()
      .input('id', sql.Int, id)
      .input('order_id', sql.Int, order_id)
      .input('product_id', sql.Int, product_id)
      .input('quantity', sql.Int, quantity)
      .input('unit_price', sql.Decimal(18, 2), unit_price)
      .input('pay_method', sql.Int, pay_method)
      .query('UPDATE OrderDetails SET order_id = @order_id, product_id = @product_id, quantity = @quantity, unit_price = @unit_price, pay_method = @pay_method WHERE order_detail_id = @id');
    res.sendStatus(200);
  } catch (err) {
    console.error('Update orderdetail error:', err);
    res.status(500).json({ message: 'Lỗi khi cập nhật order detail', error: err.message });
  }
});

app.delete('/api/orderdetails/:id', async (req, res) => {
  try {
    await req.pool.request().input('id', sql.Int, req.params.id).query('DELETE FROM OrderDetails WHERE order_detail_id = @id');
    res.sendStatus(200);
  } catch (err) {
    console.error('Delete orderdetail error:', err);
    res.status(500).json({ message: 'Lỗi khi xóa order detail', error: err.message });
  }
});

app.get('/api/orders/:id/statuses', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await req.pool.request().input('id', sql.Int, id).query('SELECT status_history FROM Orders WHERE order_id = @id');
    if (result.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    const raw = result.recordset[0].status_history;
    let arr = [];
    if (raw) {
      try { arr = JSON.parse(raw); } catch (e) { arr = []; }
    }
    res.json(arr);
  } catch (err) {
    console.error('Get order statuses error:', err);
    res.status(500).json({ message: 'Lỗi khi lấy lịch sử trạng thái', error: err.message });
  }
});

// POST /api/orders/:id/status  -> body: { status: 1|2|3|4, note: '...' }
app.post('/api/orders/:id/status', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const newStatus = parseInt(req.body.status, 10);
    const note = req.body.note || null;
    if (!id || ![1,2,3,4].includes(newStatus)) return res.status(400).json({ message: 'Order id hoặc status không hợp lệ' });

    // Lấy status_history hiện tại
    const select = await req.pool.request().input('id', sql.Int, id).query('SELECT status_history FROM Orders WHERE order_id = @id');
    if (select.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    let history = [];
    const raw = select.recordset[0].status_history;
    if (raw) {
      try { history = JSON.parse(raw); } catch (e) { history = []; }
    }

    // Thêm entry mới với thời gian hiện tại
    const now = new Date();
    const entry = { time: now.toISOString(), status: newStatus, note };
    history.push(entry);

    // Update Orders.status và status_history
    await req.pool.request()
      .input('id', sql.Int, id)
      .input('status', sql.Int, newStatus)
      .input('status_history', sql.NVarChar(sql.MAX), JSON.stringify(history))
      .query('UPDATE Orders SET status = @status, status_history = @status_history WHERE order_id = @id');

    res.status(201).json({ message: 'Cập nhật trạng thái thành công', entry });
  } catch (err) {
    console.error('Post order status error:', err);
    res.status(500).json({ message: 'Lỗi khi cập nhật trạng thái đơn hàng', error: err.message });
  }
});

// --------------------- STATS ---------------------
app.get('/api/stats/revenue/day', async (req, res) => {
  const { pay_method } = req.query;
  let query = `
    SELECT CONVERT(VARCHAR(10), DATEADD(HOUR, 7, o.order_date), 120) AS date, SUM(od.quantity * od.unit_price) AS revenue
    FROM Orders o
    LEFT JOIN OrderDetails od ON o.order_id = od.order_id
  `;
  if (pay_method) query += ` WHERE od.pay_method = @pay_method`;
  query += ` GROUP BY CONVERT(VARCHAR(10), DATEADD(HOUR, 7, o.order_date), 120)`;
  try {
    const reqQ = req.pool.request();
    if (pay_method) reqQ.input('pay_method', sql.Int, parseInt(pay_method, 10));
    const result = await reqQ.query(query);
    const data = result.recordset.reduce((acc, row) => ({ ...acc, [row.date]: row.revenue || 0 }), {});
    res.json(data);
  } catch (err) {
    console.error('Revenue day error:', err);
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
});

app.get('/api/stats/revenue/month', async (req, res) => {
  const { pay_method } = req.query;
  let query = `
    SELECT CONVERT(VARCHAR(7), o.order_date, 120) AS month, SUM(od.quantity * od.unit_price) AS revenue
    FROM Orders o
    JOIN OrderDetails od ON o.order_id = od.order_id
  `;
  if (pay_method) query += ` WHERE od.pay_method = @pay_method`;
  query += ` GROUP BY CONVERT(VARCHAR(7), o.order_date, 120)`;
  try {
    const reqQ = req.pool.request();
    if (pay_method) reqQ.input('pay_method', sql.Int, parseInt(pay_method, 10));
    const result = await reqQ.query(query);
    const data = result.recordset.reduce((acc, row) => ({ ...acc, [row.month]: row.revenue || 0 }), {});
    res.json(data);
  } catch (err) {
    console.error('Revenue month error:', err);
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
});

app.get('/api/stats/ordercount/day', async (req, res) => {
  const { pay_method } = req.query;
  let query = `
    SELECT CONVERT(VARCHAR(10), DATEADD(HOUR, 7, o.order_date), 120) AS date, COUNT(DISTINCT o.order_id) AS order_count
    FROM Orders o
    LEFT JOIN OrderDetails od ON o.order_id = od.order_id
  `;
  if (pay_method) query += ` WHERE od.pay_method = @pay_method`;
  query += ` GROUP BY CONVERT(VARCHAR(10), DATEADD(HOUR, 7, o.order_date), 120)`;
  try {
    const reqQ = req.pool.request();
    if (pay_method) reqQ.input('pay_method', sql.Int, parseInt(pay_method, 10));
    const result = await reqQ.query(query);
    const data = result.recordset.reduce((acc, row) => ({ ...acc, [row.date]: row.order_count || 0 }), {});
    res.json(data);
  } catch (err) {
    console.error('Order count day error:', err);
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
});

app.get('/api/stats/total', async (req, res) => {
  const { pay_method } = req.query;
  try {
    let ordersQuery = 'SELECT COUNT(*) AS total_orders FROM Orders';
    let revenueQuery = 'SELECT SUM(od.quantity * od.unit_price) AS total_revenue FROM Orders o JOIN OrderDetails od ON o.order_id = od.order_id';
    if (pay_method) {
      ordersQuery += ` WHERE EXISTS (SELECT 1 FROM OrderDetails od WHERE od.order_id = Orders.order_id AND od.pay_method = @pay_method)`;
      revenueQuery += ` WHERE od.pay_method = @pay_method`;
    }
    const reqQ1 = req.pool.request(); if (pay_method) reqQ1.input('pay_method', sql.Int, parseInt(pay_method, 10));
    const orders = await reqQ1.query(ordersQuery);
    const reqQ2 = req.pool.request(); if (pay_method) reqQ2.input('pay_method', sql.Int, parseInt(pay_method, 10));
    const revenue = await reqQ2.query(revenueQuery);
    res.json({
      total_orders: orders.recordset[0].total_orders,
      total_revenue: revenue.recordset[0].total_revenue || 0
    });
  } catch (err) {
    console.error('Stats total error:', err);
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
});

app.get('/api/stats/ordercount/month', async (req, res) => {
  const { pay_method } = req.query;
  let query = `
    SELECT CONVERT(VARCHAR(7), o.order_date, 120) AS month, COUNT(DISTINCT o.order_id) AS order_count
    FROM Orders o
    JOIN OrderDetails od ON o.order_id = od.order_id
  `;
  if (pay_method) query += ` WHERE od.pay_method = @pay_method`;
  query += ` GROUP BY CONVERT(VARCHAR(7), o.order_date, 120)`;
  try {
    const reqQ = req.pool.request();
    if (pay_method) reqQ.input('pay_method', sql.Int, parseInt(pay_method, 10));
    const result = await reqQ.query(query);
    const data = result.recordset.reduce((acc, row) => ({ ...acc, [row.month]: row.order_count || 0 }), {});
    res.json(data);
  } catch (err) {
    console.error('Order count month error:', err);
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
});

// --------------------- CART ---------------------
app.get('/api/cart', async (req, res) => {
  const userId = req.query.user_id || req.headers['user-id'];
  if (!userId) return res.status(401).json({ message: 'Chưa đăng nhập' });

  try {
    const result = await req.pool.request()
      .input('user_id', sql.Int, userId)
      .query(`
        SELECT 
          ci.cart_item_id,
          ci.product_id,
          ci.quantity,
          ISNULL(ci.size, 'M') as size,
          p.product_name,
          p.price_promotion,
          p.image_url
        FROM Cart c
        JOIN CartItems ci ON c.cart_id = ci.cart_id
        JOIN Products p ON ci.product_id = p.product_id
        WHERE c.user_id = @user_id
        ORDER BY ci.cart_item_id DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi lấy giỏ hàng' });
  }
});

app.post('/api/cart', async (req, res) => {
  let { user_id, product_id, quantity = 1, size } = req.body;
  if (!user_id || !product_id) {
    return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' });
  }

  if (!size || size === '' || size === null || size === undefined) {
    size = 'M';
  }

  try {
    const pool = await getPool();

    // 1. Lấy hoặc tạo giỏ chính của user
    let cartRes = await pool.request()
      .input('user_id', sql.Int, user_id)
      .query('SELECT cart_id FROM Cart WHERE user_id = @user_id');

    let cartId;
    if (cartRes.recordset.length === 0) {
      const insert = await pool.request()
        .input('user_id', sql.Int, user_id)
        .query('INSERT INTO Cart (user_id) OUTPUT INSERTED.cart_id VALUES (@user_id)');
      cartId = insert.recordset[0].cart_id;
    } else {
      cartId = cartRes.recordset[0].cart_id;
    }

    // 2. Kiểm tra đã có product + size trong giỏ chưa
    const exist = await pool.request()
      .input('cart_id', sql.Int, cartId)
      .input('product_id', sql.Int, product_id)
      .input('size', sql.NVarChar, size)
      .query(`
        SELECT cart_item_id, quantity 
        FROM CartItems 
        WHERE cart_id = @cart_id 
          AND product_id = @product_id 
          AND (size = @size OR (size IS NULL AND @size = 'M'))
      `);

    if (exist.recordset.length > 0) {
      // Cộng dồn số lượng
      await pool.request()
        .input('id', sql.Int, exist.recordset[0].cart_item_id)
        .input('qty', sql.Int, quantity)
        .query('UPDATE CartItems SET quantity = quantity + @qty WHERE cart_item_id = @id');
    } else {
      // Thêm mới
      const sizeToSave = (size === 'M') ? null : size; // M lưu null cho gọn
      await pool.request()
        .input('cart_id', sql.Int, cartId)
        .input('product_id', sql.Int, product_id)
        .input('quantity', sql.Int, quantity)
        .input('size', sql.NVarChar, sizeToSave)
        .query('INSERT INTO CartItems (cart_id, product_id, quantity, size) VALUES (@cart_id, @product_id, @quantity, @size)');
    }

    res.json({ success: true });

  } catch (err) {
    console.error('LỖI THÊM VÀO GIỎ HÀNG:', err);
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
});

app.delete('/api/cart', async (req, res) => {
  const { user_id, product_id, size = 'M' } = req.body;

  try {
    await req.pool.request()
      .input('user_id', sql.Int, user_id)
      .input('product_id', sql.Int, product_id)
      .input('size', sql.NVarChar, size)
      .query(`
        DELETE ci FROM CartItems ci
        JOIN Cart c ON ci.cart_id = c.cart_id
        WHERE c.user_id = @user_id 
          AND ci.product_id = @product_id 
          AND (ci.size = @size OR (ci.size IS NULL AND @size = 'M'))
      `);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi xóa' });
  }
});

// --------------------- START SERVER ---------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
