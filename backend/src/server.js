// server.js
const path = require("path");       // <-- LOAD PATH FIRST
require("dotenv").config({
    path: path.join(__dirname, "..", ".env")
});

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const fs = require("fs");
const cors = require("cors");


const app = express();
const compression = require("compression");
app.use(compression());
const server = http.createServer(app);

// SOCKET.IO with CORS (Netlify + Render)
const io = new Server(server, {
    cors: {
        origin: "*",
    },
});

// Port for Render
const port = process.env.PORT || 8800;

// ----------------------------------------------------------
// CORRECT ROOT DIRECTORY
// ----------------------------------------------------------
const ROOT_DIR = path.join(__dirname, "..", "..");
const PUBLIC_PATH = path.join(ROOT_DIR, "public");
let CACHE = null;
let CACHE_TIME = 0;
const CACHE_TTL = 4000; // 4 seconds cache
const DATA_FILE = path.join(ROOT_DIR, "data.json");

// 🔥 REAL-TIME IN-MEMORY CACHE (SUPER FAST)
let RT = {
    info: [],
    members: [],
    images: [],
    schemes: [],
    contact: [],
    arj: []
};



// ----------------------------------------------------------
// MIDDLEWARE
// ----------------------------------------------------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_PATH, { maxAge: "1d" }));

// ----------------------------------------------------------
// STATIC PAGE ROUTES
// ----------------------------------------------------------
const pages = [
    "index",
    "about",
    "contact",
    "dashboard",
    "gallery",
    "members",
    "schemes",
];

pages.forEach((page) => {
    app.get(`/${page === "index" ? "" : page}`, (req, res) => {
        res.sendFile(path.join(PUBLIC_PATH, `${page}.html`));
    });
});

// ----------------------------------------------------------
// DATA FUNCTIONS
// ----------------------------------------------------------
function loadData() {
    const now = Date.now();

    // return cached data (fast)
    if (CACHE && now - CACHE_TIME < CACHE_TTL) {
        return CACHE;
    }

    // read from file (slow)
    if (!fs.existsSync(DATA_FILE)) {
        CACHE = { info: [], members: [], schemes: [], images: [], contact: [], arj: [] };
    } else {
        CACHE = JSON.parse(fs.readFileSync(DATA_FILE));
    }

    CACHE_TIME = now;
    return CACHE;
}

function saveData(data) {
    CACHE = data; // update cache
    CACHE_TIME = Date.now();
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); // write in background
}


// ----------------------------------------------------------
// INFO ROUTES
// ----------------------------------------------------------
app.get("/api/info", (req, res) => {
    res.json({ info: RT.info });
});

app.post("/admin/upload", (req, res) => {
    const { title, description, type } = req.body;

    if (!title || !description) {
        return res.status(400).json({ status: "error", message: "Missing fields" });
    }

    const data = loadData();

    const newInfo = {
        id: Date.now(),
        title,
        description,
        type: type || "General",
    };

    data.info.push(newInfo);
    RT.info = data.info;   // RT UPDATE
    saveData(data);

    io.emit("new-data", { type: "info", info: newInfo });
    io.of("/").adapter.close();
    res.json({ status: "success", info: newInfo });
});

app.delete("/admin/delete/info/:id", (req, res) => {
    const data = loadData();
    data.info = data.info.filter(i => i.id != req.params.id);
    RT.info = data.info;   // RT UPDATE
    saveData(data);

    io.emit("new-data", { type: "info" });
    io.of("/").adapter.close();
    res.json({ status: "success" });
});

// ----------------------------------------------------------
// MEMBERS ROUTES
// ----------------------------------------------------------
app.get("/api/members", (req, res) => {
    res.json({ members: RT.members });
});


