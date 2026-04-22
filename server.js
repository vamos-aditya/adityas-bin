const express = require("express");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const cors = require("cors");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.static(__dirname));

const PORT = 3000;

// storage setup
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    const uniqueName = uuidv4() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

// in-memory storage
const files = {};

// serve frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// upload route
app.post("/upload", upload.single("file"), (req, res) => {
  const id = uuidv4();

  files[id] = {
    path: req.file.path,
    name: req.file.originalname,
    expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
  };

  res.json({
    link: `http://localhost:${PORT}/file/${id}`
  });
});

// download + delete logic
app.get("/file/:id", (req, res) => {
  const file = files[req.params.id];

  if (!file) {
    return res.status(404).send("File not found or deleted");
  }

  // check expiry
  if (Date.now() > file.expiresAt) {
    fs.unlink(file.path, () => {});
    delete files[req.params.id];
    return res.status(410).send("File expired");
  }

  res.download(file.path, file.name, (err) => {
    if (!err) {
      // delete after download
      fs.unlink(file.path, () => {});
      delete files[req.params.id];
    }
  });
});

// 🔄 background cleanup every 1 min
setInterval(() => {
  const now = Date.now();

  for (let id in files) {
    if (files[id].expiresAt < now) {
      fs.unlink(files[id].path, () => {});
      delete files[id];
      console.log(`Deleted expired file: ${id}`);
    }
  }
}, 60 * 1000);

// start server
app.listen(PORT, () => {
  console.log("Server running on http://localhost:3000");
});
