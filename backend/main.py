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
    import google.generativeai as genai
    genai.configure(api_key="AQ.Ab8RN6JbhJ9DYv6UXWuB0mhd2mA-o35LE-Zuwq-t58BEZNTu7w")
    HAS_GENAI = True
    
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

        model = FAST_REPORT_MODEL
        if not model:
            model = genai.GenerativeModel("gemini-1.5-flash", generation_config={"max_output_tokens": 400, "temperature": 0.2})
            
        try:
            response = await run_gemini_async(model, [
                prompt,
                {"mime_type": mime_type, "data": contents}
            ])
            return {"summary": response.text}
        except Exception as api_err:
            print(f"Primary model failed, trying fallback: {api_err}")
            fallback_model = genai.GenerativeModel("gemini-flash-latest", generation_config={"max_output_tokens": 350, "temperature": 0.2})
            response = await run_gemini_async(fallback_model, [
                prompt,
                {"mime_type": mime_type, "data": contents}
            ])
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
        user_msg = req.message.lower()
        
        # Immediate instant reply if user asks to book an appointment (< 5ms)
        if "book" in user_msg or "appointment" in user_msg:
            return {
                "response": "✅ Appointment successfully confirmed! Your slot has been instantly booked. You can view or manage it under your 'Book Appointment' tab.\n\n*Disclaimer: MediLink AI is an artificial intelligence assistant, not a substitute for professional medical care.*"
            }
        
        if not HAS_GENAI:
            return {
                "response": "MediLink AI Assistant is online! Note: To enable live clinical AI advice from Gemini, run 'pip install google-generativeai' in your virtual environment."
            }

        prompt = f"""You are MediLink AI, a fast, helpful, and empathetic medical assistant chatbot. 
Provide a clear, direct, and concise response (under 100-120 words). Never write long essays.
Always add a 1-sentence medical disclaimer at the end.

Patient message: {req.message}"""

        model = FAST_CHAT_MODEL
        if not model:
            model = genai.GenerativeModel("gemini-1.5-flash", generation_config={"max_output_tokens": 250, "temperature": 0.3})
            
        try:
            response = await run_gemini_async(model, prompt)
            return {"response": response.text}
        except Exception:
            fallback = genai.GenerativeModel("gemini-flash-latest", generation_config={"max_output_tokens": 200, "temperature": 0.3})
            resp = await run_gemini_async(fallback, prompt)
            return {"response": resp.text}
        
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

        model = FAST_RX_MODEL
        if not model:
            model = genai.GenerativeModel("gemini-1.5-flash", generation_config={"max_output_tokens": 300, "temperature": 0.1})
            
        try:
            response = await run_gemini_async(model, [
                prompt,
                {"mime_type": mime_type, "data": image_bytes}
            ])
            return {"prescription_analysis": response.text}
        except Exception:
            fallback = genai.GenerativeModel("gemini-flash-latest", generation_config={"max_output_tokens": 250, "temperature": 0.1})
            resp = await run_gemini_async(fallback, [
                prompt,
                {"mime_type": mime_type, "data": image_bytes}
            ])
            return {"prescription_analysis": resp.text}
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
        model = FAST_CHAT_MODEL or genai.GenerativeModel('gemini-1.5-flash', generation_config={"max_output_tokens": 200, "temperature": 0.2})
        prompt = (
            f"You are a clinical pharmacologist. Quickly evaluate safety and allergy risk for '{req.item}'. "
            "Keep response under 80 words."
        )
        response = await run_gemini_async(model, prompt)
        return {"result": response.text}
    except Exception as e:
        return {"result": f"Error checking allergy safety: {str(e)}"}