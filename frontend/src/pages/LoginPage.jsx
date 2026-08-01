import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Button, Field, Input, MessageBar, MessageBarBody, MessageBarTitle, Tab, TabList,
} from '../components/bootstrap-ui';
import {
  BookOpen24Filled, Key24Regular, Person24Regular, TeacherIcon, Eye24Regular, EyeOff24Regular, PeopleCommunity24Regular, DataTrending24Regular
} from '../components/bootstrap-icons';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const initialRegistration = {
  full_name: '', phone: '', email: '', username: '', password: '', confirm_password: '',
};

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  || '421816854411-inu5br34qvca3170usuobn30hchgvmov.apps.googleusercontent.com';
const googleScriptSrc = 'https://accounts.google.com/gsi/client';
let googleScriptPromise;
const roleLabels = {
  admin: 'quản trị viên',
  staff: 'nhân viên',
  teacher: 'giáo viên',
  student: 'học sinh',
  parent: 'phụ huynh',
};

function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!googleScriptPromise) {
    googleScriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${googleScriptSrc}"]`);
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = googleScriptSrc;
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  return googleScriptPromise;
}

export default function LoginPage() {
  const {
    user, login, googleLogin, completeGoogleProfile, register,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const googleBtnRef = useRef(null);
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [registration, setRegistration] = useState(initialRegistration);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [googleButtonReady, setGoogleButtonReady] = useState(false);
  const [googleSetup, setGoogleSetup] = useState(null);
  const [googleProfile, setGoogleProfile] = useState({});
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const redirectTo = location.state?.from?.pathname || '/';

  const handleGoogleCredential = useCallback(async (response) => {
    if (!response?.credential) return;
    setError('');
    setSuccessMessage('');
    setGoogleSubmitting(true);
    try {
      const result = await googleLogin(response.credential);
      if (result?.needs_profile) {
        setGoogleSetup(result);
        setGoogleProfile({
          full_name: result.full_name || '',
          phone: '',
          address: '',
          occupation: '',
          specialization: '',
          grade_level: '',
          school_name: '',
        });
        return;
      }
      navigate(redirectTo, { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setGoogleSubmitting(false);
    }
  }, [googleLogin, navigate, redirectTo]);

  useEffect(() => {
    if (mode !== 'login' || !googleClientId) return undefined;

    let cancelled = false;
    setGoogleButtonReady(false);
    loadGoogleScript()
      .then(() => {
        if (cancelled || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleCredential,
        });
        if (googleBtnRef.current) {
          googleBtnRef.current.innerHTML = '';
          window.google.accounts.id.renderButton(googleBtnRef.current, {
            theme: 'outline',
            size: 'large',
            width: 320,
            text: 'continue_with',
            shape: 'pill',
            locale: 'vi',
          });
        }
        setGoogleButtonReady(true);
      })
      .catch(() => {
        if (!cancelled) setError('Không thể kết nối máy chủ Google. Vui lòng kiểm tra kết nối mạng hoặc trình chặn quảng cáo.');
      });

    return () => {
      cancelled = true;
    };
  }, [handleGoogleCredential, mode]);

  const handleGoogleFallback = useCallback(async () => {
    setError('');
    setGoogleSubmitting(true);
    try {
      await loadGoogleScript();
      if (!window.google?.accounts?.id) throw new Error('Google login is not available');
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleCredential,
      });
      if (googleBtnRef.current) {
        googleBtnRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline',
          size: 'large',
          width: 320,
          text: 'continue_with',
          shape: 'pill',
          locale: 'vi',
        });
        setGoogleButtonReady(true);
      }
      window.google.accounts.id.prompt();
    } catch {
      setError('Không thể kết nối với Google. Vui lòng kiểm tra mạng hoặc tắt trình chặn quảng cáo.');
    } finally {
      setGoogleSubmitting(false);
    }
  }, [handleGoogleCredential]);

  if (user) return <Navigate to="/" replace />;

  function changeMode(nextMode) {
    setMode(nextMode);
    setGoogleSetup(null);
    setGoogleProfile({});
    setError('');
    setSuccessMessage('');
  }

  function updateRegistration(field, value) {
    setRegistration((current) => ({ ...current, [field]: value }));
    setError('');
  }

  function updateGoogleProfile(field, value) {
    setGoogleProfile((current) => ({ ...current, [field]: value }));
    setError('');
  }

  async function handleGoogleProfileSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccessMessage('');
    setSubmitting(true);
    try {
      await completeGoogleProfile(googleSetup.setup_token, googleProfile);
      navigate(redirectTo, { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccessMessage('');
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(username.trim(), password);
        navigate(redirectTo, { replace: true });
      } else {
        if (registration.password !== registration.confirm_password) {
          throw new Error('Mật khẩu xác nhận chưa khớp');
        }
        if (registration.password.length < 8 || !/[A-Za-zÀ-ỹ]/.test(registration.password) || !/\d/.test(registration.password)) {
          throw new Error('Mật khẩu phải có tối thiểu 8 ký tự, bao gồm cả chữ và số.');
        }
        await register({
          full_name: registration.full_name.trim(),
          phone: registration.phone.trim(),
          email: registration.email.trim() || null,
          username: registration.username.trim(),
          password: registration.password,
        });
        setUsername(registration.username.trim().toLowerCase());
        setPassword('');
        setRegistration(initialRegistration);
        setMode('login');
        setSuccessMessage('Tài khoản phụ huynh đã được tạo. Bạn có thể đăng nhập ngay và liên hệ trung tâm để liên kết hồ sơ học sinh.');
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  const canRegister = registration.full_name.trim()
    && registration.phone.trim()
    && registration.username.trim()
    && registration.password
    && registration.confirm_password;

  return (
    <main className="login-page hallmark-login hallmark-login--centered">
      <div className="hallmark-hero__glow hallmark-hero__glow--1" />
      <div className="hallmark-hero__glow hallmark-hero__glow--2" />
      <div className="hallmark-hero__mesh" />

      {/* Centered Login Panel */}
      <section className="login-panel hallmark-panel hallmark-panel--centered">
        <form
          className={`login-form hallmark-form ${mode === 'register' ? 'login-form--register' : ''}`}
          onSubmit={googleSetup ? handleGoogleProfileSubmit : handleSubmit}
        >
          {googleSetup ? (
            <>
              <div className="login-form__heading hallmark-heading">
                <span className="hallmark-badge">Xác thực Google thành công</span>
                <h2>Bổ sung hồ sơ</h2>
                <p>{googleSetup.email} sẽ được tạo với vai trò <strong className="text-primary">{roleLabels[googleSetup.role] || googleSetup.role}</strong>.</p>
              </div>

              {error && <MessageBar intent="error"><MessageBarBody><MessageBarTitle>Chưa tạo được tài khoản</MessageBarTitle>{error}</MessageBarBody></MessageBar>}

              <div className="register-grid google-setup-grid">
                {(googleSetup.fields || []).map((field) => (
                  <Field
                    key={field.name}
                    className={field.name === 'full_name' ? 'register-grid__wide' : ''}
                    label={field.label}
                    required={field.required}
                  >
                    <Input
                      size="large"
                      value={googleProfile[field.name] || ''}
                      onChange={(_, data) => updateGoogleProfile(field.name, data.value)}
                      autoComplete={field.name === 'full_name' ? 'name' : field.name === 'phone' ? 'tel' : 'off'}
                    />
                  </Field>
                ))}
              </div>

              <Button
                appearance="primary"
                size="large"
                type="submit"
                className="hallmark-btn-primary"
                disabled={submitting || (googleSetup.fields || []).some((field) => field.required && !String(googleProfile[field.name] || '').trim())}
              >
                {submitting ? 'Đang tạo tài khoản...' : 'Hoàn tất và vào ClassManager'}
              </Button>
              <button className="google-setup-back" type="button" onClick={() => setGoogleSetup(null)}>
                Quay lại đăng nhập
              </button>
            </>
          ) : (
            <>
              <TabList
                className="auth-mode-switch hallmark-tabs"
                selectedValue={mode}
                onTabSelect={(_, data) => changeMode(data.value)}
                aria-label="Chọn đăng nhập hoặc đăng ký"
              >
                <Tab value="login">Đăng nhập</Tab>
                <Tab value="register">Đăng ký phụ huynh</Tab>
              </TabList>

              {error && <MessageBar intent="error"><MessageBarBody><MessageBarTitle>{mode === 'login' ? 'Đăng nhập chưa thành công' : 'Đăng ký chưa thành công'}</MessageBarTitle>{error}</MessageBarBody></MessageBar>}
              {successMessage && <MessageBar intent="success"><MessageBarBody><MessageBarTitle>Đăng ký thành công</MessageBarTitle>{successMessage}</MessageBarBody></MessageBar>}

              {mode === 'login' ? (
                <div className="hallmark-field-group">
                  <Field label="Tên đăng nhập" required>
                    <Input
                      size="large"
                      contentBefore={<Person24Regular />}
                      placeholder="Nhập username của bạn..."
                      value={username}
                      onChange={(_, data) => setUsername(data.value)}
                      autoComplete="username"
                    />
                  </Field>

                  <Field label="Mật khẩu" required>
                    <Input
                      size="large"
                      type={showPassword ? 'text' : 'password'}
                      contentBefore={<Key24Regular />}
                      contentAfter={
                        <button
                          type="button"
                          className="btn-password-toggle"
                          onClick={() => setShowPassword(!showPassword)}
                          title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        >
                          {showPassword ? <EyeOff24Regular /> : <Eye24Regular />}
                        </button>
                      }
                      placeholder="••••••••"
                      value={password}
                      onChange={(_, data) => setPassword(data.value)}
                      autoComplete="current-password"
                    />
                  </Field>
                </div>
              ) : (
                <div className="register-grid hallmark-register-grid">
                  <Field className="register-grid__wide" label="Họ và tên phụ huynh" required>
                    <Input size="large" placeholder="Ví dụ: Nguyễn Văn A" value={registration.full_name} onChange={(_, data) => updateRegistration('full_name', data.value)} autoComplete="name" />
                  </Field>

                  <Field label="Số điện thoại" required>
                    <Input size="large" type="tel" placeholder="0901234567" value={registration.phone} onChange={(_, data) => updateRegistration('phone', data.value)} autoComplete="tel" />
                  </Field>

                  <Field label="Email" hint="Không bắt buộc">
                    <Input size="large" type="email" placeholder="phuhuynh@example.com" value={registration.email} onChange={(_, data) => updateRegistration('email', data.value)} autoComplete="email" />
                  </Field>

                  <Field className="register-grid__wide" label="Tên đăng nhập" hint="3-50 ký tự không dấu, có thể dùng số, dấu chấm hoặc gạch dưới" required>
                    <Input size="large" contentBefore={<Person24Regular />} placeholder="ten_dang_nhap" value={registration.username} onChange={(_, data) => updateRegistration('username', data.value)} autoComplete="username" />
                  </Field>

                  <Field label="Mật khẩu" hint="Tối thiểu 8 ký tự" required>
                    <Input
                      size="large"
                      type={showRegPassword ? 'text' : 'password'}
                      contentBefore={<Key24Regular />}
                      contentAfter={
                        <button
                          type="button"
                          className="btn-password-toggle"
                          onClick={() => setShowRegPassword(!showRegPassword)}
                          title={showRegPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        >
                          {showRegPassword ? <EyeOff24Regular /> : <Eye24Regular />}
                        </button>
                      }
                      placeholder="••••••••"
                      value={registration.password}
                      onChange={(_, data) => updateRegistration('password', data.value)}
                      autoComplete="new-password"
                    />
                  </Field>

                  <Field label="Xác nhận mật khẩu" required>
                    <Input
                      size="large"
                      type={showConfirmPassword ? 'text' : 'password'}
                      contentBefore={<Key24Regular />}
                      contentAfter={
                        <button
                          type="button"
                          className="btn-password-toggle"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          title={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        >
                          {showConfirmPassword ? <EyeOff24Regular /> : <Eye24Regular />}
                        </button>
                      }
                      placeholder="••••••••"
                      value={registration.confirm_password}
                      onChange={(_, data) => updateRegistration('confirm_password', data.value)}
                      autoComplete="new-password"
                    />
                  </Field>
                </div>
              )}

              <Button
                appearance="primary"
                size="large"
                type="submit"
                className="hallmark-btn-submit"
                disabled={submitting || googleSubmitting || (mode === 'login' ? !username || !password : !canRegister)}
              >
                {submitting ? (
                  <span className="d-flex align-items-center justify-content-center gap-2">
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                    {mode === 'login' ? 'Đang xác thực...' : 'Đang khởi tạo tài khoản...'}
                  </span>
                ) : (
                  <span>{mode === 'login' ? 'Đăng Nhập Ngay' : 'Đăng Ký Tài Khoản Phụ Huynh'}</span>
                )}
              </Button>

              {mode === 'login' && googleClientId && (
                <div className="google-login hallmark-google-wrapper mt-3">
                  <div className="google-login__divider hallmark-divider">
                    <span className="hallmark-divider__line" />
                    <span className="hallmark-divider__text">HOẶC ĐĂNG NHẬP VỚI</span>
                    <span className="hallmark-divider__line" />
                  </div>
                  <div className="google-login__btn-wrapper position-relative w-100 d-flex flex-column align-items-center">
                    <button
                      className="btn hallmark-google-btn"
                      type="button"
                      onClick={handleGoogleFallback}
                      disabled={googleSubmitting}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 48 48" className="flex-shrink-0">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                      </svg>
                      <span className="fw-semibold text-dark fs-6">
                        {googleSubmitting ? 'Đang kết nối Google...' : 'Tiếp tục với Google'}
                      </span>
                    </button>

                    <div 
                      ref={googleBtnRef} 
                      className="position-absolute top-0 start-50 translate-middle-x overflow-hidden"
                      style={{ opacity: 0.0001, zIndex: 10, width: '100%', maxWidth: 360, minHeight: 48 }}
                    ></div>
                  </div>
                  {googleSubmitting && <p className="text-muted small text-center mt-2 mb-0 animate-pulse">Đang bảo mật và xác thực thông tin...</p>}
                </div>
              )}
              {mode === 'register' && <p className="register-security-note hallmark-security-note">Tài khoản giáo viên, học sinh và quản trị viên chỉ được khởi tạo bởi Trung tâm.</p>}
            </>
          )}
        </form>
      </section>
    </main>
  );
}
