import { useState } from 'react';
import { Button, Field, Input, MessageBar, MessageBarBody, MessageBarTitle } from '@fluentui/react-components';
import { BookOpen24Filled, Key24Regular, Person24Regular } from '@fluentui/react-icons';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      navigate(location.state?.from?.pathname || '/', { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-story" aria-label="Giới thiệu ClassManager">
        <div className="login-story__brand"><BookOpen24Filled /> ClassManager</div>
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
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-form__heading"><span>Chào bạn trở lại</span><h2>Đăng nhập</h2><p>Dùng tài khoản của trung tâm để tiếp tục.</p></div>
          {error && <MessageBar intent="error"><MessageBarBody><MessageBarTitle>Đăng nhập chưa thành công</MessageBarTitle>{error}</MessageBarBody></MessageBar>}
          <Field label="Tên đăng nhập" required>
            <Input size="large" contentBefore={<Person24Regular />} value={username} onChange={(_, data) => setUsername(data.value)} autoComplete="username" />
          </Field>
          <Field label="Mật khẩu" required>
            <Input size="large" type="password" contentBefore={<Key24Regular />} value={password} onChange={(_, data) => setPassword(data.value)} autoComplete="current-password" />
          </Field>
          <Button appearance="primary" size="large" type="submit" disabled={submitting || !username || !password}>
            {submitting ? 'Đang đăng nhập...' : 'Vào ClassManager'}
          </Button>
        </form>
      </section>
    </main>
  );
}
