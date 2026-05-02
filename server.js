const express = require("express");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const cors = require("cors");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Public uploads access
app.use("/uploads", express.static(uploadDir));

// Multer storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = uuidv4() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

// In-memory file storage
const files = {};

// Homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Upload route
app.post("/upload", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const id = uuidv4();

    files[id] = {
      path: req.file.path,
      name: req.file.originalname,
      expiresAt: Date.now() + 10 * 60 * 1000,
      viewed: false
    };

    const baseUrl = `${req.protocol}://${req.get("host")}`;

    res.json({
      link: `${baseUrl}/file/${id}`
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload failed" });
  }
});

// File viewer route
app.get("/file/:id", (req, res) => {
  const id = req.params.id;
  const file = files[id];

  // Redirect if invalid, deleted, or already viewed
  if (!file || file.viewed) {
    return res.redirect("/");
  }

  // Expired file
  if (Date.now() > file.expiresAt) {
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    delete files[id];
    return res.redirect("/");
  }

  // Mark as viewed instantly
  file.viewed = true;

  const ext = path.extname(file.name || "").toLowerCase();
  const fileUrl = `/uploads/${path.basename(file.path)}`;

  let previewContent = `
    <p style="color:white; text-align:center;">
      Preview not available for this file type.<br><br>
      <a href="${fileUrl}" download style="color:#38bdf8; font-size:18px;">
        ⬇ Download File
      </a>
    </p>
  `;

  // PDF
  if ([".pdf"].includes(ext)) {
    previewContent = `
      <iframe src="${fileUrl}" 
        style="width:100%; height:100%; border:none; border-radius:12px;">
      </iframe>
    `;
  }

  // Images
  else if ([
    ".jpg", ".jpeg", ".png", ".gif",
    ".webp", ".bmp", ".svg", ".avif"
  ].includes(ext)) {
    previewContent = `
      <img src="${fileUrl}" 
        style="width:100%; height:100%; object-fit:contain; border-radius:12px;">
    `;
  }

  // Videos
  else if ([
    ".mp4", ".webm", ".mov",
    ".mkv", ".avi", ".m4v"
  ].includes(ext)) {
    previewContent = `
      <video controls autoplay
        style="width:100%; height:100%; object-fit:contain; border-radius:12px;">
        <source src="${fileUrl}">
      </video>
    `;
  }

  // Audio
  else if ([
    ".mp3", ".wav", ".ogg",
    ".m4a", ".aac", ".flac"
  ].includes(ext)) {
    previewContent = `
      <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; width:100%;">
        <h2>🎵 Audio File</h2>
        <audio controls autoplay style="width:80%;">
          <source src="${fileUrl}">
        </audio>
      </div>
    `;
  }

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>TempShare Viewer</title>
      <style>
        body {
          margin: 0;
          font-family: Arial, sans-serif;
          background: linear-gradient(to bottom right, #0f172a, #111827);
          display: flex;
          justify-content: center;
          align-items: center;
          flex-direction: column;
          height: 100vh;
          color: white;
        }

        .viewer-box {
          width: 90%;
          max-width: 1100px;
          height: 80vh;
          background: rgba(20,20,30,0.92);
          backdrop-filter: blur(12px);
          border-radius: 20px;
          padding: 20px;
          box-shadow: 0 0 40px rgba(0,0,0,0.6);
          display: flex;
          justify-content: center;
          align-items: center;
          overflow: hidden;
        }

        .close-btn {
          margin-top: 18px;
          padding: 12px 24px;
          border: none;
          border-radius: 10px;
          background: #38bdf8;
          color: white;
          font-size: 16px;
          cursor: pointer;
          box-shadow: 0 0 15px #38bdf8;
        }

        .close-btn:hover {
          opacity: 0.9;
        }
      </style>
    </head>
    <body>

      <div class="viewer-box">
        ${previewContent}
      </div>

      <button class="close-btn" onclick="window.location.href='/'">
        ✖ Close File
      </button>

    </body>
    </html>
  `);

  // Delete shortly after first open
  setTimeout(() => {
    if (files[id]) {
      if (fs.existsSync(file.path)) {
        fs.unlink(file.path, () => {});
      }
      delete files[id];
    }
  }, 5000);
});

// Cleanup expired files
setInterval(() => {
  const now = Date.now();

  for (let id in files) {
    if (files[id].expiresAt < now) {
      if (fs.existsSync(files[id].path)) {
        fs.unlink(files[id].path, () => {});
      }
      delete files[id];
    }
  }
}, 60 * 1000);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
