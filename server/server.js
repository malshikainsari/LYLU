const express = require("express");
const session = require("express-session");
const passport = require("passport");
const cors = require("cors");
const mongoose = require("mongoose");
const MongoStore = require("connect-mongo"); // Add for session storage

require("./config/passport");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const listingRoutes = require("./routes/listingRoutes");
const sendMailRouter = require("./routes/sendMailRouter");

const cloudinary = require("cloudinary").v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// MongoDB connection with improved error handling
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log("MongoDB connected successfully"))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

const app = express();

// Trust proxies (essential for Railway/Vercel)
app.set('trust proxy', 1);

// Enhanced CORS configuration
const allowedOrigins = [
  "https://lylu-rho.vercel.app",
  "https://lylu-production.up.railway.app",
  "https://www.lylu-rho.vercel.app" // Add www variant if needed
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`Blocked by CORS: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['set-cookie']
}));

// Handle preflight requests globally
app.options('*', cors());

// Body parser with security considerations
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ 
  limit: "50mb", 
  extended: true,
  parameterLimit: 100000 // For large payloads
}));

// Production-grade session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || "fallback_secret_change_in_production",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      ttl: 24 * 60 * 60, // 1 day in seconds
      autoRemove: 'interval',
      autoRemoveInterval: 60 // Minutes
    }),
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      domain: process.env.NODE_ENV === 'production' ? '.lylu-rho.vercel.app' : undefined,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      path: '/'
    }
  })
);

// Initialize passport after session
app.use(passport.initialize());
app.use(passport.session());

// Rate limiting for auth routes (recommended)
const rateLimit = require("express-rate-limit");
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use("/auth", authLimiter);

// Routes
app.use(authRoutes);
app.use(userRoutes);
app.use(listingRoutes);
app.use("/api/send-email", sendMailRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});