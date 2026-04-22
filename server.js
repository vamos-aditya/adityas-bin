const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");

const app = express();

/* ✅ allow frontend requests */
app.use(cors());

/* ✅ serve uploaded files */
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* ✅ multer storage setup */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

/* ✅ upload endpoint */
app.post("/upload", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    res.json({
      link: `/uploads/${req.file.filename}`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload failed" });
  }
});

/* ✅ basic test route */
app.get("/", (req, res) => {
  res.send("Server is running 🚀");
});

/* ✅ port (Render compatible) */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
