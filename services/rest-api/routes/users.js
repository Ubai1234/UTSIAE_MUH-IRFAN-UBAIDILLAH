const express = require('express');
const { v4: uuidv4 } = require('uuid');
// Impor dependensi baru
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
// Impor validator yang baru (validateLogin sekarang ada)
const { validateUser, validateLogin, validateUserUpdate } = require('../middleware/validation');

const router = express.Router();

// In-memory database (menyimpan password yang di-hash)
let users = [
  // Hapus data dummy lama dan biarkan kosong, atau hash password-nya
  // {
  //   id: '1',
  //   name: 'John Doe',
  //   email: 'john@example.com',
  //   password: 'HASHED_PASSWORD_NANTI', 
  //   role: 'admin',
  //   createdAt: new Date().toISOString(),
  //   updatedAt: new Date().toISOString()
  // }
];

// === ENDPOINT BARU: PUBLIC KEY ===
// (api-gateway akan memanggil ini)
router.get('/public-key', (req, res) => {
  res.status(200).send(process.env.JWT_PUBLIC_KEY);
});

// === ENDPOINT BARU: REGISTER ===
// (Frontend memanggil ini: POST /api/users/register)
router.post('/register', validateUser, async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    
    // Cek jika email sudah ada
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      return res.status(409).json({
        error: 'Email already exists',
        message: 'A user with this email already exists'
      });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = {
      id: uuidv4(),
      name,
      email,
      password: hashedPassword, // Simpan password yang di-hash
      role: 'user', // Default role
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    users.push(newUser);
    
    // Jangan kirim password kembali
    const userResponse = { ...newUser };
    delete userResponse.password;

    res.status(201).json({
      message: 'User created successfully',
      user: userResponse
    });
  } catch (err) {
    next(err); // Teruskan error ke errorHandler
  }
});

// === ENDPOINT BARU: LOGIN ===
// (Frontend memanggil ini: POST /api/users/login)
router.post('/login', validateLogin, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Cari user
    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Cek password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Buat JWT
    const payload = {
      sub: user.id, // Subject (user ID)
      email: user.email,
      role: user.role
    };

    const token = jwt.sign(
      payload, 
      process.env.JWT_PRIVATE_KEY, // Ambil private key dari env
      { 
        algorithm: 'RS256', // Harus RS256
        expiresIn: '1h' 
      }
    );

    res.json({
      message: 'Login successful',
      token: token
    });

  } catch (err) {
    next(err); // Teruskan error ke errorHandler
  }
});

// === RUTE ASLI (Masih bisa digunakan) ===

// GET /api/users - Get all users
router.get('/', (req, res) => {
  // Sembunyikan password dari response
  const safeUsers = users.map(u => {
    const userCopy = { ...u };
    delete userCopy.password;
    return userCopy;
  });
  res.json(safeUsers);
});

// GET /api/users/:id - Get user by ID
router.get('/:id', (req, res) => {
  const user = users.find(u => u.id === req.params.id);
  
  if (!user) {
    return res.status(404).json({
      error: 'User not found',
      message: `User with ID ${req.params.id} does not exist`
    });
  }
  
  // Sembunyikan password
  const userCopy = { ...user };
  delete userCopy.password;
  res.json(userCopy);
});

// Hapus rute POST /api/users asli (karena sudah diganti /register)
/*
router.post('/', validateUser, (req, res) => {
  ...
});
*/

// PUT /api/users/:id - Update user
router.put('/:id', validateUserUpdate, (req, res) => {
  // ... (Logika update Anda yang sudah ada bisa tetap di sini)
  res.status(501).json({ message: 'Update not implemented yet' });
});

// DELETE /api/users/:id - Delete user
router.delete('/:id', (req, res) => {
  const userIndex = users.findIndex(u => u.id === req.params.id);
  
  if (userIndex === -1) {
    return res.status(404).json({
      error: 'User not found',
      message: `User with ID ${req.params.id} does not exist`
    });
  }
  
  const deletedUser = users.splice(userIndex, 1)[0];
  
  res.json({
    message: 'User deleted successfully',
    user: deletedUser
  });
});

module.exports = router;