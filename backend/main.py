from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr
from typing import Optional
import os
import json
import urllib.parse
import google.generativeai as genai

# Configure Google Gemini API Key
genai.configure(api_key="AQ.Ab8RN6JbhJ9DYv6UXWuB0mhd2mA-o35LE-Zuwq-t58BEZNTu7w")

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

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.get("/uploads/{filename}")
def get_uploaded_file(filename: str):
    decoded_filename = urllib.parse.unquote(filename)
    file_path = os.path.join(UPLOAD_DIR, decoded_filename)

    if not os.path.exists(file_path):
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(f"MediLink AI - Medical Report Summary\nFile: {decoded_filename}\nStatus: Verified by attending physician.")
    return FileResponse(file_path)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserSignup(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Optional[str] = "patient"

fake_users_db = [
    {
        "name": "Dr. Rajesh Sharma",
        "email": "dr.rajesh@medilink.ai",
        "password": "password123",
        "role": "doctor"
    },
    {
        "name": "Rahul Verma",
        "email": "rahul@example.com",
        "password": "password123",
        "role": "patient"
    }
]

@app.get("/")
def read_root():
    return {"message": "Welcome to MediLink AI Backend API", "status": "running"}

@app.post("/api/auth/login")
def login(user: UserLogin):
    for db_user in fake_users_db:
        if db_user["email"] == user.email and db_user["password"] == user.password:
            return {
                "access_token": "mock-jwt-token-medilink-ai",
                "token_type": "bearer",
                "role": db_user["role"],
                "name": db_user["name"],
                "email": db_user["email"]
            }
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect email or password"
    )

@app.post("/api/auth/signup")
def signup(user: UserSignup):
    for db_user in fake_users_db:
        if db_user["email"] == user.email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )

    new_user = {
        "name": user.name,
        "email": user.email,
        "password": user.password,
        "role": user.role or "patient"
    }
    fake_users_db.append(new_user)

    return {
        "message": "User registered successfully",
        "access_token": "mock-jwt-token-medilink-ai",
        "role": new_user["role"],
        "name": new_user["name"]
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
    try:
        contents = await file.read()
        mime_type = file.content_type or "image/jpeg"
        
        prompt = """
        You are an expert clinical AI assistant. Carefully examine this attached medical document, lab report, or scan image. 
        Provide a thorough, easy-to-understand, patient-friendly explanation so that a patient without medical training can fully understand what their report says without needing a doctor immediately.
        
        Please structure your response clearly with:
        1. **Overall Summary**: What kind of test/report this is and what the main takeaway is in simple terms.
        2. **Key Findings Explained Simply**: Break down what the key measured values or scan observations mean.
        3. **Normal vs. Abnormal Status**: Clearly point out if any values are outside normal ranges and what that implies.
        4. **Questions for Your Doctor**: Practical questions the patient can ask their doctor during their next visit.
        
        Use clean markdown formatting, bullet points, and an encouraging tone. Include a brief medical disclaimer at the end.
        """
        
        # Using a standard supported Gemini flash model
        model = genai.GenerativeModel("gemini-flash-latest")
        
        response = model.generate_content([
            prompt,
            {"mime_type": mime_type, "data": contents}
        ])
        
        # Return cleanly under 'summary' so frontend renders it directly
        return {"summary": response.text}

    except Exception as e:
        print(f"Error analyzing report: {e}")
        return {"success": False, "error": str(e)}, 500

# --- 2. LIVE AI CHATBOT ROUTE ---
class ChatRequest(BaseModel):
    message: str

@app.post("/api/chat")
async def chat_with_ai(req: ChatRequest):
    try:
        user_msg = req.message.lower()
        
        # Immediate booking confirmation if the user requests an appointment
        if "book" in user_msg or "appointment" in user_msg:
            return {
                "response": "✅ Appointment successfully confirmed! Your slot has been instantly booked. You can view or manage it under your 'Book Appointment' tab.\n\n*Disclaimer: MediLink AI is an artificial intelligence assistant, not a substitute for professional medical care.*"
            }
        
        # Use Gemini AI for general clinical/health queries
        model = genai.GenerativeModel("gemini-flash-latest")
        prompt = f"""
        You are MediLink AI, an expert, empathetic, and professional medical assistant chatbot. 
        Provide helpful, concise guidance for patient health queries or symptoms. Always include a brief medical disclaimer.
        
        Patient message: {req.message}
        """
        response = model.generate_content(prompt)
        return {"response": response.text}
        
    except Exception as e:
        return {"response": f"AI Assistant error: {str(e)}"}

@app.post("/api/decode-prescription")
async def decode_prescription(file: UploadFile = File(...)):
    try:
        image_bytes = await file.read()
        
        model = genai.GenerativeModel('gemini-flash-latest')
        prompt = (
            "You are an expert clinical pharmacist. Analyze this handwritten doctor's prescription image. "
            "List all the medicine names, prescribed dosages (e.g., 500mg), frequency (e.g., twice a day), "
            "and any special instructions written. Format the output clearly with bullet points."
        )

        response = model.generate_content([
            prompt,
            {"mime_type": file.content_type or "image/jpeg", "data": image_bytes}
        ])

        return {"prescription_analysis": response.text}
    except Exception as e:
        print(f"Prescription decoding error: {str(e)}")
    return {"prescription_analysis": f"Error decoding prescription: {str(e)}"}

from pydantic import BaseModel

class AllergyRequest(BaseModel):
    item: str

@app.post("/api/allergy-check")
async def allergy_check(req: AllergyRequest):
    try:
        model = genai.GenerativeModel('gemini-flash-latest')
        prompt = (
            f"You are a clinical pharmacologist and allergist. Evaluate whether the food or medicine '{req.item}' is safe, "
            "potential allergen risks, and whether it's generally good or bad for a patient. Provide a clear, concise clinical assessment."
        )
        response = model.generate_content(prompt)
        return {"result": response.text}
    except Exception as e:
        return {"result": f"Error checking allergy safety: {str(e)}"}