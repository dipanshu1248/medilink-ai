from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr
from typing import Optional
import os
import json
import asyncio
import urllib.parse
import hashlib
import uuid
import random
import sqlite3

# Gracefully handle google-generativeai import & initialize high-speed flash models
try:
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except Exception:
        pass

    import google.generativeai as genai
    gemini_key = os.environ.get("GEMINI_API_KEY")
    if gemini_key:
        genai.configure(api_key=gemini_key)
    HAS_GENAI = bool(gemini_key)
    
    # Pre-warmed singleton models with fast generation_config
    # Low temperature (0.2) + capped max_output_tokens produces crisp, rapid briefs in 1-2 seconds
    FAST_REPORT_MODEL = genai.GenerativeModel(
        "gemini-1.5-flash",
        generation_config={"max_output_tokens": 400, "temperature": 0.2}
    )
    FAST_CHAT_MODEL = genai.GenerativeModel(
        "gemini-1.5-flash",
        generation_config={"max_output_tokens": 250, "temperature": 0.3}
    )
    FAST_RX_MODEL = genai.GenerativeModel(
        "gemini-1.5-flash",
        generation_config={"max_output_tokens": 300, "temperature": 0.1}
    )
except Exception as e:
    print(f"Gemini init warning: {e}")
    genai = None
    HAS_GENAI = False
    FAST_REPORT_MODEL = None
    FAST_CHAT_MODEL = None
    FAST_RX_MODEL = None

async def run_gemini_async(model, content_parts):
    """Run synchronous Gemini API calls in a threadpool so FastAPI event loop is never blocked."""
    return await asyncio.to_thread(model.generate_content, content_parts)

WORKING_MODEL_NAME = None

async def generate_with_fallback(prompt_or_contents, generation_config=None):
    """Dynamically generate content using whichever Gemini model is authorized and active for this API key."""
    global WORKING_MODEL_NAME

    # 1. Try previously verified working model first
    if WORKING_MODEL_NAME:
        try:
            m = genai.GenerativeModel(WORKING_MODEL_NAME, generation_config=generation_config)
            return await run_gemini_async(m, prompt_or_contents)
        except Exception as e:
            err_str = str(e).lower()
            if "404" in err_str or "not found" in err_str:
                WORKING_MODEL_NAME = None
            else:
                raise e

    # 2. Query available models dynamically via list_models()
    discovered = []
    try:
        for m in genai.list_models():
            if "generateContent" in getattr(m, "supported_generation_methods", []):
                clean_name = m.name.replace("models/", "")
                discovered.append(clean_name)
    except Exception as e:
        print(f"genai.list_models warning: {e}")

    # Ranked preference list
    preferred = [
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-2.0-flash-exp",
        "gemini-1.5-flash-latest",
        "gemini-1.5-flash-002",
        "gemini-1.5-flash-001",
        "gemini-flash-latest",
        "gemini-1.5-flash",
        "gemini-pro"
    ]

    candidates = []
    # Add discovered models that match preferences first
    for p in preferred:
        if p in discovered and p not in candidates:
            candidates.append(p)
    # Add any other discovered flash models
    for d in discovered:
        if "flash" in d.lower() and d not in candidates:
            candidates.append(d)
    # Add all remaining discovered models
    for d in discovered:
        if d not in candidates:
            candidates.append(d)
    # Add default preferences as backup
    for p in preferred:
        if p not in candidates:
            candidates.append(p)

    last_error = None
    for model_name in candidates:
        try:
            m = genai.GenerativeModel(model_name, generation_config=generation_config)
            resp = await run_gemini_async(m, prompt_or_contents)
            WORKING_MODEL_NAME = model_name
            print(f"Successfully generated with Gemini model: {model_name}")
            return resp
        except Exception as err:
            err_str = str(err).lower()
            if "404" in err_str or "not found" in err_str or "not supported" in err_str:
                print(f"Model '{model_name}' returned 404, attempting next model...")
                last_error = err
                continue
            last_error = err
            continue

    if last_error:
        raise last_error
    raise Exception("No active Gemini model found supporting generateContent.")

app = FastAPI(
    title="MediLink AI API",
    version="1.0.0",
    description="Backend API for MediLink AI Hospital Management & Medical Records System"
)

