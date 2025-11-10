import express from "express";
import fs from "fs";
import path from "path";
import axios from "axios";
import bodyParser from "body-parser";
import { fileURLToPath } from "url";
import ejs from "ejs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const VERCEL_TOKEN = process.env.VERCEL_TOKEN || "Sf9SiMDTnS4RJ0rzHCfzaSkS";
const VERCEL_API = "https://api.vercel.com/v13/projects";
const SERVERS_FILE = path.join(__dirname, "servers.json");

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "public/html"));

let servers = {};
if (fs.existsSync(SERVERS_FILE)) {
  servers = JSON.parse(fs.readFileSync(SERVERS_FILE, "utf8"));
}

// Simpan servers.json
function saveServers() {
  fs.writeFileSync(SERVERS_FILE, JSON.stringify(servers, null, 2));
}

// ======================== ROUTE BACKEND ========================

// List semua server
app.get("/servers", (req, res) => {
  res.json({
    success: true,
    servers: Object.values(servers),
  });
});

// Register server baru
app.post("/register", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.json({ success: false, error: "Nama project kosong" });

    const projectName = name.toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (servers[projectName])
      return res.json({ success: false, error: "Nama sudah digunakan" });

    const existing = await axios.get(`${VERCEL_API}?search=${projectName}`, {
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
    });

    if (
      existing.data?.projects?.length > 0 &&
      existing.data.projects[0].name === projectName
    ) {
      return res.json({
        success: false,
        error: "❌ Nama sudah terpakai di Vercel, gunakan nama lain",
      });
    }

    const project = await axios.post(
      VERCEL_API,
      {
        name: projectName,
        framework: "other",
      },
      {
        headers: {
          Authorization: `Bearer ${VERCEL_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    const domain = `https://${projectName}.vercel.app`;
    servers[projectName] = { name: projectName, domain, created_at: new Date().toISOString() };
    saveServers();

    res.json({ success: true, loginUrl: domain });
  } catch (err) {
    console.error("❌ Error /register:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ======================== ROUTE GAME DASHBOARD ========================

// Dashboard login (EJS)
app.all("/player/login/dashboard", function (req, res) {
  const hostname = req.hostname;
  const serverName = servers[hostname]?.name || hostname.split(".")[0] || "MazdaPS";

  const tData = {};
  try {
    const uData = JSON.stringify(req.body).split('"')[1].split("\\n");
    for (let i = 0; i < uData.length - 1; i++) {
      const d = uData[i].split("|");
      tData[d[0]] = d[1];
    }
  } catch (err) {
    console.log("⚠️ Parse error:", err.message);
  }

  res.render("dashboard", { data: tData, serverName: serverName });
});

// Validasi login → generate token
app.all("/player/growid/login/validate", (req, res) => {
  const _token = req.body._token || "";
  const growId = req.body.growId || "";
  const password = req.body.password || "";

  const token = Buffer.from(`_token=${_token}&growId=${growId}&password=${password}`).toString("base64");

  res.send(
    JSON.stringify({
      status: "success",
      message: "Account Validated.",
      token: token,
      url: "",
      accountType: "growtopia",
      accountAge: 2,
    })
  );
});

// Check token → refresh
app.all("/player/growid/checktoken", (req, res) => {
  const { refreshToken } = req.body;
  try {
    const decoded = Buffer.from(refreshToken, "base64").toString("utf-8");
    if (typeof decoded !== "string" || !decoded.includes("growId="))
      return res.render("dashboard", { data: {}, serverName: "MazdaPS" });

    res.json({
      status: "success",
      message: "Account Validated.",
      token: refreshToken,
      url: "",
      accountType: "growtopia",
      accountAge: 2,
    });
  } catch (error) {
    res.render("dashboard", { data: {}, serverName: "MazdaPS" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Express berjalan di port ${PORT}`);
});
