import { useState } from 'react';
import {
  Button, Field, Input, MessageBar, MessageBarBody, MessageBarTitle, Tab, TabList,
} from '../components/bootstrap-ui';
import { BookOpen24Filled, Key24Regular, Person24Regular, TeacherIcon } from '../components/bootstrap-icons';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const initialRegistration = {
  full_name: '', phone: '', email: '', username: '', password: '', confirm_password: '',
};

export default function LoginPage() {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [registration, setRegistration] = useState(initialRegistration);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  if (user) return <Navigate to="/" replace />;

  function changeMode(nextMode) {
    setMode(nextMode);
    setError('');
    setSuccessMessage('');
  }

  function updateRegistration(field, value) {
    setRegistration((current) => ({ ...current, [field]: value }));
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccessMessage('');
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(username.trim(), password);
        navigate(location.state?.from?.pathname || '/', { replace: true });
      } else {
        if (registration.password !== registration.confirm_password) {
          throw new Error('Mật khẩu xác nhận chưa khớp');
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
    <main className="login-page">
      <section className="login-story" aria-label="Giới thiệu ClassManager">
        <div className="login-story__brand"><TeacherIcon /> ClassManager</div>
        <div className="login-story__copy">
          <span className="school-label">Một lớp học gọn gàng hơn</span>
          <h1>Quản lý lớp học, nhẹ đầu hơn mỗi ngày.</h1>
          <p>Lịch học, lớp học và hồ sơ học sinh nằm cùng một nơi để thầy cô có thêm thời gian cho việc dạy.</p>
        </div>
        <div className="notebook-card" aria-hidden="true">
          <div className="notebook-card__line"><span>Thứ hai</span><strong>Toán 9</strong></div>
          <div className="notebook-card__line"><span>Thứ tư</span><strong>Ôn phương trình</strong></div>
          <div className="notebook-card__line"><span>Thứ sáu</span><strong>Kiểm tra nhanh</strong></div>
        </div>
      </section>

      <section className="login-panel">
        <form className={`login-form ${mode === 'register' ? 'login-form--register' : ''}`} onSubmit={handleSubmit}>
          <TabList
            className="auth-mode-switch"
            selectedValue={mode}
            onTabSelect={(_, data) => changeMode(data.value)}
            aria-label="Chọn đăng nhập hoặc đăng ký"
          >
            <Tab value="login">Đăng nhập</Tab>
            <Tab value="register">Đăng ký phụ huynh</Tab>
          </TabList>

          <div className="login-form__heading">
            <span>{mode === 'login' ? 'Chào bạn trở lại' : 'Bắt đầu cùng ClassManager'}</span>
            <h2>{mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}</h2>
            <p>{mode === 'login'
              ? 'Dùng tài khoản của trung tâm để tiếp tục.'
              : 'Đăng ký tài khoản phụ huynh. Hồ sơ con sẽ được trung tâm liên kết sau.'}</p>
          </div>

          {error && <MessageBar intent="error"><MessageBarBody><MessageBarTitle>{mode === 'login' ? 'Đăng nhập chưa thành công' : 'Đăng ký chưa thành công'}</MessageBarTitle>{error}</MessageBarBody></MessageBar>}
          {successMessage && <MessageBar intent="success"><MessageBarBody><MessageBarTitle>Đăng ký thành công</MessageBarTitle>{successMessage}</MessageBarBody></MessageBar>}

          {mode === 'login' ? (
            <>
              <Field label="Tên đăng nhập" required>
                <Input size="large" contentBefore={<Person24Regular />} value={username} onChange={(_, data) => setUsername(data.value)} autoComplete="username" />
              </Field>
              <Field label="Mật khẩu" required>
                <Input size="large" type="password" contentBefore={<Key24Regular />} value={password} onChange={(_, data) => setPassword(data.value)} autoComplete="current-password" />
              </Field>
            </>
          ) : (
            <div className="register-grid">
              <Field className="register-grid__wide" label="Họ và tên phụ huynh" required>
                <Input size="large" value={registration.full_name} onChange={(_, data) => updateRegistration('full_name', data.value)} autoComplete="name" />
              </Field>
              <Field label="Số điện thoại" required>
                <Input size="large" type="tel" value={registration.phone} onChange={(_, data) => updateRegistration('phone', data.value)} autoComplete="tel" />
              </Field>
              <Field label="Email" hint="Không bắt buộc">
                <Input size="large" type="email" value={registration.email} onChange={(_, data) => updateRegistration('email', data.value)} autoComplete="email" />
              </Field>
              <Field className="register-grid__wide" label="Tên đăng nhập" hint="3-50 ký tự không dấu, có thể dùng số, dấu chấm hoặc gạch dưới" required>
                <Input size="large" contentBefore={<Person24Regular />} value={registration.username} onChange={(_, data) => updateRegistration('username', data.value)} autoComplete="username" />
              </Field>
              <Field label="Mật khẩu" hint="Tối thiểu 8 ký tự, có chữ và số" required>
                <Input size="large" type="password" contentBefore={<Key24Regular />} value={registration.password} onChange={(_, data) => updateRegistration('password', data.value)} autoComplete="new-password" />
              </Field>
              <Field label="Xác nhận mật khẩu" required>
                <Input size="large" type="password" contentBefore={<Key24Regular />} value={registration.confirm_password} onChange={(_, data) => updateRegistration('confirm_password', data.value)} autoComplete="new-password" />
              </Field>
            </div>
          )}

          <Button
            appearance="primary"
            size="large"
            type="submit"
            disabled={submitting || (mode === 'login' ? !username || !password : !canRegister)}
          >
            {submitting ? (mode === 'login' ? 'Đang đăng nhập...' : 'Đang tạo tài khoản...') : (mode === 'login' ? 'Vào ClassManager' : 'Tạo tài khoản phụ huynh')}
          </Button>
          {mode === 'register' && <p className="register-security-note">Tài khoản giáo viên, học sinh và quản trị viên chỉ được cấp bởi trung tâm.</p>}
        </form>
      </section>
    </main>
  );
}