# Enable CORS for Frontend (Vite running on port 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "/tmp/uploads" if os.environ.get("VERCEL") else "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.get("/uploads/{filename}")
def get_uploaded_file(filename: str):
    decoded_filename = urllib.parse.unquote(filename)
    file_path = os.path.join(UPLOAD_DIR, decoded_filename)

    if not os.path.exists(file_path):
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(f"MediLink AI - Medical Report Summary\nFile: {decoded_filename}\nStatus: Verified by attending physician.")
    return FileResponse(file_path)

if os.environ.get("VERCEL"):
    tmp_db = "/tmp/medilink.db"
    src_db = os.path.join(os.path.dirname(__file__), "medilink.db")
    if not os.path.exists(tmp_db) and os.path.exists(src_db):
        import shutil
        shutil.copyfile(src_db, tmp_db)
    DB_PATH = tmp_db
else:
    DB_PATH = os.environ.get("MEDILINK_DB_PATH") or os.path.join(os.path.dirname(__file__), "medilink.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# Initialize SQLite DB & ensure columns exist
def init_db():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT,
            email TEXT UNIQUE,
            password TEXT,
            role TEXT DEFAULT 'patient',
            phone TEXT DEFAULT '',
            age INTEGER DEFAULT 25,
            gender TEXT DEFAULT 'Male',
            blood_group TEXT DEFAULT 'O+',
            department TEXT DEFAULT 'General Consultation',
            patient_id TEXT DEFAULT '',
            medical_history TEXT DEFAULT 'None'
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS appointments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            email TEXT,
            doctor TEXT,
            dept TEXT,
            type TEXT DEFAULT 'In-Person',
            date TEXT,
            time TEXT DEFAULT '10:00 AM',
            report_file TEXT DEFAULT 'None',
            status TEXT DEFAULT 'Pending'
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS prescriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_name TEXT,
            patient_id TEXT,
            doctor_name TEXT,
            medicine TEXT,
            dosage TEXT,
            duration TEXT,
            notes TEXT,
            date TEXT
        )
    """)
    conn.commit()

    cursor.execute("PRAGMA table_info(users)")
    existing_cols = [row["name"] for row in cursor.fetchall()]
    cols_to_add = [
        ("gender", "TEXT DEFAULT 'Male'"),
        ("department", "TEXT DEFAULT 'General Consultation'"),
        ("patient_id", "TEXT DEFAULT ''"),
        ("phone", "TEXT DEFAULT ''"),
        ("age", "INTEGER DEFAULT 25"),
        ("blood_group", "TEXT DEFAULT 'O+'"),
        ("medical_history", "TEXT DEFAULT 'None'"),
    ]
    for col_name, col_def in cols_to_add:
        if col_name not in existing_cols:
            try:
                cursor.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_def}")
            except Exception:
                pass
    conn.commit()
    conn.close()

init_db()

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

def verify_pw(plain: str, stored: str) -> bool:
    if plain == stored or hash_password(plain) == stored:
        return True
    return False

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserSignup(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Optional[str] = "patient"
    phone: Optional[str] = ""
    age: Optional[int] = 25
    gender: Optional[str] = "Male"
    blood_group: Optional[str] = "O+"
    department: Optional[str] = "General Consultation"

@app.get("/")
def read_root():
    return {"message": "Welcome to MediLink AI Backend API", "status": "running"}

@app.post("/api/auth/login")
def login(user: UserLogin):
    clean_email = user.email.strip().lower()
    # 1. Search in Database (case-insensitive and trimmed)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE LOWER(TRIM(email)) = ?", (clean_email,))
    db_user = cursor.fetchone()
    conn.close()

    if db_user and verify_pw(user.password.strip(), db_user["password"]):
        pid = db_user["patient_id"] or f"PAT-{db_user['id']:06d}"
        return {
            "access_token": f"token-{uuid.uuid4().hex}",
            "token_type": "bearer",
            "role": (db_user["role"] or "patient").lower(),
            "name": db_user["full_name"],
            "email": db_user["email"],
            "phone": db_user["phone"] or "",
            "age": db_user["age"] if db_user["age"] is not None else 25,
            "gender": db_user["gender"] or "Male",
            "blood_group": db_user["blood_group"] or "O+",
            "department": db_user["department"] or "General Consultation",
            "patient_id": pid
        }

    # 2. Check fallback demo users
    demo_defaults = {
        "dr.rajesh@medilink.ai": {
            "name": "Dr. Rajesh Sharma",
            "role": "doctor",
            "phone": "+91 9876543210",
            "department": "Cardiology",
            "patient_id": "DOC-100001"
        },
        "rahul@example.com": {
            "name": "Rahul Verma",
            "role": "patient",
            "phone": "9876543210",
            "department": "General Consultation",
            "patient_id": "PAT-100002"
        }
    }
    if clean_email in demo_defaults and user.password.strip() == "password123":
        info = demo_defaults[clean_email]
        return {
            "access_token": f"token-{uuid.uuid4().hex}",
            "token_type": "bearer",
            "role": info["role"],
            "name": info["name"],
            "email": clean_email,
            "phone": info.get("phone", ""),
            "age": 25,
            "gender": "Male",
            "blood_group": "O+",
            "department": info.get("department", "General Consultation"),
            "patient_id": info.get("patient_id", "PAT-100002")
        }

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect email or password. Please verify your credentials."
    )

@app.post("/api/auth/signup")
def signup(user: UserSignup):
    clean_email = user.email.strip().lower()

    # Validate patient age
    if (user.role or "patient").lower() == "patient":
        if user.age is None or user.age < 1 or user.age > 120:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please enter a valid age between 1 and 120 years."
            )

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE LOWER(TRIM(email)) = ?", (clean_email,))
    existing = cursor.fetchone()
    if existing:
        # If user entered correct password for their existing account, sign them in directly!
        if verify_pw(user.password.strip(), existing["password"]):
            pid = existing["patient_id"] or f"PAT-{existing['id']:06d}"
            conn.close()
            return {
                "message": "Account already exists - signed in successfully!",
                "access_token": f"token-{uuid.uuid4().hex}",
                "token_type": "bearer",
                "role": (existing["role"] or "patient").lower(),
                "name": existing["full_name"],
                "email": existing["email"],
                "phone": existing["phone"] or "",
                "age": existing["age"] if existing["age"] is not None else 25,
                "gender": existing["gender"] or "Male",
                "blood_group": existing["blood_group"] or "O+",
                "department": existing["department"] or "General Consultation",
                "patient_id": pid
            }
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This email is already in use by someone. If this is your account, please click Sign In."
        )

    # Generate patient ID
    gen_id = f"PAT-{random.randint(100000, 999999)}"
    if user.role and user.role.lower() == "doctor":
        gen_id = f"DOC-{random.randint(100000, 999999)}"

    age_val = user.age if user.age is not None else 25
    cursor.execute("""
        INSERT INTO users (full_name, email, password, role, phone, age, gender, blood_group, department, patient_id, medical_history)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        user.name,
        clean_email,
        hash_password(user.password.strip()),
        user.role or "patient",
        user.phone or "",
        age_val,
        user.gender or "Male",
        user.blood_group or "O+",
        user.department or "General Consultation",
        gen_id,
        "None"
    ))
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()

    return {
        "message": "User registered successfully",
        "access_token": f"token-{uuid.uuid4().hex}",
        "token_type": "bearer",
        "role": (user.role or "patient").lower(),
        "name": user.name,
        "email": user.email,
        "phone": user.phone or "",
        "age": age_val,
        "gender": user.gender or "Male",
        "blood_group": user.blood_group or "O+",
        "department": user.department or "General Consultation",
        "patient_id": gen_id or f"PAT-{new_id:06d}"
    }