app.post("/admin/members", (req, res) => {
    const { name, role, contact } = req.body;

    if (!name || !role || !contact) {
        return res.status(400).json({ status: "error", message: "Missing fields" });
    }

    const data = loadData();

    // 1️⃣ Create member object
    const newMember = {
        id: Date.now(),
        name,
        role,
        contact,
        uploading: false  // for consistency with ARJ & Schemes
    };

    // 2️⃣ Push instantly to data + RT
    data.members.push(newMember);
    RT.members = data.members;
    saveData(data);

    // 3️⃣ Emit instantly (UI updates immediately)
    io.emit("new-data", { type: "members", member: newMember });
    io.of("/").adapter.close();

    // 4️⃣ Send API response instantly
    return res.json({ status: "success", member: newMember });
});


app.delete("/admin/delete/member/:id", (req, res) => {
    const data = loadData();

    // remove member
    data.members = data.members.filter(m => m.id != req.params.id);

    // update RT memory
    RT.members = data.members;

    saveData(data);

    // notify frontend instantly
    io.emit("new-data", { type: "members" });
    io.of("/").adapter.close();

    res.json({ status: "success" });
});


// ----------------------------------------------------------
// GALLERY ROUTES
// ----------------------------------------------------------
const upload = multer({ storage: multer.memoryStorage() });

app.get("/api/gallery", (req, res) => {
    res.json({ images: RT.images });
});

app.post("/admin/gallery", upload.single("image"), (req, res) => {
    if (!req.file) {
        return res
            .status(400)
            .json({ status: "error", message: "No file uploaded" });
    }

    const data = loadData();
    const newImg = {
        id: Date.now(),
        url: `data:${req.file.mimetype};base64,${req.file.buffer.toString(
            "base64"
        )}`,
        alt: "Uploaded Image",
    };

    data.images.push(newImg);
    RT.images = data.images;   // RT UPDATE
    saveData(data);

    io.emit("new-data", { type: "gallery", image: newImg });
    io.of("/").adapter.close();
    res.json({ status: "success", image: newImg });
});

app.delete("/admin/delete/image/:id", (req, res) => {
    const data = loadData();
    data.images = data.images.filter(img => img.id != req.params.id);
    RT.images = data.images;   // RT UPDATE
    saveData(data);

    io.emit("new-data", { type: "gallery" });
    io.of("/").adapter.close();
    res.json({ status: "success" });
});

// ----------------------------------------------------------
// CONTACT MESSAGE ROUTE
// ----------------------------------------------------------
app.post("/api/send-message", (req, res) => {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
        return res.json({ success: false, message: "Missing fields" });
    }

    const data = loadData();

    if (!data.contact) data.contact = [];

    const newMsg = {
        id: Date.now(),
        name,
        email,
        message,
    };

    data.contact.push(newMsg);
    saveData(data);

    io.emit("new-data", { type: "contact", message: newMsg });
    io.of("/").adapter.close();
    res.json({ success: true });
});

// ----------------------------------------------------------
// SEND EMAIL TO USER (BREVO SMTP FIXED FOR RENDER)
// ----------------------------------------------------------
const nodemailer = require("nodemailer");

app.post("/admin/send-email", async (req, res) => {
    const { email, message, name } = req.body;

    if (!email || !message || !name) {
        return res.json({ success: false, error: "Missing fields" });
    }

    try {
        // ⭐ BREVO SMTP CONFIG
        let transporter = nodemailer.createTransport({
            host: "smtp-relay.brevo.com",
            port: 587,
            secure: false,
            auth: {
                user: process.env.BREVO_SMTP_USER,
                pass: process.env.BREVO_SMTP_PASS
            }
        });

        const finalMessage = `
⭐ ग्राम पंचायत हरळ  
नमस्कार, हा ईमेल ग्रामपंचायतीतर्फे पाठविण्यात आला आहे.

📌 प्राप्तकर्ता: ${name}

------------------------------
${message}
------------------------------
        `;

        await transporter.sendMail({
            from: `"ShivTech" <desaishivraj84@gmail.com>`,
            to: email,
            subject: "Gram Panchayat Haral – सूचना",
            text: finalMessage,
        });


        res.json({ success: true });

    } catch (err) {
        console.error("Email error:", err);
        res.json({ success: false, error: err.message });
    }
});
// =======================================================
// ⭐ CLOUDINARY SETUP
// =======================================================
const cloudinary = require("cloudinary").v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

