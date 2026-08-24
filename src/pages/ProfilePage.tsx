import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useThemeStore, useLanguageStore } from '@/stores';
import {
  User, Settings, History, Star, Bell, Shield, Moon, Sun,
  ChevronRight, LogOut, Camera, Edit3, Check, X, Languages, Trash2
} from 'lucide-react';
import clsx from 'clsx';
import { userHistoryApi, userFavoritesApi, ChatConversation, UserFavorite } from '@/lib/api';

type TabType = 'profile' | 'settings' | 'history' | 'favorites' | 'security';

const TABS = [
  { id: 'profile' as TabType, label: 'Hồ sơ', icon: User },
  { id: 'settings' as TabType, label: 'Cài đặt', icon: Settings },
  { id: 'history' as TabType, label: 'Lịch sử', icon: History },
  { id: 'favorites' as TabType, label: 'Yêu thích', icon: Star },
  { id: 'security' as TabType, label: 'Bảo mật', icon: Shield },
];

export function ProfilePage() {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useThemeStore();
  const { language, setLanguage } = useLanguageStore();
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    sms: false,
  });

  // User data state
  const [userData, setUserData] = useState({
    name: 'Nguyễn Văn A',
    email: 'nguyenvana@email.com',
    phone: '0912 345 678',
    bio: 'Người dùng MADA AI',
    avatar: '',
  });

  const [tempUserData, setTempUserData] = useState(userData);

  const handleSaveProfile = () => {
    setUserData(tempUserData);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setTempUserData(userData);
    setIsEditing(false);
  };

  return (
    <div className="flex h-screen bg-[#f9f9ff] dark:bg-[#191b23]">
      {/* Sidebar */}
      <aside className="w-64 h-full bg-white dark:bg-[#2e3038] border-r-2 border-[#191b23] flex flex-col">
        {/* User Info */}
        <div className="p-6 border-b-2 border-[#191b23]">
          <div className="flex items-center gap-4">
            <div className="relative">
              {userData.avatar ? (
                <img src={userData.avatar} alt="" className="w-14 h-14 rounded-full border-2 border-[#191b23]" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-[#3b82f6] flex items-center justify-center border-2 border-[#191b23]">
                  <span className="text-2xl font-black text-white">{userData.name.charAt(0)}</span>
                </div>
              )}
              <button className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#3b82f6] border-2 border-[#191b23] flex items-center justify-center">
                <Camera className="w-3 h-3 text-white" />
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold truncate">{userData.name}</h3>
              <p className="text-xs text-[#727785] truncate">{userData.email}</p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex-1 p-3 space-y-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left',
                activeTab === tab.id
                  ? 'bg-[#3b82f6] text-white font-bold border-2 border-[#191b23]'
                  : 'hover:bg-[#ecedf7] dark:hover:bg-[#424754] text-[#424754] dark:text-[#c2c6d6]'
              )}
            >
              <tab.icon className="w-5 h-5" />
              <span className="text-sm">{tab.label}</span>
              <ChevronRight className={clsx('w-4 h-4 ml-auto transition-transform', activeTab === tab.id && 'rotate-90')} />
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t-2 border-[#191b23]">
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
            <LogOut className="w-5 h-5" />
            <span className="text-sm font-medium">Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-14 border-b-2 border-[#191b23] flex items-center justify-between px-6 bg-white dark:bg-[#2e3038]">
          <h1 className="font-black text-lg">
            {TABS.find((t) => t.id === activeTab)?.label}
          </h1>
          <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-[#ecedf7] dark:hover:bg-[#424754] transition-colors">
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'profile' && (
            <ProfileTab
              userData={userData}
              tempUserData={tempUserData}
              setTempUserData={setTempUserData}
              isEditing={isEditing}
              setIsEditing={setIsEditing}
              handleSaveProfile={handleSaveProfile}
              handleCancelEdit={handleCancelEdit}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsTab
              notifications={notifications}
              setNotifications={setNotifications}
              language={language}
              setLanguage={setLanguage}
            />
          )}

          {activeTab === 'history' && <HistoryTab />}
          {activeTab === 'favorites' && <FavoritesTab />}
          {activeTab === 'security' && <SecurityTab />}
        </div>
      </div>
    </div>
  );
}