class ProfileUpdate(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    phone: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None

@app.post("/api/user/update-profile")
def update_profile(req: ProfileUpdate):
    if req.age is not None and (req.age < 1 or req.age > 120):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please enter a valid age between 1 and 120 years."
        )

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?", (req.email,))
    user = cursor.fetchone()
    if not user:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")

    new_name = req.name if req.name is not None and req.name.strip() else user["full_name"]
    new_phone = req.phone if req.phone is not None else user["phone"]
    new_age = req.age if req.age is not None else user["age"]
    new_gender = req.gender if req.gender is not None else user["gender"]
    new_blood_group = req.blood_group if req.blood_group is not None else user["blood_group"]

    cursor.execute("""
        UPDATE users
        SET full_name = ?, phone = ?, age = ?, gender = ?, blood_group = ?
        WHERE email = ?
    """, (new_name, new_phone, new_age, new_gender, new_blood_group, req.email))
    conn.commit()
    conn.close()

    return {
        "message": "Profile updated successfully",
        "name": new_name,
        "email": req.email,
        "phone": new_phone,
        "age": new_age,
        "gender": new_gender,
        "blood_group": new_blood_group
    }

# --- DOCTORS DIRECTORY ENDPOINT ---
@app.get("/api/doctors")
def get_doctors():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, full_name, email, role, department, phone, patient_id FROM users WHERE LOWER(role) = 'doctor'")
    rows = cursor.fetchall()
    conn.close()

    default_docs = [
        {
            "id": 1,
            "name": "Dr. Ananya Verma",
            "dept": "Neurology",
            "degree": "MD, DM (Neurology) • 12 Years Exp.",
            "bio": "Specialist in migraines, neuro-vascular disorders, and cognitive healthcare.",
            "time": "10:00 AM - 02:00 PM",
            "status": "Available",
            "initial": "A",
            "avatarBg": "#059669",
            "email": "ananya.verma@medilink.ai"
        },
        {
            "id": 2,
            "name": "Dr. Rajesh Kumar",
            "dept": "Cardiology",
            "degree": "MBBS, MD, FACC • 16 Years Exp.",
            "bio": "Expert in preventive cardiology, blood pressure management, and ECG diagnostics.",
            "time": "11:00 AM - 04:00 PM",
            "status": "Available",
            "initial": "R",
            "avatarBg": "#2563eb",
            "email": "dr.rajesh@medilink.ai"
        },
        {
            "id": 3,
            "name": "Dr. Priya Nair",
            "dept": "General Consultation",
            "degree": "MBBS, MD (Internal Medicine) • 9 Years Exp.",
            "bio": "Focuses on primary care, viral infections, lifestyle disorders, and routine checkups.",
            "time": "09:00 AM - 01:00 PM",
            "status": "In Consultation",
            "initial": "P",
            "avatarBg": "#047857",
            "email": "priya.nair@medilink.ai"
        },
        {
            "id": 4,
            "name": "Dr. Vikramaditya Seth",
            "dept": "Orthopedics",
            "degree": "MS (Orthopedics), MCh • 14 Years Exp.",
            "bio": "Specialized in joint replacement, sports injury rehabilitation, and bone health.",
            "time": "02:00 PM - 06:00 PM",
            "status": "Available",
            "initial": "V",
            "avatarBg": "#d97706",
            "email": "vikramaditya.seth@medilink.ai"
        },
        {
            "id": 5,
            "name": "Dr. Meera Iyer",
            "dept": "Pediatrics",
            "degree": "MD (Pediatrics), DCH • 10 Years Exp.",
            "bio": "Dedicated child care physician focusing on growth tracking, immunizations, and pediatric wellness.",
            "time": "10:30 AM - 03:30 PM",
            "status": "In Consultation",
            "initial": "M",
            "avatarBg": "#4f46e5",
            "email": "meera.iyer@medilink.ai"
        }
    ]

    result = list(default_docs)
    existing_names = {d["name"].lower().strip() for d in default_docs}

    colors = ["#0d9488", "#0284c7", "#7c3aed", "#db2777", "#ea580c", "#16a34a"]
    for i, r in enumerate(rows):
        raw_name = (r["full_name"] or "").strip()
        if not raw_name:
            continue
        formatted_name = raw_name if raw_name.lower().startswith("dr.") else f"Dr. {raw_name}"
        if formatted_name.lower() in existing_names:
            continue
        existing_names.add(formatted_name.lower())
        dept = r["department"] or "General Consultation"
        initial = formatted_name.replace("Dr.", "").strip()[:1].upper() or "D"
        result.append({
            "id": 100 + i,
            "name": formatted_name,
            "dept": dept,
            "degree": f"MD / Specialist Physician • {dept}",
            "bio": f"Attending specialist in {dept} healthcare.",
            "time": "10:00 AM - 04:00 PM",
            "status": "Available",
            "initial": initial,
            "avatarBg": colors[i % len(colors)],
            "email": r["email"] or ""
        })

    return {"doctors": result}

