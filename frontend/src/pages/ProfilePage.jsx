import { useRef, useState } from 'react';
import { Avatar, Button, Field, Input, MessageBar, MessageBarBody } from '../components/bootstrap-ui';
import { Save24Regular, PersonCircle24Regular, Camera24Regular } from '../components/bootstrap-icons';
import { useAuth } from '../auth/AuthContext';
import PageHeader from '../components/PageHeader';

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const fileInputRef = useRef(null);
  
  const [form, setForm] = useState({
    full_name: user.full_name || '',
    phone: user.phone || '',
    email: user.email || '',
    avatar_url: user.avatar_url || '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setMessage('');
    setError('');
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Vui lòng chọn một tệp hình ảnh hợp lệ.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/webp', 0.85);
        updateField('avatar_url', dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
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
        avatar_url: form.avatar_url || null,
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
      <PageHeader title="Hồ sơ cá nhân" description="Cập nhật ảnh đại diện, tên hiển thị và thông tin liên hệ." />
      <form className="surface profile-form" onSubmit={saveProfile}>
        {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
        {message && <MessageBar intent="success"><MessageBarBody>{message}</MessageBarBody></MessageBar>}
        
        <div className="d-flex align-items-center gap-4 mb-3">
          <Avatar 
            size={80} 
            aria-label={form.full_name} 
            icon={<PersonCircle24Regular />} 
            imageUrl={form.avatar_url} 
            color="brand" 
          />
          <div>
            <Button appearance="secondary" icon={<Camera24Regular />} onClick={() => fileInputRef.current?.click()}>
              Đổi ảnh đại diện
            </Button>
            <input 
              type="file" 
              ref={fileInputRef} 
              accept="image/png, image/jpeg, image/webp" 
              style={{ display: 'none' }} 
              onChange={handleFileChange} 
            />
            <p className="form-text mt-2 mb-0">Hỗ trợ định dạng JPG, PNG hoặc WebP. Tự động thu nhỏ ảnh.</p>
          </div>
        </div>

        <Field label="Họ và tên" required>
          <Input value={form.full_name} onChange={(_, value) => updateField('full_name', value.value)} />
        </Field>
        <Field label="Số điện thoại">
          <Input type="tel" value={form.phone} onChange={(_, value) => updateField('phone', value.value)} />
        </Field>
        <Field label="Email">
          <Input type="email" value={form.email} onChange={(_, value) => updateField('email', value.value)} />
        </Field>
        <div className="profile-form__actions mt-2">
          <Button appearance="primary" type="submit" icon={<Save24Regular />} disabled={saving || !form.full_name.trim()}>
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </Button>
        </div>
      </form>
    </div>
  );
}
