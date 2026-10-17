import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import Student from "./src/models/Student.js";
import Course from "./src/models/Course.js";
import Attendance from "./src/models/Attendance.js";
import Notice from "./src/models/Notice.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.CLIENT_URL ? process.env.CLIENT_URL.split(",").map(s => s.trim()) : true }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "Smart Campus API" }));

app.get("/api/dashboard", async (_req, res, next) => {
  try {
    const [students, courses, notices, attendanceTotal, attendancePresent] = await Promise.all([
      Student.countDocuments(), Course.countDocuments(), Notice.countDocuments(),
      Attendance.countDocuments(),
      Attendance.countDocuments({ status: "Present" })
    ]);
    res.json({ students, courses, notices, attendanceRecords: attendanceTotal,
      attendanceRate: attendanceTotal ? Math.round(attendancePresent / attendanceTotal * 100) : 0 });
  } catch (e) { next(e); }
});

app.get("/api/students", async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    const filter = q ? { $or: [
      { name: { $regex: q, $options: "i" } },
      { email: { $regex: q, $options: "i" } },
      { rollNo: { $regex: q, $options: "i" } },
      { department: { $regex: q, $options: "i" } }
    ] } : {};
    res.json(await Student.find(filter).sort({ createdAt: -1 }).limit(500));
  } catch (e) { next(e); }
});
app.post("/api/students", async (req, res, next) => {
  try {
    const { name, email, rollNo, department, year } = req.body;
    if (![name, email, rollNo, department].every(v => String(v || "").trim())) {
      return res.status(400).json({ message: "Name, email, roll number and department are required." });
    }
    const student = await Student.create({ name: name.trim(), email: email.trim().toLowerCase(),
      rollNo: rollNo.trim(), department: department.trim(), year: Number(year) || 1 });
    res.status(201).json(student);
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ message: "Email or roll number already exists." });
    next(e);
  }
});
app.get("/api/students/:id", async (req, res, next) => {
  try {
    const item = await Student.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Student not found." });
    res.json(item);
  } catch (e) { next(e); }
});
app.put("/api/students/:id", async (req, res, next) => {
  try {
    const item = await Student.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ message: "Student not found." });
    res.json(item);
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ message: "Email or roll number already exists." });
    next(e);
  }
});
app.delete("/api/students/:id", async (req, res, next) => {
  try {
    const item = await Student.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: "Student not found." });
    res.json({ message: "Student deleted." });
  } catch (e) { next(e); }
});

app.get("/api/courses", async (_req, res, next) => {
  try { res.json(await Course.find().sort({ createdAt: -1 })); } catch (e) { next(e); }
});
app.post("/api/courses", async (req, res, next) => {
  try {
    const { title, code, department, faculty } = req.body;
    if (![title, code, department].every(v => String(v || "").trim()))
      return res.status(400).json({ message: "Course title, code and department are required." });
    res.status(201).json(await Course.create({ title: title.trim(), code: code.trim().toUpperCase(),
      department: department.trim(), faculty: String(faculty || "").trim() }));
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ message: "Course code already exists." });
    next(e);
  }
});
app.delete("/api/courses/:id", async (req, res, next) => {
  try {
    const item = await Course.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: "Course not found." });
    res.json({ message: "Course deleted." });
  } catch (e) { next(e); }
});

app.get("/api/attendance", async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.date) filter.date = String(req.query.date).slice(0, 10);
    res.json(await Attendance.find(filter).populate("student", "name rollNo department").sort({ date: -1 }).limit(300));
  } catch (e) { next(e); }
});
app.post("/api/attendance", async (req, res, next) => {
  try {
    const { student, date, status } = req.body;
    if (!student || !date || !["Present", "Absent", "Late"].includes(status))
      return res.status(400).json({ message: "Student, date and valid status are required." });
    const found = await Student.findById(student);
    if (!found) return res.status(404).json({ message: "Student not found." });
    const record = await Attendance.findOneAndUpdate(
      { student, date: String(date).slice(0, 10) },
      { student, date: String(date).slice(0, 10), status },
      { new: true, upsert: true, runValidators: true }
    ).populate("student", "name rollNo department");
    res.status(201).json(record);
  } catch (e) { next(e); }
});

app.get("/api/notices", async (_req, res, next) => {
  try { res.json(await Notice.find().sort({ createdAt: -1 }).limit(100)); } catch (e) { next(e); }
});
app.post("/api/notices", async (req, res, next) => {
  try {
    const { title, body, category } = req.body;
    if (![title, body].every(v => String(v || "").trim()))
      return res.status(400).json({ message: "Notice title and message are required." });
    res.status(201).json(await Notice.create({ title: title.trim(), body: body.trim(), category: category || "General" }));
  } catch (e) { next(e); }
});
app.delete("/api/notices/:id", async (req, res, next) => {
  try {
    const item = await Notice.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: "Notice not found." });
    res.json({ message: "Notice deleted." });
  } catch (e) { next(e); }
});

app.use((req, res) => res.status(404).json({ message: "API route not found." }));
app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.name === "ValidationError") return res.status(400).json({ message: err.message });
  if (err.name === "CastError") return res.status(400).json({ message: "Invalid record ID." });
  res.status(500).json({ message: "Server error. Check backend terminal and database connection." });
});

mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/smart_campus")
  .then(() => {
    console.log("MongoDB connected");
    app.listen(PORT, () => console.log(`Smart Campus API running on http://localhost:${PORT}`));
  })
  .catch(err => { console.error("MongoDB connection failed:", err.message); process.exit(1); });
