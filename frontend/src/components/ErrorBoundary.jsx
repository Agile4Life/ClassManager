import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, details) {
    console.error('Unhandled frontend error', error, details);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="fatal-error" role="alert">
        <div>
          <span>ClassManager gặp sự cố</span>
          <h1>Không thể hiển thị trang này</h1>
          <p>Vui lòng tải lại trang. Nếu lỗi tiếp tục xảy ra, hãy báo cho quản trị viên.</p>
          <button type="button" onClick={() => window.location.reload()}>Tải lại trang</button>
        </div>
      </main>
    );
  }
}