console.log("CLOUDINARY ENV CHECK:", {
    CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    API_KEY: process.env.CLOUDINARY_API_KEY,
    API_SECRET: process.env.CLOUDINARY_API_SECRET ? "LOADED" : "MISSING"
});



// =======================================================
// ⭐ ARJ UPLOAD
// =======================================================
const uploadArj = multer({ storage: multer.memoryStorage() });

// GET all ARJs
app.get("/api/arj", (req, res) => {
    res.json({ arj: RT.arj });
});

// Upload ARJ
app.post("/admin/arj", uploadArj.single("file"), async (req, res) => {
    const { title } = req.body;

    if (!title || !req.file) {
        return res.json({ success: false, message: "Missing fields" });
    }

    try {
        const data = loadData();

        // 1️⃣ Create temporary placeholder
        const tempArj = {
            id: Date.now(),
            title,
            filename: "uploading...",
            url: null,
            uploading: true
        };

        // 2️⃣ Push instantly
        if (!data.arj) data.arj = [];
        data.arj.push(tempArj);
        RT.arj = data.arj;
        saveData(data);

        // 3️⃣ Emit instantly (UI updates in fraction of second)
        io.emit("new-data", { type: "arj", arj: tempArj });
        io.of("/").adapter.close();

        // 4️⃣ Upload to Cloudinary in background
        const uploadResult = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
                {
                    folder: "arj_files",
                    resource_type: "raw"
                },
                (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                }
            ).end(req.file.buffer);
        });

        // 5️⃣ Replace placeholder with actual file
        tempArj.filename = uploadResult.public_id;
        tempArj.url = uploadResult.secure_url;
        tempArj.uploading = false;

        saveData(data);
        RT.arj = data.arj;

        // 6️⃣ Emit final update
        io.emit("new-data", { type: "arj" });
        io.of("/").adapter.close();

        return res.json({ success: true, file: tempArj });

    } catch (err) {
        console.error("ARJ UPLOAD ERROR:", err);
        return res.status(500).json({ success: false, message: "Cloudinary upload failed" });
    }
});