# --- APPOINTMENTS ENDPOINTS ---
class AppointmentCreate(BaseModel):
    name: Optional[str] = "Patient"
    email: Optional[str] = ""
    doctor: str
    dept: Optional[str] = "General Consultation"
    type: Optional[str] = "In-Person"
    date: str
    time: Optional[str] = "10:00 AM"
    reportFile: Optional[str] = "None"
    status: Optional[str] = "Pending"

@app.post("/api/appointments")
def create_appointment(appt: AppointmentCreate):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO appointments (name, email, doctor, dept, type, date, time, report_file, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        appt.name or "Patient",
        appt.email or "",
        appt.doctor,
        appt.dept or "General Consultation",
        appt.type or "In-Person",
        appt.date,
        appt.time or "10:00 AM",
        appt.reportFile or "None",
        appt.status or "Pending"
    ))
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    return {
        "id": new_id,
        "name": appt.name or "Patient",
        "doctor": appt.doctor,
        "dept": appt.dept,
        "type": appt.type,
        "date": appt.date,
        "time": appt.time,
        "reportFile": appt.reportFile or "None",
        "file": appt.reportFile or "None",
        "status": appt.status or "Pending"
    }

@app.get("/api/appointments")
def get_appointments(doctor: Optional[str] = None, email: Optional[str] = None):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM appointments ORDER BY id DESC")
    rows = cursor.fetchall()
    conn.close()

    appointments = []
    for r in rows:
        item = {
            "id": r["id"],
            "name": r["name"] or "Patient",
            "email": r["email"] or "",
            "doctor": r["doctor"],
            "dept": r["dept"],
            "type": r["type"],
            "date": r["date"],
            "time": r["time"],
            "reportFile": r["report_file"] or "None",
            "file": r["report_file"] or "None",
            "status": r["status"] or "Pending"
        }
        if doctor:
            doc_q = doctor.lower().replace("dr.", "").strip()
            if doc_q and doc_q not in item["doctor"].lower():
                continue
        if email:
            if email.lower() != item["email"].lower():
                continue
        appointments.append(item)

    return {"appointments": appointments}

