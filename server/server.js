require('dotenv').config();
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const cors = require("cors");
const mongoose = require("mongoose");

// Passport
require("./config/passport");

// Route imports
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const listingRoutes = require("./routes/listingRoutes");
const sendMailRouter = require("./routes/sendMailRouter");

// Cloudinary configuration
const cloudinary = require("cloudinary").v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log("MongoDB connection error:", err));

const app = express();

// Trust proxy (required for Railway)
app.set('trust proxy', 1);

// Enhanced CORS configuration
const allowedOrigins = [
  "https://lylu-rho.vercel.app",
  "https://lylu-rho.vercel.app/", // Include with and without trailing slash
  "https://lylu-production.up.railway.app",
  "http://localhost:3000"
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.some(allowedOrigin => 
      origin === allowedOrigin || 
      origin.startsWith(allowedOrigin.replace(/\/$/, ''))
    )) {
      callback(null, true);
    } else {
      console.log('CORS blocked for origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['set-cookie'],
  maxAge: 86400
}));

// Body parsing middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Cache control for API responses
app.use((req, res, next) => {
  res.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.header('Pragma', 'no-cache');
  res.header('Expires', '0');
  next();
});

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || "fallback_secret_key",
    resave: false,
    saveUninitialized: false,
    proxy: true, // Required for Railway
    cookie: {
      secure: true, // Always true in production
      sameSite: 'none', // Required for cross-site cookies
      domain: process.env.NODE_ENV === "production" ? '.lylu-rho.vercel.app' : undefined,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
      path: '/'
    }
  })
);

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use(authRoutes);
app.use(userRoutes);
app.use(listingRoutes);
app.use("/api/send-email", sendMailRouter);

// Health check endpoint with CORS headers
app.get("/health", (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || allowedOrigins[0]);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.status(200).json({ 
    status: "OK",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  // Handle CORS errors specifically
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS policy violation' });
  }
  
  res.status(500).json({ 
    error: 'Something broke!',
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Server startup
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`);
  console.log(`Allowed CORS origins: ${allowedOrigins.join(', ')}`);
});