// Delete ARJ
app.delete("/admin/delete/arj/:id", async (req, res) => {
    const id = req.params.id;
    const data = loadData();

    const item = data.arj.find(a => a.id == id);
    if (!item) {
        return res.status(404).json({ success: false, message: "ARJ not found" });
    }

    try {
        // 🔥 Delete from Cloudinary (if exists)
        if (item.filename && typeof item.filename === "string") {
            try {
                await cloudinary.uploader.destroy(item.filename, { resource_type: "raw" });
            } catch (err) {
                console.error("Cloudinary ARJ delete error:", err);
            }
        }

        // 🔥 Delete from JSON storage
        data.arj = data.arj.filter(a => a.id != id);

        // 🔥 Update RT instantly
        RT.arj = data.arj;
        saveData(data);

        // 🔥 UI real-time update
        io.emit("new-data", { type: "arj" });
        io.of("/").adapter.close();

        res.json({ success: true });

    } catch (err) {
        console.error("ARJ DELETE ERROR:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});



// =======================================================
// ⭐ SCHEMES — FULL CLOUDINARY VERSION
// =======================================================
const uploadScheme = multer({ storage: multer.memoryStorage() });

// GET all schemes
app.get("/api/schemes", (req, res) => {
    res.json({ schemes: RT.schemes });
});


// Upload scheme
app.post("/admin/schemes", uploadScheme.single("file"), async (req, res) => {
    try {
        const { title, description } = req.body;

        if (!title || !description) {
            return res.status(400).json({ success: false, message: "Missing fields" });
        }

        const data = loadData();

        // 1️⃣ Create temporary placeholder
        const tempScheme = {
            id: Date.now(),
            title,
            description,
            fileUrl: null,
            fileType: "uploading",
            cloudinaryId: null,
            uploading: true
        };

        // 2️⃣ Push instantly to data + RT
        if (!data.schemes) data.schemes = [];
        data.schemes.push(tempScheme);

        RT.schemes = data.schemes;
        saveData(data);

        // 3️⃣ Emit instant update (UI refreshes in fraction of second)
        io.emit("new-data", { type: "schemes", scheme: tempScheme });
        io.of("/").adapter.close();

        // 4️⃣ If file exists → upload to Cloudinary in background
        if (req.file) {
            const uploadResult = await new Promise((resolve, reject) => {
                cloudinary.uploader.upload_stream(
                    {
                        folder: "schemes_files",
                        resource_type: "auto"
                    },
                    (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    }
                ).end(req.file.buffer);
            });

            // 5️⃣ Update placeholder with real Cloudinary file info
            tempScheme.fileUrl = uploadResult.secure_url;
            tempScheme.cloudinaryId = uploadResult.public_id;

            // detect file type
            const mime = req.file.mimetype;
            if (mime === "application/pdf") tempScheme.fileType = "pdf";
            else if (
                mime === "application/msword" ||
                mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            )
                tempScheme.fileType = "doc";
            else if (mime.startsWith("image/")) tempScheme.fileType = "image";
            else tempScheme.fileType = "other";

            tempScheme.uploading = false;

            // 6️⃣ Save & update RT again
            saveData(data);
            RT.schemes = data.schemes;

            // 7️⃣ Emit final update (real document replaces temp)
            io.emit("new-data", { type: "schemes" });
            io.of("/").adapter.close();
        }

        return res.json({ success: true, scheme: tempScheme });

    } catch (err) {
        console.error("SCHEME ERROR:", err);
        return res.status(500).json({ success: false, message: "Cloudinary upload failed" });
    }
});

// =======================================================
// DELETE scheme (SAFE + CORRECT RESOURCE TYPE)
// =======================================================
app.delete("/admin/delete/scheme/:id", async (req, res) => {
    const id = req.params.id;
    const data = loadData();

    const item = data.schemes.find(s => s.id == id);

    if (!item) {
        return res.status(404).json({ success: false, message: "Scheme not found" });
    }

    try {
        // 🔥 Delete from Cloudinary safely
        if (item.cloudinaryId && typeof item.cloudinaryId === "string" && item.cloudinaryId.trim() !== "") {

            let rType = "raw"; // default for pdf/doc

            if (item.fileType === "image") {
                rType = "image";
            }

            try {
                await cloudinary.uploader.destroy(item.cloudinaryId, { resource_type: rType });
            } catch (err) {
                console.error("Cloudinary scheme delete error:", err);
            }
        }

        // 🔥 Remove from JSON
        data.schemes = data.schemes.filter(s => s.id != id);

        // 🔥 Update RT memory instantly
        RT.schemes = data.schemes;
        saveData(data);

        // 🔥 Instant UI update
        io.emit("new-data", { type: "schemes" });
        io.of("/").adapter.close();

        return res.json({ success: true });

    } catch (err) {
        console.error("SCHEME DELETE ERROR:", err);
        return res.status(500).json({ success: false, message: "Server error" });
    }
});


// ----------------------------------------------------------
// SOCKET.IO EVENTS
// ----------------------------------------------------------
io.on("connection", socket => {
    console.log("User connected:", socket.id);

    // 🔥 real-time speed boost (fixes delay)
    socket.conn.transport.maxHttpBufferSize = 1e8;

    socket.on("disconnect", () =>
        console.log("User disconnected:", socket.id)
    );
});


// ----------------------------------------------------------
// START SERVER
// ----------------------------------------------------------
server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