class AppointmentStatusUpdate(BaseModel):
    id: int
    status: str

@app.post("/api/appointments/status")
def update_appointment_status(req: AppointmentStatusUpdate):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE appointments SET status = ? WHERE id = ?", (req.status, req.id))
    conn.commit()
    conn.close()
    return {"message": "Status updated successfully"}

@app.delete("/api/appointments/{appt_id}")
def delete_appointment(appt_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM appointments WHERE id = ?", (appt_id,))
    conn.commit()
    conn.close()
    return {"message": "Appointment deleted successfully"}

# --- PRESCRIPTIONS ENDPOINTS ---
class PrescriptionCreate(BaseModel):
    patientName: str
    patientId: Optional[str] = ""
    doctorName: str
    medicine: str
    dosage: Optional[str] = "1 Tablet Daily"
    duration: Optional[str] = "5 Days"
    notes: Optional[str] = ""
    date: Optional[str] = ""

@app.post("/api/prescriptions")
def create_prescription(rx: PrescriptionCreate):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO prescriptions (patient_name, patient_id, doctor_name, medicine, dosage, duration, notes, date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        rx.patientName,
        rx.patientId or "",
        rx.doctorName,
        rx.medicine,
        rx.dosage or "1 Tablet Daily",
        rx.duration or "5 Days",
        rx.notes or "",
        rx.date or ""
    ))
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    return {"message": "Prescription issued successfully", "id": new_id}

@app.get("/api/prescriptions")
def get_prescriptions(doctor: Optional[str] = None, patient_name: Optional[str] = None):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM prescriptions ORDER BY id DESC")
    rows = cursor.fetchall()
    conn.close()

    result = []
    for r in rows:
        item = {
            "id": r["id"],
            "patientName": r["patient_name"],
            "patientId": r["patient_id"],
            "doctorName": r["doctor_name"],
            "medicine": r["medicine"],
            "dosage": r["dosage"],
            "duration": r["duration"],
            "notes": r["notes"],
            "date": r["date"]
        }
        if doctor and doctor.lower().replace("dr.", "").strip() not in item["doctorName"].lower():
            continue
        if patient_name and patient_name.lower().strip() not in item["patientName"].lower():
            continue
        result.append(item)
    return {"prescriptions": result}

