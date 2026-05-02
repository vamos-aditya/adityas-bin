const express = require("express");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const cors = require("cors");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ---------------- STORAGE ----------------
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// ---------------- MULTER ----------------
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

// ---------------- MEMORY DB ----------------
const files = {};

// ---------------- HOME ----------------
app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>TempShare</title>
        <style>
          body {
            margin:0;
            font-family:Arial;
            background:#0f172a;
            color:white;
            display:flex;
            justify-content:center;
            align-items:center;
            height:100vh;
          }
          .box {
            text-align:center;
            padding:30px;
            border:1px solid #333;
            border-radius:12px;
            background:#111827;
          }
          input, button {
            margin-top:10px;
          }
          button {
            padding:10px 20px;
            background:#38bdf8;
            border:none;
            color:white;
            border-radius:8px;
            cursor:pointer;
          }
          a { color:#38bdf8; display:block; margin-top:15px; word-break:break-all; }
        </style>
      </head>
      <body>
        <div class="box">
          <h2>TempShare 🚀</h2>
          <input type="file" id="file" />
          <br/>
          <button onclick="upload()">Upload</button>
          <a id="link"></a>
        </div>

        <script>
          async function upload() {
            const file = document.getElementById("file").files[0];
            if (!file) return alert("Select file");

            const form = new FormData();
            form.append("file", file);

            const res = await fetch("/upload", {
              method: "POST",
              body: form
            });

            const data = await res.json();

            const link = document.getElementById("link");
            link.href = data.link;
            link.innerText = "Share Link: " + data.link;
          }
        </script>
      </body>
    </html>
  `);
});

// ---------------- UPLOAD ----------------
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const id = uuidv4();

  files[id] = {
    path: req.file.path,
    name: req.file.originalname,
    createdAt: Date.now(),
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 min expiry
    downloads: 0
  };

  const baseUrl = `${req.protocol}://${req.get("host")}`;

  res.json({
    id,
    link: `${baseUrl}/file/${id}`
  });
});

// ---------------- FILE VIEW ----------------
app.get("/file/:id", (req, res) => {
  const file = files[req.params.id];

  if (!file) {
    return res.send("<h2 style='color:white;text-align:center;'>File not found or expired</h2>");
  }

  // expiry check
  if (Date.now() > file.expiresAt) {
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    delete files[req.params.id];
    return res.send("<h2 style='color:white;text-align:center;'>File expired</h2>");
  }

  const fileUrl = `/download/${req.params.id}`;
  const ext = path.extname(file.name).toLowerCase();

  let preview = `
    <div style="color:white;text-align:center;">
      <h3>${file.name}</h3>
      <a href="${fileUrl}" style="color:#38bdf8;font-size:18px;">
        ⬇ Download File
      </a>
    </div>
  `;

  if ([".jpg",".jpeg",".png",".gif",".webp"].includes(ext)) {
    preview = `<img src="${fileUrl}" style="max-width:100%;max-height:100%;">`;
  }

  else if ([".mp4",".webm",".mov"].includes(ext)) {
    preview = `
      <video controls style="max-width:100%;max-height:100%;">
        <source src="${fileUrl}">
      </video>
    `;
  }

  else if (ext === ".pdf") {
    preview = `
      <iframe src="${fileUrl}" style="width:100%;height:100%;border:none;"></iframe>
    `;
  }

  res.send(`
    <html>
      <body style="margin:0;background:#0f172a;display:flex;justify-content:center;align-items:center;height:100vh;">
        <div style="width:90%;height:85vh;background:#111827;padding:15px;border-radius:12px;overflow:hidden;">
          ${preview}
        </div>
      </body>
    </html>
  `);
});

// ---------------- DOWNLOAD ----------------
app.get("/download/:id", (req, res) => {
  const file = files[req.params.id];

  if (!file) {
    return res.send("File not found or expired");
  }

  if (Date.now() > file.expiresAt) {
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    delete files[req.params.id];
    return res.send("File expired");
  }

  file.downloads++;

  res.download(file.path, file.name);
});

// ---------------- CLEANUP ----------------
setInterval(() => {
  const now = Date.now();

  for (const id in files) {
    if (files[id].expiresAt < now) {
      if (fs.existsSync(files[id].path)) {
        fs.unlinkSync(files[id].path);
      }
      delete files[id];
    }
  }
}, 60 * 1000);

// ---------------- START ----------------
app.listen(PORT, () => {
  console.log(`TempShare running on http://localhost:${PORT}`);
});
