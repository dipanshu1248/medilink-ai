import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import { API_BASE } from '../config/api';

const DEFAULT_DOCTORS = [
  { name: 'Dr. Ananya Verma', dept: 'Neurology' },
  { name: 'Dr. Rajesh Kumar', dept: 'Cardiology' },
  { name: 'Dr. Priya Nair', dept: 'General Consultation' },
  { name: 'Dr. Vikramaditya Seth', dept: 'Orthopedics' },
  { name: 'Dr. Meera Iyer', dept: 'Pediatrics' },
];

export default function Signup() {
  const navigate = useNavigate();
  const location = useLocation();

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
      document.body.style.backgroundColor = '#F8FAFC';
    }
  }, [darkMode]);

  const toggleTheme = () => {
    setDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem('theme', next ? 'dark' : 'light');
      return next;
    });
  };

  const [authMode, setAuthMode] = useState(() => {
    return location.pathname === '/login' ? 'login' : 'signup';
  });
  const [role, setRole] = useState('patient'); // 'patient' or 'doctor'
  const [isNewDoctor, setIsNewDoctor] = useState(true); // true = add new doctor, false = select from roster
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    age: '',
    gender: 'Male',
    bloodGroup: 'O+',
    department: 'General Consultation',
  });

  const [doctorsList, setDoctorsList] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('registered_doctors') || '[]');
      if (Array.isArray(saved) && saved.length > 0) {
        const custom = saved.filter(s => !DEFAULT_DOCTORS.some(d => d.name === s.name));
        return [...DEFAULT_DOCTORS, ...custom];
      }
    } catch (e) {}
    return DEFAULT_DOCTORS;
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'name' && role === 'doctor' && !isNewDoctor) {
      const found = doctorsList.find((d) => d.name === value);
      if (found) {
        setFormData({ ...formData, name: value, department: found.dept });
        return;
      }
    }
    setFormData({ ...formData, [name]: value });
  };

  const handleLoginOrSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validate age for patient registration
    if (authMode === 'signup' && role === 'patient') {
      const numAge = Number(formData.age);
      if (formData.age === '' || isNaN(numAge) || numAge < 1 || numAge > 120) {
        setError('Please enter a valid age between 1 and 120 years.');
        setLoading(false);
        return;
      }
    }

    // Validate name for doctor registration
    let finalDocName = formData.name ? formData.name.trim() : '';
    if (authMode === 'signup' && role === 'doctor') {
      if (!finalDocName) {
        setError("Please enter the doctor's full name.");
        setLoading(false);
        return;
      }
      if (!finalDocName.toLowerCase().startsWith('dr.') && !finalDocName.toLowerCase().startsWith('dr ')) {
        finalDocName = 'Dr. ' + finalDocName;
      }
    }

    const targetUrl = authMode === 'login' 
      ? `${API_BASE}/api/auth/login` 
      : `${API_BASE}/api/auth/signup`;

    const parsedAge = formData.age !== '' ? parseInt(formData.age, 10) : 25;

    const cleanEmail = formData.email ? formData.email.trim().toLowerCase() : '';
    const cleanPassword = formData.password ? formData.password.trim() : '';

    const payload = authMode === 'login'
      ? {
          email: cleanEmail,
          password: cleanPassword,
        }
      : {
          name: role === 'doctor' ? finalDocName : (formData.name ? formData.name.trim() : 'Patient'),
          email: cleanEmail,
          password: cleanPassword,
          role: role,
          phone: formData.phone || '',
          age: parsedAge,
          gender: formData.gender || 'Male',
          blood_group: formData.bloodGroup || 'O+',
          department: formData.department || 'General Consultation'
        };

    try {
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok) {
        // Save new doctor to local roster
        if (role === 'doctor') {
          try {
            const existingDocs = JSON.parse(localStorage.getItem('registered_doctors') || '[]');
            if (!existingDocs.some(d => d.name.toLowerCase() === finalDocName.toLowerCase())) {
              const newDoc = { name: finalDocName, dept: formData.department || 'General Consultation', email: cleanEmail };
              const updatedDocs = [...existingDocs, newDoc];
              localStorage.setItem('registered_doctors', JSON.stringify(updatedDocs));
              setDoctorsList(prev => [...prev, newDoc]);
            }
          } catch (e) {}
        }

        localStorage.setItem('token', data.access_token || 'token-' + Date.now());
        const activeRole = data.role ? data.role.toLowerCase() : role;
        localStorage.setItem('user_role', activeRole);

        const savedAge = (data.age !== undefined && data.age !== null) ? data.age : parsedAge;
        const userData = {
          name: data.name || (activeRole === 'doctor' ? finalDocName : formData.name),
          email: data.email || cleanEmail,
          role: activeRole,
          phone: data.phone || formData.phone || 'Not provided',
          age: savedAge,
          gender: data.gender || formData.gender || 'Male',
          bloodGroup: data.blood_group || formData.bloodGroup || 'O+',
          patientId: data.patient_id || (activeRole === 'doctor' ? 'DOC-' + Math.floor(100000 + Math.random() * 900000) : 'PAT-' + Math.floor(100000 + Math.random() * 900000)),
          department: data.department || formData.department,
        };

        localStorage.setItem('user', JSON.stringify(userData));

        if (activeRole === 'doctor') {
          navigate('/doctor-dashboard');
        } else {
          navigate('/patient-portal');
        }
      } else {
        let errMsg = typeof data.detail === 'string' 
          ? data.detail 
          : Array.isArray(data.detail) 
            ? data.detail.map(d => d.msg || JSON.stringify(d)).join(', ') 
            : 'Authentication failed. Please check credentials.';
        
        setError(errMsg);
      }
    } catch (err) {
      console.error('Auth request error:', err);
      setError('Unable to reach backend server on port 8000. Please ensure your FastAPI backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const styles = getStyles(darkMode);

  return (
    <div style={styles.container}>
      {/* Light / Dark Mode Toggle button in upper right */}
      <div style={{ position: 'fixed', top: '20px', right: '24px', zIndex: 100 }}>
        <ThemeToggle darkMode={darkMode} onToggle={toggleTheme} />
      </div>
      <div style={styles.card}>
        <div style={styles.brandContainer}>
          <img
            src="/medilink-circle.png"
            alt="MediLink AI Logo"
            style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', display: 'block', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
          />
          <h2 style={styles.brandTitle}>MediLink <span style={{ color: '#0D9488' }}>AI</span></h2>
        </div>
        <p style={styles.subtitle}>
          {authMode === 'login' ? 'Sign in to access your portal' : 'Clinical Portal Registration'}
        </p>

        {error && (
          <div style={styles.errorAlert}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
              <span>⚠️ {error}</span>
              {(error.toLowerCase().includes('already') || error.toLowerCase().includes('in use') || error.toLowerCase().includes('sign in')) && authMode === 'signup' && (
                <button
                  type="button"
                  onClick={() => { setAuthMode('login'); setError(''); }}
                  style={{ backgroundColor: '#0F172A', color: '#FFF', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  👉 Switch to Sign In
                </button>
              )}
            </div>
          </div>
        )}

        {/* Auth Mode Toggle: Sign In vs Sign Up */}
        <div style={styles.modeToggle}>
          <button
            type="button"
            onClick={() => { setAuthMode('login'); setError(''); }}
            style={authMode === 'login' ? styles.activeModeBtn : styles.inactiveModeBtn}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setAuthMode('signup'); setError(''); }}
            style={authMode === 'signup' ? styles.activeModeBtn : styles.inactiveModeBtn}
          >
            Create Account
          </button>
        </div>

        {/* Role Toggle: Patient vs Doctor */}
        <div style={styles.roleToggle}>
          <button
            type="button"
            onClick={() => setRole('patient')}
            style={role === 'patient' ? styles.activeRoleBtn : styles.inactiveRoleBtn}
          >
            👤 Patient
          </button>
          <button
            type="button"
            onClick={() => setRole('doctor')}
            style={role === 'doctor' ? styles.activeRoleBtn : styles.inactiveRoleBtn}
          >
            🩺 Medical Professional
          </button>
        </div>

        <form onSubmit={handleLoginOrSignup} style={styles.form}>
          {authMode === 'signup' && (
            role === 'doctor' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={styles.subTabRow}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsNewDoctor(true);
                      setFormData(prev => ({ ...prev, name: '', department: 'General Consultation' }));
                    }}
                    style={isNewDoctor ? styles.subTabActive : styles.subTabInactive}
                  >
                    ➕ Add New Doctor
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsNewDoctor(false);
                      if (doctorsList.length > 0) {
                        setFormData(prev => ({ ...prev, name: doctorsList[0].name, department: doctorsList[0].dept }));
                      }
                    }}
                    style={!isNewDoctor ? styles.subTabActive : styles.subTabInactive}
                  >
                    📋 Select Existing Doctor
                  </button>
                </div>

                {isNewDoctor ? (
                  <>
                    <div>
                      <label style={styles.label}>DOCTOR FULL NAME</label>
                      <input
                        type="text"
                        name="name"
                        placeholder="e.g. Dr. Jane Smith"
                        value={formData.name}
                        onChange={handleChange}
                        style={styles.input}
                        required
                      />
                    </div>
                    <div>
                      <label style={styles.label}>SPECIALIZATION / DEPARTMENT</label>
                      <select
                        name="department"
                        value={formData.department}
                        onChange={handleChange}
                        style={styles.select}
                      >
                        <option>General Consultation</option>
                        <option>Cardiology</option>
                        <option>Neurology</option>
                        <option>Orthopedics</option>
                        <option>Pediatrics</option>
                        <option>Dermatology</option>
                        <option>Oncology</option>
                        <option>Psychiatry</option>
                        <option>Gynecology</option>
                        <option>Ophthalmology</option>
                        <option>ENT</option>
                        <option>Pulmonology</option>
                      </select>
                    </div>
                  </>
                ) : (
                  <div>
                    <label style={styles.label}>SELECT DOCTOR FROM ROSTER</label>
                    <select
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      style={styles.select}
                      required
                    >
                      <option value="">-- Select Your Name --</option>
                      {doctorsList.map((doc, idx) => (
                        <option key={idx} value={doc.name}>
                          {doc.name} ({doc.dept})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label style={styles.label}>FULL NAME</label>
                <input
                  type="text"
                  name="name"
                  placeholder="Enter your full name"
                  value={formData.name}
                  onChange={handleChange}
                  style={styles.input}
                  required
                />
              </div>
            )
          )}

          <div>
            <label style={styles.label}>EMAIL ADDRESS</label>
            <input
              type="email"
              name="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={handleChange}
              style={styles.input}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: authMode === 'signup' ? '1fr 1fr' : '1fr', gap: '12px' }}>
            <div>
              <label style={styles.label}>PASSWORD</label>
              <div style={styles.passwordWrapper}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="Enter password"
                  value={formData.password}
                  onChange={handleChange}
                  style={styles.passwordInput}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={styles.eyeBtn}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            {authMode === 'signup' && (
              <div>
                <label style={styles.label}>PHONE NUMBER</label>
                <input
                  type="text"
                  name="phone"
                  placeholder="10-digit number"
                  value={formData.phone}
                  onChange={handleChange}
                  style={styles.input}
                />
              </div>
            )}
          </div>

          {authMode === 'signup' && role === 'patient' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={styles.label}>AGE</label>
                  <input
                    type="number"
                    name="age"
                    min="1"
                    max="120"
                    placeholder="Age (1-120)"
                    value={formData.age}
                    onChange={handleChange}
                    style={styles.input}
                    required
                  />
                </div>
                <div>
                  <label style={styles.label}>GENDER</label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    style={styles.select}
                  >
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label style={styles.label}>BLOOD GROUP</label>
                  <select
                    name="bloodGroup"
                    value={formData.bloodGroup}
                    onChange={handleChange}
                    style={styles.select}
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
              </div>

              <div>
                <label style={styles.label}>DEPARTMENT</label>
                <select
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  style={styles.select}
                >
                  <option>General Consultation</option>
                  <option>Neurology</option>
                  <option>Cardiology</option>
                  <option>Orthopedics</option>
                  <option>Pediatrics</option>
                </select>
              </div>
            </>
          )}

          {error && (
            <div style={styles.errorAlert}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                <span>⚠️ {error}</span>
                {(error.toLowerCase().includes('already') || error.toLowerCase().includes('in use') || error.toLowerCase().includes('sign in')) && authMode === 'signup' && (
                  <button
                    type="button"
                    onClick={() => { setAuthMode('login'); setError(''); }}
                    style={{ backgroundColor: '#0F172A', color: '#FFF', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    👉 Switch to Sign In
                  </button>
                )}
              </div>
            </div>
          )}

          <button type="submit" disabled={loading} style={styles.submitBtn}>
            {loading 
              ? 'Processing...' 
              : authMode === 'login'
                ? (role === 'doctor' ? 'Sign In to Doctor Portal' : 'Sign In as Patient')
                : (role === 'doctor' ? 'Register Medical Professional' : 'Register as Patient')}
          </button>
        </form>

        <div style={styles.switchModeContainer}>
          {authMode === 'login' ? (
            <p style={styles.switchModeText}>
              Don't have an account?{' '}
              <button 
                type="button" 
                onClick={() => { setAuthMode('signup'); setError(''); }} 
                style={styles.linkBtn}
              >
                Create Account
              </button>
            </p>
          ) : (
            <p style={styles.switchModeText}>
              Already have an account?{' '}
              <button 
                type="button" 
                onClick={() => { setAuthMode('login'); setError(''); }} 
                style={styles.linkBtn}
              >
                Sign In
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const getStyles = (darkMode) => ({
  container: { minHeight: '100vh', backgroundColor: darkMode ? '#0b1329' : '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: '-apple-system, sans-serif', transition: 'background-color 0.25s ease' },
  card: { backgroundColor: darkMode ? '#131e36' : '#FFF', borderRadius: '16px', border: darkMode ? '1px solid #243452' : '1px solid #E2E8F0', padding: '36px', width: '100%', maxWidth: '460px', boxShadow: darkMode ? '0 10px 25px rgba(0,0,0,0.4)' : '0 10px 25px rgba(0,0,0,0.03)', color: darkMode ? '#F8FAFC' : '#0F172A', transition: 'all 0.25s ease' },
  brandContainer: { display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', marginBottom: '2px' },
  brandIcon: { width: '30px', height: '30px', backgroundColor: darkMode ? '#00a896' : '#0F172A', color: '#FFF', borderRadius: '6px', fontWeight: 'bold', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  brandTitle: { fontSize: '22px', fontWeight: '700', color: darkMode ? '#F8FAFC' : '#0F172A', margin: 0 },
  subtitle: { textAlign: 'center', color: darkMode ? '#94A3B8' : '#64748B', fontSize: '12px', marginBottom: '18px' },
  modeToggle: { display: 'flex', backgroundColor: darkMode ? '#0b1329' : '#F1F5F9', padding: '4px', borderRadius: '10px', marginBottom: '14px', border: darkMode ? '1px solid #243452' : 'none' },
  activeModeBtn: { flex: 1, padding: '8px', backgroundColor: '#0D9488', color: '#FFF', fontWeight: 'bold', border: 'none', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' },
  inactiveModeBtn: { flex: 1, padding: '8px', backgroundColor: 'transparent', color: darkMode ? '#94A3B8' : '#64748B', fontWeight: '600', border: 'none', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' },
  roleToggle: { display: 'flex', backgroundColor: darkMode ? '#0b1329' : '#F8FAFC', border: darkMode ? '1px solid #243452' : '1px solid #E2E8F0', padding: '4px', borderRadius: '10px', marginBottom: '18px' },
  activeRoleBtn: { flex: 1, padding: '9px', backgroundColor: darkMode ? '#00a896' : '#0F172A', color: '#FFF', fontWeight: 'bold', border: 'none', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' },
  inactiveRoleBtn: { flex: 1, padding: '9px', backgroundColor: 'transparent', color: darkMode ? '#94A3B8' : '#64748B', fontWeight: '600', border: 'none', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' },
  subTabRow: { display: 'flex', gap: '8px', backgroundColor: darkMode ? '#0b1329' : '#F1F5F9', padding: '4px', borderRadius: '8px', border: darkMode ? '1px solid #243452' : 'none' },
  subTabActive: { flex: 1, padding: '6px 10px', backgroundColor: darkMode ? '#00a896' : '#0F172A', color: '#FFF', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' },
  subTabInactive: { flex: 1, padding: '6px 10px', backgroundColor: 'transparent', color: darkMode ? '#94A3B8' : '#64748B', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' },
  form: { display: 'flex', flexDirection: 'column', gap: '14px' },
  label: { fontSize: '10px', color: darkMode ? '#94A3B8' : '#64748B', fontWeight: 'bold', display: 'block', marginBottom: '4px', letterSpacing: '0.5px' },
  input: { width: '100%', padding: '10px 12px', borderRadius: '8px', border: darkMode ? '1px solid #334155' : '1px solid #CBD5E1', backgroundColor: darkMode ? '#0b1329' : '#FFF', color: darkMode ? '#F8FAFC' : '#0F172A', fontSize: '14px', boxSizing: 'border-box', outline: 'none' },
  passwordWrapper: { position: 'relative', display: 'flex', alignItems: 'center', width: '100%' },
  passwordInput: { width: '100%', padding: '10px 36px 10px 12px', borderRadius: '8px', border: darkMode ? '1px solid #334155' : '1px solid #CBD5E1', backgroundColor: darkMode ? '#0b1329' : '#FFF', color: darkMode ? '#F8FAFC' : '#0F172A', fontSize: '14px', boxSizing: 'border-box', outline: 'none' },
  eyeBtn: { position: 'absolute', right: '10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: darkMode ? '#94A3B8' : '#64748B' },
  select: { width: '100%', padding: '10px 12px', borderRadius: '8px', border: darkMode ? '1px solid #334155' : '1px solid #CBD5E1', fontSize: '14px', boxSizing: 'border-box', backgroundColor: darkMode ? '#0b1329' : '#FFF', color: darkMode ? '#F8FAFC' : '#0F172A', outline: 'none' },
  submitBtn: { backgroundColor: '#0D9488', color: '#FFF', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', marginTop: '6px' },
  errorAlert: { backgroundColor: darkMode ? '#450a0a' : '#FEF2F2', border: darkMode ? '1px solid #7f1d1d' : '1px solid #FECACA', color: darkMode ? '#fca5a5' : '#991B1B', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '12px' },
  switchModeContainer: { marginTop: '18px', textAlign: 'center' },
  switchModeText: { fontSize: '13px', color: darkMode ? '#94A3B8' : '#64748B', margin: 0 },
  linkBtn: { background: 'none', border: 'none', color: '#0D9488', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px', padding: 0, textDecoration: 'underline' }
});