// Profile Tab Component
function ProfileTab({
  userData,
  tempUserData,
  setTempUserData,
  isEditing,
  setIsEditing,
  handleSaveProfile,
  handleCancelEdit,
}: any) {
  return (
    <div className="max-w-2xl space-y-6">
      {/* Avatar Section */}
      <div className="bg-white dark:bg-[#2e3038] rounded-xl border-2 border-[#191b23] p-6">
        <div className="flex items-center gap-6">
          <div className="relative">
            {userData.avatar ? (
              <img src={userData.avatar} alt="" className="w-24 h-24 rounded-full border-4 border-[#191b23]" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-[#3b82f6] flex items-center justify-center border-4 border-[#191b23] neo-brutalist-shadow-sm">
                <span className="text-4xl font-black text-white">{userData.name.charAt(0)}</span>
              </div>
            )}
            {isEditing && (
              <button className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-[#3b82f6] border-2 border-[#191b23] flex items-center justify-center hover:-translate-y-0.5 hover:-translate-x-0.5 transition-all">
                <Camera className="w-4 h-4 text-white" />
              </button>
            )}
          </div>
          <div>
            <h2 className="text-xl font-black">{userData.name}</h2>
            <p className="text-[#727785]">{userData.email}</p>
            <p className="text-sm text-[#727785] mt-1">{userData.bio}</p>
          </div>
        </div>
      </div>

      {/* Profile Form */}
      <div className="bg-white dark:bg-[#2e3038] rounded-xl border-2 border-[#191b23] p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-lg">Thông tin cá nhân</h3>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#3b82f6] text-white font-bold border-2 border-[#191b23] hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
            >
              <Edit3 className="w-4 h-4" />
              Chỉnh sửa
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleCancelEdit}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-200 font-bold border-2 border-[#191b23] hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
              >
                <X className="w-4 h-4" />
                Hủy
              </button>
              <button
                onClick={handleSaveProfile}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500 text-white font-bold border-2 border-[#191b23] hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
              >
                <Check className="w-4 h-4" />
                Lưu
              </button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Họ và tên</label>
            {isEditing ? (
              <input
                type="text"
                value={tempUserData.name}
                onChange={(e) => setTempUserData({ ...tempUserData, name: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border-2 border-[#191b23] bg-[#ecedf7] dark:bg-[#424754] focus:outline-none focus:border-[#3b82f6]"
              />
            ) : (
              <p className="px-4 py-3 bg-[#ecedf7] dark:bg-[#424754] rounded-xl">{userData.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            {isEditing ? (
              <input
                type="email"
                value={tempUserData.email}
                onChange={(e) => setTempUserData({ ...tempUserData, email: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border-2 border-[#191b23] bg-[#ecedf7] dark:bg-[#424754] focus:outline-none focus:border-[#3b82f6]"
              />
            ) : (
              <p className="px-4 py-3 bg-[#ecedf7] dark:bg-[#424754] rounded-xl">{userData.email}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Số điện thoại</label>
            {isEditing ? (
              <input
                type="tel"
                value={tempUserData.phone}
                onChange={(e) => setTempUserData({ ...tempUserData, phone: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border-2 border-[#191b23] bg-[#ecedf7] dark:bg-[#424754] focus:outline-none focus:border-[#3b82f6]"
              />
            ) : (
              <p className="px-4 py-3 bg-[#ecedf7] dark:bg-[#424754] rounded-xl">{userData.phone}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Giới thiệu</label>
            {isEditing ? (
              <textarea
                value={tempUserData.bio}
                onChange={(e) => setTempUserData({ ...tempUserData, bio: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 rounded-xl border-2 border-[#191b23] bg-[#ecedf7] dark:bg-[#424754] focus:outline-none focus:border-[#3b82f6] resize-none"
              />
            ) : (
              <p className="px-4 py-3 bg-[#ecedf7] dark:bg-[#424754] rounded-xl">{userData.bio}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Settings Tab Component
function SettingsTab({ notifications, setNotifications, language, setLanguage }: any) {
  const LANGUAGES = [
    { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'ar', name: 'العربية', flag: '🇸🇦' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
  ];

  return (
    <div className="max-w-2xl space-y-6">
      {/* Language Settings */}
      <div className="bg-white dark:bg-[#2e3038] rounded-xl border-2 border-[#191b23] p-6">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Languages className="w-5 h-5 text-[#3b82f6]" />
          Ngôn ngữ
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => setLanguage(lang.code as any)}
              className={clsx(
                'flex items-center gap-3 p-4 rounded-xl border-2 transition-all',
                language === lang.code
                  ? 'border-[#3b82f6] bg-[#d8e2ff]'
                  : 'border-[#191b23] hover:bg-[#ecedf7] dark:hover:bg-[#424754]'
              )}
            >
              <span className="text-2xl">{lang.flag}</span>
              <span className="font-medium">{lang.name}</span>
              {language === lang.code && <Check className="w-5 h-5 text-[#3b82f6] ml-auto" />}
            </button>
          ))}
        </div>
      </div>

      {/* Notification Settings */}
      <div className="bg-white dark:bg-[#2e3038] rounded-xl border-2 border-[#191b23] p-6">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5 text-[#3b82f6]" />
          Thông báo
        </h3>
        <div className="space-y-4">
          <ToggleSetting
            label="Email thông báo"
            description="Nhận thông báo qua email"
            checked={notifications.email}
            onChange={(checked) => setNotifications({ ...notifications, email: checked })}
          />
          <ToggleSetting
            label="Push thông báo"
            description="Nhận thông báo trên trình duyệt"
            checked={notifications.push}
            onChange={(checked) => setNotifications({ ...notifications, push: checked })}
          />
          <ToggleSetting
            label="SMS thông báo"
            description="Nhận thông báo qua tin nhắn SMS"
            checked={notifications.sms}
            onChange={(checked) => setNotifications({ ...notifications, sms: checked })}
          />
        </div>
      </div>

      {/* Theme Settings */}
      <div className="bg-white dark:bg-[#2e3038] rounded-xl border-2 border-[#191b23] p-6">
        <h3 className="font-bold text-lg mb-4">Giao diện</h3>
        <div className="flex gap-4">
          <button className="flex-1 p-4 rounded-xl border-2 border-[#3b82f6] bg-white">
            <div className="w-full h-20 bg-[#f9f9ff] rounded-lg mb-2 border" />
            <p className="font-medium text-center">Sáng</p>
          </button>
          <button className="flex-1 p-4 rounded-xl border-2 border-[#191b23] bg-white dark:bg-[#191b23]">
            <div className="w-full h-20 bg-[#191b23] rounded-lg mb-2 border" />
            <p className="font-medium text-center dark:text-white">Tối</p>
          </button>
        </div>
      </div>
    </div>
  );
}

// Toggle Setting Component
function ToggleSetting({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl border-2 border-[#191b23] hover:bg-[#ecedf7] dark:hover:bg-[#424754] transition-colors">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-[#727785]">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={clsx(
          'w-14 h-8 rounded-full border-2 border-[#191b23] relative transition-colors',
          checked ? 'bg-[#3b82f6]' : 'bg-[#ecedf7] dark:bg-[#424754]'
        )}
      >
        <div
          className={clsx(
            'absolute top-0.5 w-6 h-6 rounded-full bg-white border-2 border-[#191b23] transition-all',
            checked ? 'left-7' : 'left-0.5'
          )}
        />
      </button>
    </div>
  );
}

// History Tab Component - Lấy data thật từ backend
function HistoryTab() {
  const { language } = useLanguageStore();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    setLoading(true);
    try {
      const res = await userHistoryApi.list({ limit: 50, search: searchQuery });
      if (res.success === false) {
        // Not logged in
        setConversations([]);
      } else if ('data' in res) {
        setConversations(res.data.conversations || []);
      }
    } catch (err) {
      console.error('Load history error:', err);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }

  // Reload khi search thay đổi
  useEffect(() => {
    const timer = setTimeout(loadHistory, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(language === 'vi' ? 'Xóa cuộc trò chuyện này?' : 'Delete this conversation?')) return;
    try {
      await userHistoryApi.delete(id);
      setConversations((cs) => cs.filter((c) => c.id !== id));
    } catch (err) {
      console.error('Delete error:', err);
    }
  }

  function formatDate(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMin / 60);
    const diffD = Math.floor(diffH / 24);

    if (language === 'vi') {
      if (diffMin < 1) return 'Vừa xong';
      if (diffMin < 60) return `${diffMin} phút trước`;
      if (diffH < 24) return `${diffH} giờ trước`;
      if (diffD < 7) return `${diffD} ngày trước`;
      return d.toLocaleDateString('vi-VN');
    }
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffH < 24) return `${diffH}h ago`;
    if (diffD < 7) return `${diffD}d ago`;
    return d.toLocaleDateString();
  }

  if (loading) {
    return (
      <div className="max-w-2xl flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="max-w-2xl">
        <input
          type="text"
          placeholder={language === 'vi' ? 'Tìm kiếm lịch sử...' : 'Search history...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full mb-4 px-4 py-2 rounded-lg border-2 border-[#191b23] dark:border-[#3a3d48] dark:bg-[#1a1c23] focus:outline-none focus:border-blue-500"
        />
        <div className="bg-white dark:bg-[#2e3038] rounded-xl border-2 border-[#191b23] p-8 text-center">
          <History className="w-12 h-12 mx-auto text-gray-400 mb-3" />
          <p className="text-[#727785]">
            {language === 'vi'
              ? 'Chưa có lịch sử trò chuyện. Hãy bắt đầu chat để lưu lại!'
              : 'No chat history yet. Start chatting to save your conversations!'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      <input
        type="text"
        placeholder={language === 'vi' ? 'Tìm kiếm lịch sử...' : 'Search history...'}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full mb-4 px-4 py-2 rounded-lg border-2 border-[#191b23] dark:border-[#3a3d48] dark:bg-[#1a1c23] focus:outline-none focus:border-blue-500"
      />
      {conversations.map((conv) => (
        <div
          key={conv.id}
          className="bg-white dark:bg-[#2e3038] rounded-xl border-2 border-[#191b23] p-4 hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer"
          onClick={() => navigate(`/chat?conv=${conv.id}`)}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-bold flex items-center gap-2">
                {conv.is_pinned ? <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" /> : null}
                {conv.title}
              </h3>
              <p className="text-sm text-[#727785] mt-1">
                {conv.message_count} {language === 'vi' ? 'tin nhắn' : 'messages'} • {formatDate(conv.updated_at)}
              </p>
              {conv.last_message_preview && (
                <p className="text-xs text-[#727785] mt-2 line-clamp-2 italic">
                  "{conv.last_message_preview}"
                </p>
              )}
            </div>
            <button
              onClick={(e) => handleDelete(conv.id, e)}
              className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              title={language === 'vi' ? 'Xóa' : 'Delete'}
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// Favorites Tab Component - Lấy data thật từ backend
function FavoritesTab() {
  const { language } = useLanguageStore();
  const [favorites, setFavorites] = useState<UserFavorite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFavorites();
  }, []);

  async function loadFavorites() {
    setLoading(true);
    try {
      const res = await userFavoritesApi.list();
      if (res.success === false) {
        setFavorites([]);
      } else if ('data' in res) {
        setFavorites(res.data.favorites || []);
      }
    } catch (err) {
      console.error('Load favorites error:', err);
      setFavorites([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await userFavoritesApi.delete(id);
      setFavorites((fs) => fs.filter((f) => f.id !== id));
    } catch (err) {
      console.error('Delete favorite error:', err);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div className="max-w-2xl">
        <div className="bg-white dark:bg-[#2e3038] rounded-xl border-2 border-[#191b23] p-8 text-center">
          <Star className="w-12 h-12 mx-auto text-gray-400 mb-3" />
          <p className="text-[#727785]">
            {language === 'vi'
              ? 'Chưa có mục yêu thích. Hãy đánh dấu sao các sản phẩm/tiêu chuẩn bạn quan tâm!'
              : 'No favorites yet. Star the products/standards you care about!'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      {favorites.map((item) => (
        <div
          key={item.id}
          className="bg-white dark:bg-[#2e3038] rounded-xl border-2 border-[#191b23] p-4 hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <span className="inline-block px-2 py-1 rounded text-xs font-mono bg-[#d8e2ff] text-[#3b82f6] mb-2">
                {item.item_type}
              </span>
              <h3 className="font-bold">{item.title}</h3>
            </div>
            <button
              onClick={(e) => handleDelete(item.id, e)}
              className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              title={language === 'vi' ? 'Bỏ yêu thích' : 'Unfavorite'}
            >
              <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// Security Tab Component
function SecurityTab() {
  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-white dark:bg-[#2e3038] rounded-xl border-2 border-[#191b23] p-6">
        <h3 className="font-bold text-lg mb-4">Đổi mật khẩu</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Mật khẩu hiện tại</label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl border-2 border-[#191b23] bg-[#ecedf7] dark:bg-[#424754] focus:outline-none focus:border-[#3b82f6]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Mật khẩu mới</label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl border-2 border-[#191b23] bg-[#ecedf7] dark:bg-[#424754] focus:outline-none focus:border-[#3b82f6]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Xác nhận mật khẩu mới</label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl border-2 border-[#191b23] bg-[#ecedf7] dark:bg-[#424754] focus:outline-none focus:border-[#3b82f6]"
            />
          </div>
          <button className="w-full py-3 rounded-xl bg-[#3b82f6] text-white font-bold border-2 border-[#191b23] hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all">
            Cập nhật mật khẩu
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#2e3038] rounded-xl border-2 border-[#191b23] p-6">
        <h3 className="font-bold text-lg mb-4">Xác thực hai yếu tố</h3>
        <p className="text-sm text-[#727785] mb-4">Bảo vệ tài khoản của bạn bằng cách bật xác thực hai yếu tố.</p>
        <button className="px-6 py-3 rounded-xl bg-green-500 text-white font-bold border-2 border-[#191b23] hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all">
          Bật 2FA
        </button>
      </div>
    </div>
  );
}

export default ProfilePage;