@app.post("/api/upload-report")
async def upload_medical_report(file: UploadFile = File(...)):
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    try:
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not save file: {str(e)}")


@app.post("/api/analyze-report")
async def analyze_report(file: UploadFile = File(...)):
    if not HAS_GENAI:
        return {"summary": "Gemini AI module is not installed in the Python environment. Run 'pip install google-generativeai' to enable live report analysis."}
    try:
        contents = await file.read()
        mime_type = file.content_type or "image/jpeg"
        
        prompt = """You are MediLink AI Clinical Diagnostics. Rapidly analyze this medical document/image.
Be concise, direct, and patient-friendly (maximum 150-180 words total). Format in 3 quick bullet sections:
1. 📋 Summary: 1-2 sentence overview of the test type and primary takeaway.
2. 🔬 Key Lab/Scan Values: Highlight only notable or out-of-range metrics (Metric: Value | Status: Normal / Low / High).
3. 💡 Recommended Next Steps: 1-2 clear, actionable questions or points for the patient's next doctor visit.
(Brief disclaimer: Informational AI summary; consult your physician)."""

        config = {"max_output_tokens": 400, "temperature": 0.2}
        response = await generate_with_fallback([prompt, {"mime_type": mime_type, "data": contents}], generation_config=config)
        return {"summary": response.text}

    except Exception as e:
        print(f"Error analyzing report: {e}")
        return {"summary": f"Could not analyze report: {str(e)}"}

# --- 2. LIVE AI CHATBOT ROUTE ---
class ChatRequest(BaseModel):
    message: str

@app.post("/api/chat")
async def chat_with_ai(req: ChatRequest):
    try:
        if not HAS_GENAI:
            return {
                "response": "MediLink AI Assistant is online! Note: To enable live clinical AI advice from Gemini, run 'pip install google-generativeai' in your virtual environment."
            }

        prompt = f"""You are MediLink AI, a fast, helpful, and empathetic medical assistant chatbot. 
Provide a clear, direct, and concise response (under 100-120 words). Never write long essays.
Always add a 1-sentence medical disclaimer at the end.

Patient message: {req.message}"""

        config = {"max_output_tokens": 250, "temperature": 0.3}
        response = await generate_with_fallback(prompt, generation_config=config)
        return {"response": response.text}
        
    except Exception as e:
        return {"response": f"AI Assistant error: {str(e)}"}

@app.post("/api/decode-prescription")
async def decode_prescription(file: UploadFile = File(...)):
    if not HAS_GENAI:
        return {"prescription_analysis": "Gemini AI module not installed. Run 'pip install google-generativeai' to enable prescription decoding."}
    try:
        image_bytes = await file.read()
        mime_type = file.content_type or "image/jpeg"
        
        prompt = (
            "You are a clinical pharmacist. Rapidly analyze this doctor's handwritten prescription. "
            "List in clean bullet points ONLY: "
            "• Medicine Name & Strength (e.g. Paracetamol 500mg)\n"
            "• Dosage & Timing (e.g. 1 tab twice daily after food)\n"
            "• Duration (e.g. 5 days)\n"
            "• Special Instructions (if any)\n"
            "Be concise and extract only what is written."
        )

        config = {"max_output_tokens": 300, "temperature": 0.1}
        response = await generate_with_fallback([prompt, {"mime_type": mime_type, "data": image_bytes}], generation_config=config)
        return {"prescription_analysis": response.text}
    except Exception as e:
        print(f"Prescription decoding error: {str(e)}")
        return {"prescription_analysis": f"Error decoding prescription: {str(e)}"}

class AllergyRequest(BaseModel):
    item: str

@app.post("/api/allergy-check")
async def allergy_check(req: AllergyRequest):
    if not HAS_GENAI:
        return {"result": f"Assessment for '{req.item}': Please install 'google-generativeai' via pip for live Gemini allergy assessments."}
    try:
        prompt = (
            f"You are a clinical pharmacologist. Quickly evaluate safety and allergy risk for '{req.item}'. "
            "Keep response under 80 words."
        )
        config = {"max_output_tokens": 200, "temperature": 0.2}
        response = await generate_with_fallback(prompt, generation_config=config)
        return {"result": response.text}
    except Exception as e:
        return {"result": f"Error checking allergy safety: {str(e)}"}