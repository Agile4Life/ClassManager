import { useState } from 'react';
import { Button, Field, Input, MessageBar, MessageBarBody } from '../components/bootstrap-ui';
import { Save24Regular } from '../components/bootstrap-icons';
import { useAuth } from '../auth/AuthContext';
import PageHeader from '../components/PageHeader';

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [form, setForm] = useState({
    full_name: user.full_name || '',
    phone: user.phone || '',
    email: user.email || '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setMessage('');
    setError('');
  }

  async function saveProfile(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await updateProfile({
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
      });
      setMessage('Đã cập nhật thông tin cá nhân.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-flow profile-page">
      <PageHeader title="Hồ sơ cá nhân" description="Cập nhật tên hiển thị và thông tin liên hệ của tài khoản." />
      <form className="surface profile-form" onSubmit={saveProfile}>
        {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
        {message && <MessageBar intent="success"><MessageBarBody>{message}</MessageBarBody></MessageBar>}
        <Field label="Họ và tên" required>
          <Input value={form.full_name} onChange={(_, value) => updateField('full_name', value.value)} />
        </Field>
        <Field label="Số điện thoại">
          <Input type="tel" value={form.phone} onChange={(_, value) => updateField('phone', value.value)} />
        </Field>
        <Field label="Email">
          <Input type="email" value={form.email} onChange={(_, value) => updateField('email', value.value)} />
        </Field>
        <div className="profile-form__actions">
          <Button appearance="primary" type="submit" icon={<Save24Regular />} disabled={saving || !form.full_name.trim()}>
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </Button>
        </div>
      </form>
    </div>
  );
}
