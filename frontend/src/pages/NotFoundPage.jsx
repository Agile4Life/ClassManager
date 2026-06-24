import { Button } from '../components/bootstrap-ui';
import { BookOpen24Filled, Home24Regular } from '../components/bootstrap-icons';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return <main className="not-found"><BookOpen24Filled /><span>Trang này chưa có trong giáo án</span><h1>Không tìm thấy trang</h1><p>Đường dẫn có thể đã thay đổi hoặc chưa được tạo.</p><Button as={Link} to="/" appearance="primary" icon={<Home24Regular />}>Về trang tổng quan</Button></main>;
}
