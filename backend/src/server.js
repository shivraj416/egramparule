// server.js
require("dotenv").config();
const express = require("express");
const path = require("path");
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
// ⭐ CLOUDINARY SETUP (FOR RENDER + LOCALHOST)
// =======================================================
const cloudinary = require("cloudinary").v2;

// Load environment variables
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Use memory storage (files saved in RAM, then uploaded)
const uploadArj = multer({ storage: multer.memoryStorage() });


// =======================================================
// ⭐ GET ALL ARJ
// =======================================================
app.get("/api/arj", (req, res) => {
    res.json({ arj: loadData().arj || [] });
});


// =======================================================
// ⭐ UPLOAD ARJ (PDF/DOCX/JPG/PNG SUPPORT)
// =======================================================
app.post("/admin/arj", uploadArj.single("file"), async (req, res) => {
    const { title } = req.body;
    if (!title || !req.file) {
        return res.json({ success: false, message: "Missing fields" });
    }

    try {
        // Upload file buffer to Cloudinary
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: "arj_files",
                resource_type: "raw"  // IMPORTANT for PDF, DOC, DOCX
            },
            (error, result) => {
                if (error) {
                    console.error(error);
                    return res.status(500).json({ success: false, message: "Cloudinary upload failed" });
                }

                // Save in data.json
                const data = loadData();
                const newFile = {
                    id: Date.now(),
                    title,
                    filename: result.public_id,  // needed for deletion
                    url: result.secure_url       // cloudinary file link
                };

                if (!data.arj) data.arj = [];
                data.arj.push(newFile);
                saveData(data);

                io.emit("new-data", { type: "arj" });

                res.json({ success: true, file: newFile });
            }
        );

        // Pipe file buffer to Cloudinary
        uploadStream.end(req.file.buffer);

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Upload error" });
    }
});


// =======================================================
// ⭐ DELETE ARJ (DELETE FROM CLOUDINARY + JSON)
// =======================================================
app.delete("/admin/delete/arj/:id", async (req, res) => {
    const id = req.params.id;
    const data = loadData();

    const item = data.arj.find(a => a.id == id);
    if (!item) {
        return res.status(404).json({ success: false, message: "ARJ not found" });
    }

    try {
        // Delete from Cloudinary
        await cloudinary.uploader.destroy(item.filename, { resource_type: "raw" });

        // Remove from JSON
        data.arj = data.arj.filter(a => a.id != id);
        saveData(data);

        io.emit("new-data", { type: "arj" });

        res.json({ success: true });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Cloudinary delete failed" });
    }
});


// =======================================================
// ⭐ DOWNLOAD ARJ (NOT NEEDED BUT SAFE FALLBACK)
// =======================================================
app.get("/download/arj/:filename", (req, res) => {
    return res.json({
        message: "File is stored on Cloudinary. Use the cloud URL from API."
    });
});


// =======================================================
// ⭐ SCHEMES UPLOAD — FIXED FULL VERSION
// =======================================================

const uploadScheme = multer({ storage: multer.memoryStorage() });

app.post("/admin/schemes", uploadScheme.single("file"), async (req, res) => {
    try {
        const { title, description } = req.body;

        if (!title || !description) {
            return res.status(400).json({ success: false, message: "Missing fields" });
        }

        let fileUrl = null;
        let cloudinaryId = null;
        let fileType = null;

        if (req.file) {
            // Upload to Cloudinary
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

            // Normalize file type for frontend
            const mime = req.file.mimetype;

            if (mime === "application/pdf") fileType = "pdf";
            else if (
                mime === "application/msword" ||
                mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            ) fileType = "doc";
            else if (mime.startsWith("image/")) fileType = "image";
            else fileType = "other";
        }

        // Save to JSON
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
        return res.status(500).json({ success: false, message: "Server error" });
    }
});


// DELETE scheme (delete Cloudinary file also)
app.delete("/admin/delete/scheme/:id", async (req, res) => {
    const id = req.params.id;

    const data = loadData();
    const item = data.schemes.find(s => s.id == id);

    if (!item) {
        return res.status(404).json({ success: false, message: "Scheme not found" });
    }

    // delete Cloudinary file if exists
    if (item.cloudinaryId) {
        try {
            await cloudinary.uploader.destroy(item.cloudinaryId, { resource_type: "auto" });
        } catch (err) {
            console.error("Cloudinary delete error:", err);
        }
    }

    data.schemes = data.schemes.filter(s => s.id != id);
    saveData(data);

    io.emit("new-data", { type: "schemes" });

    res.json({ success: true });
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
