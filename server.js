const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ---------------- STORAGE ----------------
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// ---------------- STATIC FRONTEND (IMPORTANT FIX) ----------------
app.use(express.static(path.join(__dirname, "public")));

// ---------------- MULTER CONFIG ----------------
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

// ---------------- SIMPLE DB ----------------
const filesDB = {}; 
// id -> { filename, originalName }

// ---------------- HOME ROUTE (FIX "Cannot GET /") ----------------
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ---------------- UPLOAD ----------------
app.post("/upload", upload.single("file"), (req, res) => {
    const id = Date.now().toString();

    filesDB[id] = {
        filename: req.file.filename,
        originalName: req.file.originalname
    };

    res.json({
        success: true,
        id,
        shareLink: `${req.protocol}://${req.get("host")}/file/${id}`
    });
});

// ---------------- SHARE PAGE ----------------
app.get("/file/:id", (req, res) => {
    const file = filesDB[req.params.id];

    if (!file) {
        return res.send("<h2>File not found</h2>");
    }

    res.send(`
        <html>
        <head>
            <title>TempShare</title>
            <style>
                body {
                    font-family: Arial;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    background: #111;
                    color: white;
                    margin: 0;
                }
                .box {
                    text-align: center;
                    padding: 25px;
                    border: 1px solid #333;
                    border-radius: 12px;
                    background: #1c1c1c;
                }
                a {
                    display: inline-block;
                    margin-top: 15px;
                    padding: 10px 20px;
                    background: #00c853;
                    color: white;
                    text-decoration: none;
                    border-radius: 6px;
                }
            </style>
        </head>
        <body>
            <div class="box">
                <h2>${file.originalName}</h2>
                <p>Your file is ready</p>
                <a href="/download/${req.params.id}">Download</a>
            </div>
        </body>
        </html>
    `);
});

// ---------------- DOWNLOAD ----------------
app.get("/download/:id", (req, res) => {
    const file = filesDB[req.params.id];

    if (!file) {
        return res.send("File not found");
    }

    const filePath = path.join(__dirname, "uploads", file.filename);

    res.download(filePath, file.originalName);
});

// ---------------- START SERVER ----------------
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
