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

/* ✅ ensure uploads folder ALWAYS exists */
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

/* storage setup */
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

/* in-memory storage */
const files = {};

/* serve frontend */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

/* upload route */
app.post("/upload", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const id = uuidv4();

    files[id] = {
      path: req.file.path,
      name: req.file.originalname,
      expiresAt: Date.now() + 10 * 60 * 1000
    };

    /* ✅ IMPORTANT FIX: no localhost */
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    res.json({
      link: `${baseUrl}/file/${id}`
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload failed" });
  }
});

/* download + delete */
app.get("/file/:id", (req, res) => {
  const file = files[req.params.id];

  if (!file) {
    return res.status(404).send("File not found or deleted");
  }

  if (Date.now() > file.expiresAt) {
    fs.unlink(file.path, () => {});
    delete files[req.params.id];
    return res.status(410).send("File expired");
  }

  res.download(file.path, file.name, (err) => {
    if (!err) {
      fs.unlink(file.path, () => {});
      delete files[req.params.id];
    }
  });
});

/* cleanup */
setInterval(() => {
  const now = Date.now();

  for (let id in files) {
    if (files[id].expiresAt < now) {
      fs.unlink(files[id].path, () => {});
      delete files[id];
      console.log("Deleted expired file:", id);
    }
  }
}, 60 * 1000);

/* start server */
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
