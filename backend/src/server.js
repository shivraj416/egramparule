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
const DATA_FILE = path.join(ROOT_DIR, "data.json");

// ----------------------------------------------------------
// MIDDLEWARE
// ----------------------------------------------------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_PATH));

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
    if (!fs.existsSync(DATA_FILE)) {
        return { info: [], members: [], schemes: [], images: [], contact: [] };
    }
    return JSON.parse(fs.readFileSync(DATA_FILE));
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ----------------------------------------------------------
// INFO ROUTES
// ----------------------------------------------------------
app.get("/api/info", (req, res) => {
    res.json({ info: loadData().info });
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
    saveData(data);

    io.emit("new-data", { type: "info", info: newInfo });
    res.json({ status: "success", info: newInfo });
});

app.delete("/admin/delete/info/:id", (req, res) => {
    const data = loadData();
    data.info = data.info.filter((i) => i.id != req.params.id);
    saveData(data);

    io.emit("new-data", { type: "info" });
    res.json({ status: "success" });
});

// ----------------------------------------------------------
// MEMBERS ROUTES
// ----------------------------------------------------------
app.get("/api/members", (req, res) => {
    res.json({ members: loadData().members });
});

app.post("/admin/members", (req, res) => {
    const { name, role, contact } = req.body;
    if (!name || !role || !contact) {
        return res.status(400).json({ status: "error", message: "Missing fields" });
    }

    const data = loadData();
    const newMember = { id: Date.now(), name, role, contact };
    data.members.push(newMember);
    saveData(data);

    io.emit("new-data", { type: "members", member: newMember });
    res.json({ status: "success", member: newMember });
});

app.delete("/admin/delete/member/:id", (req, res) => {
    const data = loadData();
    data.members = data.members.filter((m) => m.id != req.params.id);
    saveData(data);

    io.emit("new-data", { type: "members" });
    res.json({ status: "success" });
});

// ----------------------------------------------------------
// GALLERY ROUTES
// ----------------------------------------------------------
const upload = multer({ storage: multer.memoryStorage() });

app.get("/api/gallery", (req, res) => {
    res.json({ images: loadData().images });
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
    saveData(data);

    io.emit("new-data", { type: "gallery", image: newImg });
    res.json({ status: "success", image: newImg });
});

app.delete("/admin/delete/image/:id", (req, res) => {
    const data = loadData();
    data.images = data.images.filter((img) => img.id != req.params.id);
    saveData(data);

    io.emit("new-data", { type: "gallery" });
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
    res.json({ arj: loadData().arj || [] });
});

// Upload ARJ
app.post("/admin/arj", uploadArj.single("file"), async (req, res) => {
    const { title } = req.body;

    if (!title || !req.file) {
        return res.json({ success: false, message: "Missing fields" });
    }

    try {
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

        const data = loadData();
        const newArj = {
            id: Date.now(),
            title,
            filename: uploadResult.public_id,
            url: uploadResult.secure_url
        };

        if (!data.arj) data.arj = [];
        data.arj.push(newArj);
        saveData(data);

        io.emit("new-data", { type: "arj" });

        return res.json({ success: true, file: newArj });

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
    if (!item)
        return res.status(404).json({ success: false, message: "ARJ not found" });

    try {
        await cloudinary.uploader.destroy(item.filename, { resource_type: "raw" });

        data.arj = data.arj.filter(a => a.id != id);
        saveData(data);

        io.emit("new-data", { type: "arj" });

        res.json({ success: true });

    } catch (err) {
        console.error("ARJ DELETE ERROR:", err);
        res.status(500).json({ success: false, message: "Cloudinary delete failed" });
    }
});


// =======================================================
// ⭐ SCHEMES — FULL CLOUDINARY VERSION
// =======================================================
const uploadScheme = multer({ storage: multer.memoryStorage() });

// GET all schemes
app.get("/api/schemes", (req, res) => {
    const data = loadData();
    res.json({ schemes: data.schemes || [] });
});

// Upload scheme
app.post("/admin/schemes", uploadScheme.single("file"), async (req, res) => {
    try {
        const { title, description } = req.body;

        if (!title || !description)
            return res.status(400).json({ success: false, message: "Missing fields" });

        let fileUrl = null;
        let cloudinaryId = null;
        let fileType = null;

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

            fileUrl = uploadResult.secure_url;
            cloudinaryId = uploadResult.public_id;

            const mime = req.file.mimetype;
            if (mime === "application/pdf") fileType = "pdf";
            else if (
                mime === "application/msword" ||
                mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            )
                fileType = "doc";
            else if (mime.startsWith("image/")) fileType = "image";
            else fileType = "other";
        }

        const data = loadData();
        const newScheme = {
            id: Date.now(),
            title,
            description,
            fileUrl,
            fileType,
            cloudinaryId
        };

        if (!data.schemes) data.schemes = [];
        data.schemes.push(newScheme);
        saveData(data);

        io.emit("new-data", { type: "schemes" });

        return res.json({ success: true, scheme: newScheme });

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
        // ------------------------------
        // 🔥 SAFE CLOUDINARY DELETE
        // ------------------------------
        if (item.cloudinaryId && typeof item.cloudinaryId === "string" && item.cloudinaryId.trim() !== "") {

            // Determine correct Cloudinary resource type
            let rType = "raw";  // default for pdf, doc, docx

            if (item.fileType === "image") rType = "image";

            try {
                await cloudinary.uploader.destroy(item.cloudinaryId, {
                    resource_type: rType
                });
            } catch (cloudErr) {
                console.error("Cloudinary delete error:", cloudErr);
            }

        } else {
            console.log("No cloudinaryId — skipping Cloudinary delete.");
        }

        // ------------------------------
        // 🔥 REMOVE FROM JSON
        // ------------------------------
        data.schemes = data.schemes.filter(s => s.id != id);
        saveData(data);

        io.emit("new-data", { type: "schemes" });

        return res.json({ success: true });

    } catch (err) {
        console.error("SCHEME DELETE ERROR:", err);
        return res.status(500).json({ success: false, message: "Server error" });
    }
});


// ----------------------------------------------------------
// SOCKET.IO EVENTS
// ----------------------------------------------------------
io.on("connection", (socket) => {
    console.log("User connected:", socket.id);
    socket.on("disconnect", () => console.log("User disconnected:", socket.id));
});

// ----------------------------------------------------------
// START SERVER
// ----------------------------------------------------------
server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
