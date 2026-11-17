import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import { API_BASE } from '../config/api';
import { optimizeImageForUpload } from '../utils/imageOptimizer';

export default function PatientPortal() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('vitals'); // 'vitals', 'directory', 'book', 'bot'

  // --- THEME STATE (LIGHT / DARK MODE) ---
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.body.style.backgroundColor = '#0b1329';
    } else {
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '#f1f5f9';
    }
  }, [darkMode]);

  const toggleTheme = () => {
    setDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem('theme', next ? 'dark' : 'light');
      return next;
    });
  };

  // --- LOGGED IN USER STATE ---
  const [currentUser, setCurrentUser] = useState({
    name: 'Patient',
    email: 'user@example.com',
    phone: 'Not provided',
    age: '25',
    gender: 'Male',
    bloodGroup: 'O+',
    patientId: 'PAT-176763',
    department: 'General Consultation'
  });

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setCurrentUser({
          name: parsed.name || 'Patient',
          email: parsed.email || 'user@example.com',
          phone: parsed.phone || 'Not provided',
          age: (parsed.age !== undefined && parsed.age !== null && parsed.age !== '') ? String(parsed.age) : '25',
          gender: parsed.gender || 'Male',
          bloodGroup: parsed.blood_group || parsed.bloodGroup || 'O+',
          patientId: parsed.patient_id || parsed.patientId || 'PAT-176763',
          department: parsed.department || 'General Consultation'
        });
      } catch (err) {
        console.error('Error parsing user data:', err);
      }
    }
  }, []);

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    phone: '',
    age: '',
    gender: 'Male',
    bloodGroup: 'O+'
  });

  const handleOpenEdit = () => {
    setEditFormData({
      name: currentUser.name,
      phone: currentUser.phone === 'Not provided' ? '' : currentUser.phone,
      age: currentUser.age,
      gender: currentUser.gender,
      bloodGroup: currentUser.bloodGroup
    });
    setIsEditingProfile(true);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    const numAge = Number(editFormData.age);
    if (!editFormData.age || isNaN(numAge) || numAge < 1 || numAge > 120) {
      alert('Please enter a valid age between 1 and 120 years.');
      return;
    }

    const updatedUser = {
      ...currentUser,
      name: editFormData.name.trim() || currentUser.name,
      phone: editFormData.phone.trim() || 'Not provided',
      age: String(numAge),
      gender: editFormData.gender,
      bloodGroup: editFormData.bloodGroup
    };

    setCurrentUser(updatedUser);
    localStorage.setItem('user', JSON.stringify({
      ...updatedUser,
      blood_group: updatedUser.bloodGroup,
      patient_id: updatedUser.patientId
    }));

    try {
      await fetch(`${API_BASE}/api/user/update-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: currentUser.email,
          name: updatedUser.name,
          phone: updatedUser.phone,
          age: numAge,
          gender: updatedUser.gender,
          blood_group: updatedUser.bloodGroup
        })
      });
    } catch (err) {
      console.warn('Backend sync failed, saved locally:', err);
    }

    setIsEditingProfile(false);
  };

  const handleSignOut = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('user_role');
    navigate('/login');
  };

  // --- REPORT ANALYZER STATES (EXACT UNTOUCHED CODE) ---
  const [selectedFile, setSelectedFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);

  // --- BOOK APPOINTMENT STATES ---
  const [department, setDepartment] = useState('Neurology');
  const [appointmentType, setAppointmentType] = useState('In-Person');
  const [selectedDoctor, setSelectedDoctor] = useState('Dr. Ananya Verma (Neurology Specialist)');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('10:00 AM');
  const [appointmentFile, setAppointmentFile] = useState(null);
  const [scheduledAppointments, setScheduledAppointments] = useState([]);

  // --- DOCTOR DIRECTORY FILTER STATE ---
  const [filterDept, setFilterDept] = useState('All Departments');

  // --- AI HEALTH BOT STATES ---
  const [chatMessages, setChatMessages] = useState([
    {
      sender: 'bot',
      text: 'Hello! I am your MediLink AI Health Assistant. You can ask health questions or simply say: "Book an appointment with Dr. Ananya Verma on 2026-10-25 at 10:00 AM" and I will handle it for you!'
    }
  ]);
  const [botInput, setBotInput] = useState('');

  // --- SYMPTOM TRACKER STATES ---
  const [symptomInput, setSymptomInput] = useState('');
  const [symptomsList, setSymptomsList] = useState([
    { id: 1, text: 'Mild headache after screen time', date: 'Oct 08, 2026' }
  ]);

  // --- ALLERGY CHECK STATE ---
  const [allergyCheckInput, setAllergyCheckInput] = useState('');

  // --- DOCTORS DATA ---
  const defaultDoctorsList = [
    {
      id: 1,
      name: 'Dr. Ananya Verma',
      dept: 'Neurology',
      degree: 'MD, DM (Neurology) • 12 Years Exp.',
      bio: 'Specialist in migraines, neuro-vascular disorders, and cognitive healthcare.',
      time: '10:00 AM - 02:00 PM',
      status: 'Available',
      initial: 'A',
      avatarBg: '#059669'
    },
    {
      id: 2,
      name: 'Dr. Rajesh Kumar',
      dept: 'Cardiology',
      degree: 'MBBS, MD, FACC • 16 Years Exp.',
      bio: 'Expert in preventive cardiology, blood pressure management, and ECG diagnostics.',
      time: '11:00 AM - 04:00 PM',
      status: 'Available',
      initial: 'R',
      avatarBg: '#2563eb'
    },
    {
      id: 3,
      name: 'Dr. Priya Nair',
      dept: 'General Consultation',
      degree: 'MBBS, MD (Internal Medicine) • 9 Years Exp.',
      bio: 'Focuses on primary care, viral infections, lifestyle disorders, and routine checkups.',
      time: '09:00 AM - 01:00 PM',
      status: 'In Consultation',
      initial: 'P',
      avatarBg: '#047857'
    },
    {
      id: 4,
      name: 'Dr. Vikramaditya Seth',
      dept: 'Orthopedics',
      degree: 'MS (Orthopedics), MCh • 14 Years Exp.',
      bio: 'Specialized in joint replacement, sports injury rehabilitation, and bone health.',
      time: '02:00 PM - 06:00 PM',
      status: 'Available',
      initial: 'V',
      avatarBg: '#d97706'
    },
    {
      id: 5,
      name: 'Dr. Meera Iyer',
      dept: 'Pediatrics',
      degree: 'MD (Pediatrics), DCH • 10 Years Exp.',
      bio: 'Dedicated child care physician focusing on growth tracking, immunizations, and pediatric wellness.',
      time: '10:30 AM - 03:30 PM',
      status: 'In Consultation',
      initial: 'M',
      avatarBg: '#4f46e5'
    }
  ];

  const [doctorsList, setDoctorsList] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('registered_doctors') || '[]');
      if (Array.isArray(saved) && saved.length > 0) {
        const extraDocs = saved.map((d, i) => ({
          id: 100 + i,
          name: d.name,
          dept: d.dept || 'General Consultation',
          degree: 'MD / Specialist Physician',
          bio: `Attending specialist in ${d.dept || 'general healthcare'}.`,
          time: '10:00 AM - 04:00 PM',
          status: 'Available',
          initial: d.name.replace(/^Dr\.\s*/i, '').charAt(0).toUpperCase() || 'D',
          avatarBg: '#0d9488'
        }));
        return [...defaultDoctorsList, ...extraDocs];
      }
    } catch (e) {}
    return defaultDoctorsList;
  });

  // --- REPORT ANALYZER LOGIC (EXACT UNTOUCHED WORKING CODE) ---
  const handleAnalyzeReport = async () => {
    if (!selectedFile) {
      alert('Please select a valid medical report image/PDF first.');
      return;
    }
    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      const fileToUpload = await optimizeImageForUpload(selectedFile);
      const formData = new FormData();
      formData.append('file', fileToUpload);

      const response = await fetch(`${API_BASE}/api/analyze-report`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Analysis failed');
      const data = await response.json();

      const analysisObj = data.analysis || data;

      if (typeof data.summary === 'string') {
        setAnalysisResult(data.summary);
        return;
      }

      let formattedText = '';

      if (analysisObj.summary) {
        formattedText += `📌 OVERALL SUMMARY:\n${analysisObj.summary}\n\n`;
      }

      if (Array.isArray(analysisObj.metrics) && analysisObj.metrics.length > 0) {
        formattedText += `📊 LAB METRICS & FINDINGS:\n`;
        analysisObj.metrics.forEach((item) => {
          formattedText += `• ${item.name || 'Metric'}: ${item.value || 'N/A'} (Status: ${item.status || 'Normal'})\n`;
        });
        formattedText += `\n`;
      }

      if (analysisObj.recommendation) {
        formattedText += `💡 RECOMMENDATIONS & NEXT STEPS:\n${analysisObj.recommendation}`;
      }

      if (!formattedText) {
        formattedText = typeof analysisObj === 'string' ? analysisObj : JSON.stringify(analysisObj, null, 2);
      }

      setAnalysisResult(formattedText);

    } catch (err) {
      console.error(err);
      alert('Could not analyze document. Please ensure your backend server is running on port 8000.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- BOOK APPOINTMENT HANDLER ---
  const handleBookAppointment = (e) => {
    e.preventDefault();

    if (!appointmentDate) {
      alert('Please select an appointment date.');
      return;
    }

    // Prevent booking past dates
    const todayStr = new Date().toISOString().split('T')[0];
    if (appointmentDate < todayStr) {
      alert('You cannot book an appointment for a past date.');
      return;
    }

    const newAppt = {
      id: Date.now(),
      name: currentUser.name || 'Patient', // Logged-in Patient Name
      doctor: selectedDoctor,
      dept: department,
      type: appointmentType,
      date: appointmentDate,
      time: appointmentTime,
      reportFile: appointmentFile ? appointmentFile.name : 'None', // Uploaded Report File
      status: 'Pending'
    };

    // --- ADD THESE LINES HERE ---
    const updatedAppointments = [...scheduledAppointments, newAppt];
    setScheduledAppointments(updatedAppointments);
    localStorage.setItem('doctorAppointments', JSON.stringify(updatedAppointments));
    // ----------------------------

    alert(`Appointment Confirmed with ${selectedDoctor} on ${appointmentDate} at ${appointmentTime}!`);
    setAppointmentDate('');
    setAppointmentFile(null);
  };

  const handleCancelAppointment = (id) => {
    const updatedAppointments = scheduledAppointments.filter((a) => a.id !== id);
    setScheduledAppointments(updatedAppointments);
    localStorage.setItem('doctorAppointments', JSON.stringify(updatedAppointments));
  };
  
  // --- PRESCRIPTION DECODER STATE & HANDLER ---
  const [prescriptionFile, setPrescriptionFile] = useState(null);
  const [prescriptionResult, setPrescriptionResult] = useState('');
  const [isDecoding, setIsDecoding] = useState(false);

  const handleDecodePrescription = async (e) => {
    e.preventDefault();
    if (!prescriptionFile) {
      alert("Please upload a prescription image first.");
      return;
    }

    setIsDecoding(true);
    setPrescriptionResult('');

    try {
      const fileToUpload = await optimizeImageForUpload(prescriptionFile);
      const formData = new FormData();
      formData.append("file", fileToUpload);

      const res = await fetch(`${API_BASE}/api/decode-prescription`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setPrescriptionResult(data.prescription_analysis || "Could not decode prescription.");
    } catch (err) {
      console.error(err);
      setPrescriptionResult("Error connecting to backend server.");
    } finally {
      setIsDecoding(false);
    }
  };



const [isListening, setIsListening] = useState(false);

  const handleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Google Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setBotInput((prev) => (prev ? prev + " " + transcript : transcript));
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  // --- LIVE GEMINI AI HEALTH BOT HANDLER ---
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!botInput.trim()) return;

    const userText = botInput.trim();
    const newMessages = [...chatMessages, { sender: 'user', text: userText }];
    setChatMessages(newMessages);
    const currentInput = botInput;
    setBotInput('');

    // Temporary typing indicator
    setChatMessages((prev) => [...prev, { sender: 'bot', text: 'Thinking...' }]);

    // Check if the user is asking to book an appointment
    if (currentInput.toLowerCase().includes('book') || currentInput.toLowerCase().includes('appointment')) {
      const newAppt = {
        id: Date.now(),
        doctor: 'Dr. Ananya Verma (Neurology Specialist)',
        dept: 'Neurology',
        type: 'In-Person',
        date: '2026-10-25',
        time: '10:00 AM',
        file: 'None'
      };
      setScheduledAppointments((prev) => [newAppt, ...prev]);

      setTimeout(() => {
        setChatMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { 
            sender: 'bot', 
            text: "✅ Appointment successfully confirmed! Your slot with Dr. Ananya Verma on 2026-10-25 at 10:00 AM has been instantly booked. You can view it now under your 'Book Appointment' tab.\n\n*Disclaimer: MediLink AI is an artificial intelligence assistant, not a substitute for professional medical care.*" 
          };
          return updated;
        });
      }, 500);
      return;
    }

    // Otherwise, call Gemini backend for standard medical/health queries
    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userText }),
      });

      if (!response.ok) throw new Error('Failed to reach AI bot');
      const data = await response.json();

      setChatMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { sender: 'bot', text: data.response || 'Hello! How can I assist you further?' };
        return updated;
      });

    } catch (err) {
      console.error(err);
      setChatMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { sender: 'bot', text: 'Error connecting to Gemini backend. Please ensure your FastAPI server is running.' };
        return updated;
      });
    }
  };

  // --- SYMPTOM TRACKER HANDLER ---
  const handleLogSymptom = (e) => {
    e.preventDefault();
    if (!symptomInput.trim()) return;
    const newEntry = {
      id: Date.now(),
      text: symptomInput.trim(),
      date: 'Oct 08, 2026'
    };
    setSymptomsList([newEntry, ...symptomsList]);
    setSymptomInput('');
  };

  const filteredDoctors = filterDept === 'All Departments' 
    ? doctorsList 
    : doctorsList.filter(d => d.dept.toLowerCase() === filterDept.toLowerCase());

  // Inline styling definitions
  const s = {
    pageContainer: {
      fontFamily: 'Segoe UI, -apple-system, sans-serif',
      backgroundColor: darkMode ? '#0b1329' : '#f1f5f9',
      minHeight: '100vh',
      paddingBottom: '40px',
      color: darkMode ? '#f1f5f9' : '#1e293b',
      transition: 'background-color 0.25s ease, color 0.25s ease'
    },
    header: {
      backgroundColor: darkMode ? '#050c1e' : '#0f172a',
      color: '#ffffff',
      padding: '16px 32px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      boxShadow: darkMode ? '0 2px 10px rgba(0,0,0,0.5)' : '0 2px 4px rgba(0,0,0,0.1)',
      borderBottom: darkMode ? '1px solid #1e293b' : 'none',
      transition: 'background-color 0.25s ease'
    },
    logoBox: { display: 'flex', alignItems: 'center', gap: '10px' },
    logoIcon: { backgroundColor: '#0d9488', color: '#ffffff', fontWeight: 'bold', borderRadius: '8px', padding: '6px 12px', fontSize: '18px' },
    logoText: { fontSize: '20px', fontWeight: 'bold' },
    userBox: { display: 'flex', alignItems: 'center', gap: '16px' },
    greenDot: { width: '10px', height: '10px', backgroundColor: '#10b981', borderRadius: '50%', display: 'inline-block' },
    signOutBtn: { backgroundColor: '#dc2626', color: '#ffffff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' },
    tabsRow: { maxWidth: '1100px', margin: '24px auto 0 auto', display: 'flex', justifyContent: 'center', gap: '12px', padding: '0 16px', flexWrap: 'wrap' },
    tabBtn: (active) => ({
      padding: '10px 20px',
      borderRadius: '10px',
      fontWeight: '600',
      fontSize: '13px',
      cursor: 'pointer',
      border: active ? 'none' : (darkMode ? '1px solid #243452' : '1px solid #cbd5e1'),
      backgroundColor: active ? '#00a896' : (darkMode ? '#131e36' : '#ffffff'),
      color: active ? '#ffffff' : (darkMode ? '#94a3b8' : '#334155'),
      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      transition: 'all 0.2s ease'
    }),
    main: { maxWidth: '1100px', margin: '24px auto 0 auto', padding: '0 16px' },
    card: {
      backgroundColor: darkMode ? '#131e36' : '#ffffff',
      borderRadius: '16px',
      padding: '24px',
      border: darkMode ? '1px solid #243452' : '1px solid #e2e8f0',
      boxShadow: darkMode ? '0 4px 12px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)',
      color: darkMode ? '#f1f5f9' : '#1e293b',
      transition: 'background-color 0.25s ease, border-color 0.25s ease'
    },
    input: {
      width: '100%',
      padding: '10px 14px',
      border: darkMode ? '1px solid #334155' : '1px solid #cbd5e1',
      backgroundColor: darkMode ? '#0b1329' : '#ffffff',
      color: darkMode ? '#f8fafc' : '#1e293b',
      borderRadius: '8px',
      fontSize: '13px',
      boxSizing: 'border-box',
      marginTop: '4px',
      outline: 'none'
    },
    tealBtn: { backgroundColor: '#00a896', color: '#ffffff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }
  };

  return (
    <div style={s.pageContainer}>
      {/* TOP HEADER */}
      <header style={s.header}>
        <div style={s.logoBox}>
          <img
            src="/medilink-circle.png"
            alt="MediLink AI Logo"
            style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover', display: 'block', boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}
          />
          <div style={s.logoText}>MediLink <span style={{ color: '#00a896' }}>AI</span></div>
        </div>
        <div style={s.userBox}>
          {/* Light / Dark Mode Toggle Button on right side of navbar */}
          <ThemeToggle darkMode={darkMode} onToggle={toggleTheme} />

          <div style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={s.greenDot}></span>
            <span style={{ fontWeight: 'bold' }}>{currentUser.name}</span>
            <span style={{ color: '#94a3b8' }}>{currentUser.email}</span>
          </div>
          <button onClick={handleSignOut} style={s.signOutBtn}>Sign Out</button>
        </div>
      </header>

      {/* TABS ROW */}
      <div style={s.tabsRow}>
        <button style={s.tabBtn(activeTab === 'vitals')} onClick={() => setActiveTab('vitals')}>
          👤 Patient Profile & AI Vitals
        </button>
        <button style={s.tabBtn(activeTab === 'directory')} onClick={() => setActiveTab('directory')}>
          📁 Doctors & Directory
        </button>
        <button style={s.tabBtn(activeTab === 'book')} onClick={() => setActiveTab('book')}>
          📅 Book Appointment
        </button>
        <button style={s.tabBtn(activeTab === 'bot')} onClick={() => setActiveTab('bot')}>
          🤖 AI Health Bot Chat
        </button>
      </div>

      {/* MAIN CONTAINER */}
      <main style={s.main}>

        {/* 1. PATIENT PROFILE & AI VITALS */}
        {activeTab === 'vitals' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              
              {/* Personal Info Box */}
              <div style={s.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', paddingBottom: '16px', borderBottom: darkMode ? '1px solid #243452' : '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '48px', height: '48px', backgroundColor: darkMode ? '#00a896' : '#0f172a', color: '#ffffff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '20px' }}>
                      {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'P'}
                    </div>
                    <div>
                      <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: darkMode ? '#f8fafc' : '#0f172a' }}>{currentUser.name}</h2>
                      <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>Patient ID: {currentUser.patientId}</p>
                    </div>
                  </div>
                  <button onClick={handleOpenEdit} style={{ border: darkMode ? '1px solid #334155' : '1px solid #cbd5e1', backgroundColor: darkMode ? '#0b1329' : '#ffffff', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer', fontWeight: '600', color: darkMode ? '#cbd5e1' : '#475569' }}>
                    ✏️ Edit Profile
                  </button>
                </div>

                <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: '0 0 12px 0', color: darkMode ? '#f8fafc' : '#0f172a' }}>Personal Information</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '12px' }}>
                  <div><span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold' }}>EMAIL ADDRESS</span><p style={{ margin: '4px 0 0 0', fontWeight: 'bold', color: darkMode ? '#f1f5f9' : '#0f172a' }}>{currentUser.email}</p></div>
                  <div><span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold' }}>PHONE NUMBER</span><p style={{ margin: '4px 0 0 0', fontWeight: 'bold', color: darkMode ? '#f1f5f9' : '#0f172a' }}>{currentUser.phone || 'Not provided'}</p></div>
                  <div><span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold' }}>AGE / GENDER</span><p style={{ margin: '4px 0 0 0', fontWeight: 'bold', color: darkMode ? '#f1f5f9' : '#0f172a' }}>{currentUser.age}Y • {currentUser.gender}</p></div>
                  <div><span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold' }}>BLOOD GROUP</span><p style={{ margin: '4px 0 0 0', fontWeight: 'bold', color: '#dc2626' }}>{currentUser.bloodGroup}</p></div>
                </div>
                <div style={{ marginTop: '16px' }}>
                  <span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold' }}>KNOWN ALLERGIES</span>
                  <p style={{ margin: '4px 0 0 0', color: '#d97706', fontSize: '12px', fontWeight: 'bold' }}>⚠️ None reported</p>
                </div>
              </div>

              {/* AI Health Risk Card */}
              <div style={{ ...s.card, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', color: darkMode ? '#f8fafc' : '#0f172a' }}>
                    🧠 AI Health Risk & Vitals Analysis
                  </h3>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div style={{ backgroundColor: darkMode ? '#0b1329' : '#f8fafc', padding: '16px', borderRadius: '12px', border: darkMode ? '1px solid #243452' : '1px solid #f1f5f9' }}>
                      <span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold' }}>OVERALL HEALTH SCORE</span>
                      <p style={{ margin: '4px 0 0 0', fontSize: '22px', fontWeight: '800', color: '#10b981' }}>92 / 100</p>
                    </div>
                    <div style={{ backgroundColor: darkMode ? '#0b1329' : '#f8fafc', padding: '16px', borderRadius: '12px', border: darkMode ? '1px solid #243452' : '1px solid #f1f5f9' }}>
                      <span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold' }}>METABOLIC RISK</span>
                      <p style={{ margin: '4px 0 0 0', fontSize: '16px', fontWeight: '800', color: '#f59e0b' }}>Low - Moderate</p>
                    </div>
                  </div>
                </div>

                <div style={{ backgroundColor: darkMode ? 'rgba(6, 78, 59, 0.35)' : '#f0fdf4', border: darkMode ? '1px solid #065f46' : '1px solid #bbf7d0', borderRadius: '12px', padding: '14px' }}>
                  <p style={{ color: darkMode ? '#34d399' : '#166534', fontWeight: 'bold', fontSize: '12px', margin: '0 0 4px 0' }}>✨ AI Personal Recommendation:</p>
                  <p style={{ color: darkMode ? '#a7f3d0' : '#15803d', fontSize: '12px', lineHeight: '1.5', margin: 0 }}>
                    Based on your profile, maintain 2.5L daily hydration and schedule routine metabolic screenings every 6 months.
                  </p>
                </div>
              </div>

            </div>

            {/* UNTOUCHED SMART LAB REPORT ANALYZER CONTAINER */}
            <div style={s.card}>
              <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px', color: darkMode ? '#f8fafc' : '#0f172a' }}>
                🔬 Smart Lab Report & X-Ray Analyzer
              </h2>
              <p style={{ color: darkMode ? '#94a3b8' : '#64748b', fontSize: '12px', margin: '0 0 16px 0' }}>
                Upload PDF reports, blood sugar tests, CBC counts, or X-Ray/CT/MRI scan images for instant Gemini AI clinical diagnostics.
              </p>

              <div style={{ border: darkMode ? '2px dashed #334155' : '2px dashed #cbd5e1', padding: '24px', borderRadius: '12px', backgroundColor: darkMode ? '#0b1329' : '#f8fafc', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px' }}>
                  <input
                    type="file"
                    onChange={(e) => setSelectedFile(e.target.files[0])}
                    style={{ fontSize: '12px', cursor: 'pointer', color: darkMode ? '#e2e8f0' : '#1e293b' }}
                  />
                  <button
                    onClick={handleAnalyzeReport}
                    disabled={isAnalyzing}
                    style={{ ...s.tealBtn, opacity: isAnalyzing ? 0.7 : 1, cursor: isAnalyzing ? 'not-allowed' : 'pointer' }}
                  >
                    {isAnalyzing ? 'Analyzing with Gemini AI...' : 'Analyze Document'}
                  </button>
                </div>
              </div>
              
              {/* PRESCRIPTION DECODER CARD */}
              <div style={{ ...s.card, marginTop: '24px', backgroundColor: darkMode ? '#0b1329' : '#ffffff', border: darkMode ? '1px solid #243452' : '1px solid #e2e8f0' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 'bold', borderBottom: darkMode ? '1px solid #243452' : '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px', color: darkMode ? '#f8fafc' : '#0f172a' }}>
                  💊 AI Handwritten Prescription Decoder
                </h2>
                <p style={{ color: darkMode ? '#94a3b8' : '#64748b', fontSize: '12px', fontStyle: 'italic', marginBottom: '14px' }}>
                  Upload a photo of a doctor's handwritten prescription to automatically extract medicine names and dosage instructions using Gemini Vision.
                </p>

                <form onSubmit={handleDecodePrescription} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ border: darkMode ? '1px dashed #334155' : '1px dashed #cbd5e1', padding: '12px', borderRadius: '8px', backgroundColor: darkMode ? '#131e36' : '#f8fafc' }}>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => setPrescriptionFile(e.target.files[0])} 
                      style={{ fontSize: '12px', color: darkMode ? '#e2e8f0' : '#1e293b' }} 
                    />
                  </div>

                  <button type="submit" style={s.tealBtn} disabled={isDecoding}>
                    {isDecoding ? "🔍 Decoding Handwriting..." : "Decode Prescription"}
                  </button>
                </form>

                {prescriptionResult && (
                  <div style={{ marginTop: '16px', padding: '14px', backgroundColor: darkMode ? 'rgba(6, 78, 59, 0.35)' : '#f0fdf4', border: darkMode ? '1px solid #065f46' : '1px solid #bbf7d0', borderRadius: '10px', fontSize: '13px', lineHeight: '1.5', color: darkMode ? '#e2e8f0' : '#0f172a', whiteSpace: 'pre-wrap' }}>
                    <strong style={{ color: darkMode ? '#34d399' : '#166534' }}>📋 Extracted Medicines & Instructions:</strong>
                    <div style={{ marginTop: '6px' }}>{prescriptionResult}</div>
                  </div>
                )}
              </div>

              {/* REPORT DISPLAY AREA */}
              {analysisResult && (
                <div style={{ marginTop: '16px', backgroundColor: darkMode ? 'rgba(6, 78, 59, 0.35)' : '#f0fdf4', border: darkMode ? '1px solid #065f46' : '1px solid #bbf7d0', borderRadius: '8px', padding: '16px' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: darkMode ? '#34d399' : '#166534', fontWeight: '700' }}>
                    📋 AI Patient-Friendly Report Analysis
                  </h4>
                  <pre style={{ margin: 0, fontSize: '13px', color: darkMode ? '#a7f3d0' : '#15803d', whiteSpace: 'pre-wrap', lineHeight: '1.6', fontFamily: 'inherit', backgroundColor: darkMode ? '#0b1329' : '#ffffff', padding: '12px', borderRadius: '6px', border: darkMode ? '1px solid #065f46' : '1px solid #d1fae5' }}>
                    {analysisResult}
                  </pre>
                </div>
              )}
            </div>

            {/* SYMPTOMS & MEDICAL HISTORY */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              
              <div style={{ ...s.card, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#111827', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🩺 AI Symptom Tracker & Allergy Guard
                  </h3>
                  <form onSubmit={handleLogSymptom} style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    <input
                      type="text"
                      value={symptomInput}
                      onChange={(e) => setSymptomInput(e.target.value)}
                      placeholder="Log daily symptom (e.g., Mild headache)..."
                      style={{ ...s.input, marginTop: 0, flex: 1 }}
                    />
                    <button type="submit" style={s.tealBtn}>Log</button>
                  </form>
                  <div>
                    {symptomsList.map((item) => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', backgroundColor: '#f8fafc', borderRadius: '8px', fontSize: '12px', border: '1px solid #f1f5f9', marginBottom: '8px' }}>
                        <span style={{ fontWeight: '500' }}>{item.text}</span>
                        <span style={{ color: '#94a3b8' }}>{item.date}</span>
                      </div>
                    ))}
                  </div>
                </div>

                    
              <div style={s.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '700', color: darkMode ? '#f8fafc' : '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    ⚕️ Medical History & Clinical Digest
                  </h3>
                  <button style={{ ...s.tealBtn, padding: '6px 12px', fontSize: '11px', borderRadius: '20px' }}>
                    ⚡ Generate Doctor Summary
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ borderLeft: '4px solid #00a896', paddingLeft: '12px', backgroundColor: darkMode ? '#0b1329' : '#f8fafc', padding: '10px', borderRadius: '0 8px 8px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8' }}>
                      <span>Neurology</span><span>Oct 2026</span>
                    </div>
                    <p style={{ margin: '2px 0', fontSize: '12px', fontWeight: 'bold', color: darkMode ? '#f8fafc' : '#0f172a' }}>Routine Neurological Checkup</p>
                    <p style={{ margin: 0, fontSize: '11px', color: '#00a896', fontWeight: '600' }}>Dr. Ananya Verma</p>
                  </div>

                  <div style={{ borderLeft: '4px solid #00a896', paddingLeft: '12px', backgroundColor: darkMode ? '#0b1329' : '#f8fafc', padding: '10px', borderRadius: '0 8px 8px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8' }}>
                      <span>Diagnostics</span><span>Aug 2026</span>
                    </div>
                    <p style={{ margin: '2px 0', fontSize: '12px', fontWeight: 'bold', color: darkMode ? '#f8fafc' : '#0f172a' }}>Complete Blood Count (CBC) & Metabolic Panel</p>
                    <p style={{ margin: 0, fontSize: '11px', color: '#00a896', fontWeight: '600' }}>Dr. Priya Nair</p>
                  </div>

                  <div style={{ borderLeft: '4px solid #00a896', paddingLeft: '12px', backgroundColor: darkMode ? '#0b1329' : '#f8fafc', padding: '10px', borderRadius: '0 8px 8px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8' }}>
                      <span>Cardiology</span><span>Feb 2026</span>
                    </div>
                    <p style={{ margin: '2px 0', fontSize: '12px', fontWeight: 'bold', color: darkMode ? '#f8fafc' : '#0f172a' }}>General Physical & ECG</p>
                    <p style={{ margin: 0, fontSize: '11px', color: '#00a896', fontWeight: '600' }}>Dr. Rajesh Kumar</p>
                 </div>
               </div>
              </div>
            </div>
          </div>
        </div>
  )}

  {/* 2. DOCTORS & DIRECTORY TAB */}
  {activeTab === 'directory' && (
    <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: darkMode ? '1px solid #243452' : '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0, color: darkMode ? '#f8fafc' : '#0f172a' }}>🏥 Hospital Specialist Directory</h2>
                <p style={{ color: darkMode ? '#94a3b8' : '#64748b', fontSize: '12px', margin: '4px 0 0 0' }}>Browse specialized medical departments and real-time doctor availability.</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 'bold', color: darkMode ? '#f8fafc' : '#1e293b' }}>
                <span>Filter Dept:</span>
                <select
                  value={filterDept}
                  onChange={(e) => setFilterDept(e.target.value)}
                  style={{ padding: '6px 12px', borderRadius: '8px', border: darkMode ? '1px solid #334155' : '1px solid #cbd5e1', fontSize: '12px', backgroundColor: darkMode ? '#0b1329' : '#ffffff', color: darkMode ? '#f8fafc' : '#1e293b' }}
                >
                  <option>All Departments</option>
                  <option>Neurology</option>
                  <option>Cardiology</option>
                  <option>General Consultation</option>
                  <option>Orthopedics</option>
                  <option>Pediatrics</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
              {filteredDoctors.map((doc) => (
                <div key={doc.id} style={{ border: darkMode ? '1px solid #243452' : '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backgroundColor: darkMode ? '#0b1329' : '#ffffff' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', backgroundColor: doc.avatarBg, color: '#ffffff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                          {doc.initial}
                        </div>
                        <div>
                          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: darkMode ? '#f8fafc' : '#0f172a' }}>{doc.name}</h3>
                          <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#00a896', fontWeight: 'bold' }}>{doc.dept}</p>
                        </div>
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '12px', backgroundColor: doc.status === 'Available' ? (darkMode ? 'rgba(16, 185, 129, 0.2)' : '#d1fae5') : (darkMode ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7'), color: doc.status === 'Available' ? '#10b981' : '#f59e0b' }}>
                        ● {doc.status}
                      </span>
                    </div>
                    <p style={{ fontSize: '11px', color: darkMode ? '#94a3b8' : '#64748b', margin: '0 0 8px 0' }}>🎓 {doc.degree}</p>
                    <p style={{ fontSize: '12px', color: darkMode ? '#cbd5e1' : '#334155', lineHeight: '1.5', margin: '0 0 16px 0' }}>{doc.bio}</p>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: darkMode ? '1px solid #243452' : '1px solid #f1f5f9', paddingTop: '12px' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>⏰ {doc.time}</span>
                    <button
                      onClick={() => {
                        setSelectedDoctor(`${doc.name} (${doc.dept} Specialist)`);
                        setDepartment(doc.dept);
                        setActiveTab('book');
                      }}
                      style={s.tealBtn}
                    >
                      Book Appointment
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. BOOK APPOINTMENT TAB */}
        {activeTab === 'book' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div style={s.card}>
              <h2 style={{ fontSize: '16px', fontWeight: 'bold', borderBottom: darkMode ? '1px solid #243452' : '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px', color: darkMode ? '#f8fafc' : '#0f172a' }}>📅 Book Doctor Appointment</h2>
              <form onSubmit={handleBookAppointment} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: darkMode ? '#cbd5e1' : '#475569' }}>Select Department</label>
                  <select value={department} onChange={(e) => setDepartment(e.target.value)} style={s.input}>
                    <option>Neurology</option>
                    <option>Cardiology</option>
                    <option>General Consultation</option>
                    <option>Orthopedics</option>
                    <option>Pediatrics</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: darkMode ? '#cbd5e1' : '#475569' }}>Appointment Type</label>
                  <div style={{ display: 'flex', gap: '20px', marginTop: '6px', fontSize: '12px', color: darkMode ? '#f8fafc' : '#1e293b' }}>
                    <label style={{ cursor: 'pointer' }}>
                      <input type="radio" name="type" value="In-Person" checked={appointmentType === 'In-Person'} onChange={(e) => setAppointmentType(e.target.value)} /> 🏨 In-Person
                    </label>
                    <label style={{ cursor: 'pointer' }}>
                      <input type="radio" name="type" value="Online Consultation" checked={appointmentType === 'Online Consultation'} onChange={(e) => setAppointmentType(e.target.value)} /> 💻 Online Consultation
                    </label>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: darkMode ? '#cbd5e1' : '#475569' }}>Select Specialist Doctor</label>
                  <select value={selectedDoctor} onChange={(e) => setSelectedDoctor(e.target.value)} style={s.input}>
                    <option>Dr. Ananya Verma (Neurology Specialist)</option>
                    <option>Dr. Rajesh Kumar (Cardiology Specialist)</option>
                    <option>Dr. Priya Nair (General Consultation Specialist)</option>
                    <option>Dr. Vikramaditya Seth (Orthopedics Specialist)</option>
                    <option>Dr. Meera Iyer (Pediatrics Specialist)</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: darkMode ? '#cbd5e1' : '#475569' }}>Appointment Date</label>
                    <input type="date" min={new Date().toISOString().split('T')[0]} value={appointmentDate} onChange={(e) => setAppointmentDate(e.target.value)} style={s.input} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: darkMode ? '#cbd5e1' : '#475569' }}>Time Slot</label>
                    <select value={appointmentTime} onChange={(e) => setAppointmentTime(e.target.value)} style={s.input}>
                      <option>10:00 AM</option>
                      <option>11:30 AM</option>
                      <option>02:00 PM</option>
                      <option>04:30 PM</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: darkMode ? '#cbd5e1' : '#475569' }}>Medical Report / Lab Result (Optional)</label>
                  <div style={{ border: darkMode ? '1px dashed #334155' : '1px dashed #cbd5e1', padding: '12px', borderRadius: '8px', backgroundColor: darkMode ? '#0b1329' : '#f8fafc', marginTop: '4px' }}>
                    <input type="file" onChange={(e) => setAppointmentFile(e.target.files[0])} style={{ fontSize: '12px', color: darkMode ? '#e2e8f0' : '#1e293b' }} />
                  </div>
                </div>

                <button type="submit" style={{ ...s.tealBtn, marginTop: '8px', width: '100%' }}>
                  Confirm Appointment
                </button>
              </form>
            </div>

            <div style={s.card}>
              <h2 style={{ fontSize: '16px', fontWeight: 'bold', borderBottom: darkMode ? '1px solid #243452' : '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px', color: darkMode ? '#f8fafc' : '#0f172a' }}>📋 Your Scheduled Appointments</h2>
              {scheduledAppointments.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '12px', fontStyle: 'italic', marginTop: '24px' }}>
                  No scheduled appointments yet. Book one using the form on the left or ask the AI Bot!
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {scheduledAppointments.map((item) => (
                    <div key={item.id} style={{ padding: '14px', backgroundColor: darkMode ? '#0b1329' : '#f0fdf4', border: darkMode ? '1px solid #243452' : '1px solid #bbf7d0', borderRadius: '10px', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: darkMode ? '#f8fafc' : '#0f172a', gap: '12px' }}>
                          <span>{item.doctor}</span>
                          <span style={{ color: '#00a896' }}>{item.type}</span>
                        </div>
                        <p style={{ margin: '4px 0 0 0', color: darkMode ? '#cbd5e1' : '#475569' }}>Date: {item.date} | Time: {item.time}</p>
                        {item.file !== 'None' && <p style={{ margin: '2px 0 0 0', color: '#94a3b8' }}>📎 Attached: {item.file}</p>}
                      </div>
                      <button 
                        onClick={() => handleCancelAppointment(item.id)}
                        style={{ backgroundColor: darkMode ? '#450a0a' : '#fee2e2', color: '#ef4444', border: darkMode ? '1px solid #7f1d1d' : '1px solid #fecaca', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px', whiteSpace: 'nowrap' }}
                      >
                        Cancel
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4. LIVE GEMINI AI HEALTH BOT TAB */}
        {activeTab === 'bot' && (
          <div style={s.card}>
            <div style={{ borderBottom: darkMode ? '1px solid #243452' : '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0', color: darkMode ? '#f8fafc' : '#0f172a' }}>🤖 MediLink AI Interactive Health Bot</h2>
              <p style={{ color: '#94a3b8', fontSize: '12px', fontStyle: 'italic', margin: '4px 0 0 0' }}>
                Chat with our assistant powered by Gemini AI. Ask health questions or discuss symptoms!
              </p>
            </div>

            <div style={{ backgroundColor: darkMode ? '#0b1329' : '#f8fafc', border: darkMode ? '1px solid #243452' : '1px solid #cbd5e1', borderRadius: '16px', padding: '16px', height: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {chatMessages.map((msg, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '88%',
                    padding: '12px 16px',
                    borderRadius: '16px',
                    fontSize: '13px',
                    lineHeight: '1.5',
                    backgroundColor: msg.sender === 'user' ? '#00a896' : (darkMode ? '#1e293b' : '#ffffff'),
                    color: msg.sender === 'user' ? '#ffffff' : (darkMode ? '#f8fafc' : '#1e293b'),
                    border: msg.sender === 'user' ? 'none' : (darkMode ? '1px solid #334155' : '1px solid #e2e8f0'),
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}>
                    {msg.sender === 'bot' && <div style={{ fontWeight: 'bold', marginBottom: '4px', color: darkMode ? '#38bdf8' : '#0f172a' }}>AI Health Bot:</div>}
                    <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '10px', marginTop: '14px', alignItems: 'center' }}>
              <input 
                type="text" 
                value={botInput} 
                onChange={(e) => setBotInput(e.target.value)} 
                placeholder={isListening ? "Listening... Speak your symptoms now..." : "Ask symptoms, medical advice, or schedule via chat..."} 
                style={{ ...s.input, flex: 1, borderColor: isListening ? '#00a896' : (darkMode ? '#334155' : '#cbd5e1'), backgroundColor: isListening ? (darkMode ? '#064e3b' : '#f0fdf4') : (darkMode ? '#0b1329' : '#fff') }} 
              />
              
              <button 
                type="button" 
                onClick={handleVoiceInput}
                title="Click to speak symptoms"
                style={{ 
                  backgroundColor: isListening ? '#dc2626' : (darkMode ? '#1e293b' : '#f8fafc'), 
                  color: isListening ? '#fff' : (darkMode ? '#cbd5e1' : '#475569'), 
                  border: darkMode ? '1px solid #334155' : '1px solid #cbd5e1', 
                  padding: '10px 14px', 
                  borderRadius: '8px', 
                  cursor: 'pointer', 
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {isListening ? "🎙️ Recording..." : "🎤 Speak"}
              </button>

              <button type="submit" style={s.tealBtn}>
                Send
              </button>
            </form>
          </div>
        )}

      </main>

      {/* EDIT PROFILE MODAL */}
      {isEditingProfile && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ backgroundColor: darkMode ? '#131e36' : '#ffffff', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '420px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)', border: darkMode ? '1px solid #243452' : 'none' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 16px 0', color: darkMode ? '#f8fafc' : '#0f172a' }}>✏️ Edit Profile</h2>
            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: darkMode ? '#94a3b8' : '#64748b', display: 'block', marginBottom: '4px' }}>FULL NAME</label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  style={s.input}
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: darkMode ? '#94a3b8' : '#64748b', display: 'block', marginBottom: '4px' }}>PHONE NUMBER</label>
                <input
                  type="text"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  style={s.input}
                  placeholder="10-digit number"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 'bold', color: darkMode ? '#94a3b8' : '#64748b', display: 'block', marginBottom: '4px' }}>AGE (1-120)</label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={editFormData.age}
                    onChange={(e) => setEditFormData({ ...editFormData, age: e.target.value })}
                    style={s.input}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 'bold', color: darkMode ? '#94a3b8' : '#64748b', display: 'block', marginBottom: '4px' }}>GENDER</label>
                  <select
                    value={editFormData.gender}
                    onChange={(e) => setEditFormData({ ...editFormData, gender: e.target.value })}
                    style={s.input}
                  >
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: darkMode ? '#94a3b8' : '#64748b', display: 'block', marginBottom: '4px' }}>BLOOD GROUP</label>
                <select
                  value={editFormData.bloodGroup}
                  onChange={(e) => setEditFormData({ ...editFormData, bloodGroup: e.target.value })}
                  style={s.input}
                >
                  <option>O+</option>
                  <option>O-</option>
                  <option>A+</option>
                  <option>A-</option>
                  <option>B+</option>
                  <option>B-</option>
                  <option>AB+</option>
                  <option>AB-</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  style={{ flex: 1, padding: '10px', backgroundColor: darkMode ? '#0b1329' : '#f1f5f9', color: darkMode ? '#cbd5e1' : '#475569', border: darkMode ? '1px solid #334155' : '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: '10px', backgroundColor: '#00a896', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};