const Joi = require('joi');

// Skema validasi untuk registrasi user baru
const registerSchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(), // Mengganti 'age' dengan 'password'
});

// Skema validasi untuk login
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

// Skema validasi update user (jika masih diperlukan)
const userUpdateSchema = Joi.object({
  name: Joi.string().min(2).max(50).optional(),
  email: Joi.string().email().optional(),
  age: Joi.number().integer().min(1).max(150).optional(), // 'age' bisa tetap di sini untuk update
  role: Joi.string().valid('admin', 'user', 'moderator').optional()
}).min(1); // Setidaknya satu field harus ada

// Middleware validasi untuk membuat user (sekarang menggunakan registerSchema)
// Kita tetap gunakan nama 'validateUser' agar sesuai dengan 'routes/users.js'
const validateUser = (req, res, next) => {
  const { error } = registerSchema.validate(req.body);
  
  if (error) {
    return res.status(400).json({
      error: 'Validation error',
      message: error.details[0].message,
      details: error.details
    });
  }
  
  next();
};

// Middleware validasi untuk login
const validateLogin = (req, res, next) => {
  const { error } = loginSchema.validate(req.body);

  if (error) {
    return res.status(400).json({
      error: 'Validation error',
      message: error.details[0].message,
      details: error.details
    });
  }

  next();
};

// Middleware validasi untuk update user
const validateUserUpdate = (req, res, next) => {
  const { error } = userUpdateSchema.validate(req.body);
  
  if (error) {
    return res.status(400).json({
      error: 'Validation error',
      message: error.details[0].message,
      details: error.details
    });
  }
  
  next();
};

module.exports = {
  validateUser, 
  validateLogin, // Baru
  validateUserUpdate
};