import { useState } from "react";
import { ThemeSwitcher } from "./ThemeSwitcher";

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

// 用户登录信息类型
interface UserInfo {
  username: string;
  avatar?: string;
  isLoggedIn: boolean;
}

const menuItems = [
  {
    id: "accounts",
    label: "账号管理",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    id: "stats",
    label: "统计数据",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
        <path d="M3 20h18"/>
      </svg>
    ),
  },
];

const bottomMenuItems = [
  {
    id: "settings",
    label: "设置",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09A1.65 1.65 0 0 0 19.4 15z"/>
      </svg>
    ),
  },
  {
    id: "about",
    label: "关于",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="16" x2="12" y2="12"/>
        <line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
    ),
  },
];

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  // 用户登录状态（临时状态，后续可接入实际登录逻辑）
  const [user, setUser] = useState<UserInfo>({
    username: "",
    isLoggedIn: false,
  });
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });

  // 处理登录
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // 临时登录逻辑，后续可替换为实际API调用
    if (loginForm.username.trim()) {
      setUser({
        username: loginForm.username,
        isLoggedIn: true,
      });
      setShowLoginModal(false);
      setLoginForm({ username: "", password: "" });
    }
  };

  // 处理登出
  const handleLogout = () => {
    setUser({ username: "", isLoggedIn: false });
  };

  return (
    <aside className="sidebar">
      {/* 用户信息区域 */}
      <div className="sidebar-user-section">
        {user.isLoggedIn ? (
          <div className="user-profile">
            <div className="user-avatar">
              {user.avatar ? (
                <img src={user.avatar} alt={user.username} />
              ) : (
                <div className="avatar-placeholder">
                  {user.username.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="user-info">
              <div className="user-name">{user.username}</div>
              <div className="user-status">已登录</div>
            </div>
            <button className="user-menu-btn" onClick={handleLogout} title="退出登录">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        ) : (
          <div className="user-login-prompt" onClick={() => setShowLoginModal(true)}>
            <div className="login-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div className="login-text">去登录</div>
          </div>
        )}
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <div
            key={item.id}
            className={`sidebar-item ${currentPage === item.id ? "active" : ""}`}
            onClick={() => onNavigate(item.id)}
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span className="sidebar-label">{item.label}</span>
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-footer-nav">
          {bottomMenuItems.map((item) => (
            <div
              key={item.id}
              className={`sidebar-footer-item ${currentPage === item.id ? "active" : ""}`}
              onClick={() => onNavigate(item.id)}
              title={item.label}
            >
              <span className="sidebar-footer-icon">{item.icon}</span>
            </div>
          ))}
        </div>
        <div className="sidebar-version-row">
          <ThemeSwitcher />
          <div className="sidebar-version">v1.0.7</div>
        </div>
      </div>

      {/* 登录弹窗 */}
      {showLoginModal && (
        <div className="login-modal-overlay" onClick={() => setShowLoginModal(false)}>
          <div className="login-modal" onClick={(e) => e.stopPropagation()}>
            <div className="login-modal-header">
              <h3>用户登录</h3>
              <button className="close-btn" onClick={() => setShowLoginModal(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleLogin}>
              <div className="login-form-group">
                <label>用户名</label>
                <input
                  type="text"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                  placeholder="请输入用户名"
                  autoFocus
                />
              </div>
              <div className="login-form-group">
                <label>密码</label>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  placeholder="请输入密码"
                />
              </div>
              <div className="login-form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowLoginModal(false)}>
                  取消
                </button>
                <button type="submit" className="btn-primary">
                  登录
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </aside>
  );
}
