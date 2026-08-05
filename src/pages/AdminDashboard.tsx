import { useState } from 'react';
import { useThemeStore } from '@/stores';
import {
  LayoutDashboard, Users, Shield, Bot, FileText, Settings,
  BarChart3, Database, ChevronLeft, ChevronRight,
  Activity, CheckCircle, Clock, TrendingUp,
  Moon, Sun, Bell, Search, Plus
} from 'lucide-react';
import clsx from 'clsx';
import { RobotLogo } from '@/components/icons/RobotLogo';

const SIDEBAR_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/admin' },
  { icon: Users, label: 'Users', href: '/admin/users' },
  { icon: Shield, label: 'Roles', href: '/admin/roles' },
  { icon: Bot, label: 'AI Agents', href: '/admin/ai' },
  { icon: FileText, label: 'Logs', href: '/admin/logs' },
  { icon: BarChart3, label: 'Stats', href: '/admin/stats' },
  { icon: Database, label: 'Deploy', href: '/admin/deploy' },
  { icon: Settings, label: 'Settings', href: '/admin/settings' },
];

const STATS_CARDS = [
  { label: 'Total Users', value: '2,847', change: '+12%', icon: Users, color: 'bg-[#3b82f6]' },
  { label: 'AI Conversations', value: '18,392', change: '+8%', icon: Bot, color: 'bg-[#8127cf]' },
  { label: 'Avg Response', value: '1.2s', change: '-15%', icon: Activity, color: 'bg-[#924700]' },
  { label: 'System Uptime', value: '99.9%', change: 'Stable', icon: CheckCircle, color: 'bg-[#22c55e]' },
];

const RECENT_ACTIVITIES = [
  { user: 'Nguyễn Văn A', action: 'Started conversation', time: '2 min ago', type: 'chat' },
  { user: 'Trần Thị B', action: 'Request consultation', time: '5 min ago', type: 'request' },
  { user: 'Lê Văn C', action: 'Searched: hearing devices', time: '8 min ago', type: 'search' },
  { user: 'Phạm Thị D', action: 'Viewed ISO standards', time: '12 min ago', type: 'view' },
  { user: 'Hoàng Văn E', action: 'Saved favorites', time: '15 min ago', type: 'save' },
];

export function AdminDashboard() {
  const { isDark, toggleTheme } = useThemeStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="flex h-screen bg-[#f9f9ff] dark:bg-[#191b23]">
      {/* Sidebar */}
      <aside
        className={clsx(
          'h-full bg-white dark:bg-[#2e3038] border-r-2 border-[#191b23] flex flex-col transition-all duration-300',
          sidebarCollapsed ? 'w-20' : 'w-64'
        )}
      >
        {/* Logo */}
        <div className="p-4 border-b-2 border-[#191b23]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#3b82f6] flex items-center justify-center neo-brutalist-shadow-sm p-1.5">
              <RobotLogo variant="white" className="w-full h-full" />
            </div>
            {!sidebarCollapsed && (
              <div>
                <h1 className="font-black text-lg">MADA AI</h1>
                <span className="text-xs text-[#727785]">Admin Panel</span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {SIDEBAR_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setActiveTab(item.label.toLowerCase())}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all',
                activeTab === item.label.toLowerCase()
                  ? 'bg-[#3b82f6] text-white font-bold border-2 border-[#191b23]'
                  : 'hover:bg-[#ecedf7] dark:hover:bg-[#424754] text-[#424754] dark:text-[#c2c6d6]'
              )}
            >
              <item.icon className="w-5 h-5" />
              {!sidebarCollapsed && <span className="text-sm">{item.label}</span>}
            </a>
          ))}
        </nav>

        {/* Collapse Button */}
        <div className="p-3 border-t-2 border-[#191b23]">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl hover:bg-[#ecedf7] dark:hover:bg-[#424754] transition-colors"
          >
            {sidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            {!sidebarCollapsed && <span className="text-sm">Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-16 border-b-2 border-[#191b23] flex items-center justify-between px-6 bg-white dark:bg-[#2e3038]">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[#727785]" />
              <input
                type="text"
                placeholder="Search..."
                className="pl-10 pr-4 py-2 rounded-xl border-2 border-[#191b23] bg-[#ecedf7] dark:bg-[#424754] focus:outline-none focus:border-[#3b82f6] text-sm w-64"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="relative p-2 rounded-xl hover:bg-[#ecedf7] dark:hover:bg-[#424754] transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl hover:bg-[#ecedf7] dark:hover:bg-[#424754] transition-colors"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            <div className="flex items-center gap-3 pl-3 border-l-2 border-[#191b23]">
              <div className="w-10 h-10 rounded-full bg-[#3b82f6] flex items-center justify-center">
                <span className="font-bold text-white">AD</span>
              </div>
              <div className="hidden md:block">
                <p className="font-bold text-sm">Admin</p>
                <p className="text-xs text-[#727785]">Super Admin</p>
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-black">Dashboard</h1>
              <p className="text-[#727785] text-sm">Hệ thống hoạt động ổn định</p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-[#3b82f6] text-white rounded-xl font-bold border-2 border-[#191b23] hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all">
              <Plus className="w-5 h-5" />
              Thêm mới
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {STATS_CARDS.map((stat, index) => (
              <div
                key={index}
                className="bg-white dark:bg-[#2e3038] rounded-xl border-2 border-[#191b23] p-5 neo-brutalist-shadow-sm hover:-translate-y-1 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-mono uppercase text-[#727785] mb-1">{stat.label}</p>
                    <p className="text-2xl font-black">{stat.value}</p>
                    <p className="text-xs font-medium text-green-500 mt-1 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      {stat.change}
                    </p>
                  </div>
                  <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center', stat.color)}>
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Activity */}
            <div className="lg:col-span-2 bg-white dark:bg-[#2e3038] rounded-xl border-2 border-[#191b23] overflow-hidden">
              <div className="p-4 border-b-2 border-[#191b23] flex items-center justify-between">
                <h2 className="font-bold">Hoạt động gần đây</h2>
                <button className="text-sm text-[#3b82f6] hover:underline">Xem tất cả</button>
              </div>
              <div className="divide-y divide-[#ecedf7] dark:divide-[#424754]">
                {RECENT_ACTIVITIES.map((activity, index) => (
                  <div key={index} className="flex items-center gap-4 p-4 hover:bg-[#ecedf7] dark:hover:bg-[#424754] transition-colors">
                    <div className="w-10 h-10 rounded-full bg-[#d8e2ff] flex items-center justify-center">
                      <span className="font-bold text-[#3b82f6] text-sm">
                        {activity.user.split(' ').pop()?.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{activity.user}</p>
                      <p className="text-xs text-[#727785]">{activity.action}</p>
                    </div>
                    <span className="text-xs text-[#727785] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {activity.time}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white dark:bg-[#2e3038] rounded-xl border-2 border-[#191b23] overflow-hidden">
              <div className="p-4 border-b-2 border-[#191b23]">
                <h2 className="font-bold">Thao tác nhanh</h2>
              </div>
              <div className="p-4 space-y-3">
                <button className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-[#191b23] hover:bg-[#ecedf7] dark:hover:bg-[#424754] transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-[#3b82f6] flex items-center justify-center">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-sm">Quản lý AI Agents</p>
                    <p className="text-xs text-[#727785]">Cấu hình chatbot</p>
                  </div>
                </button>

                <button className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-[#191b23] hover:bg-[#ecedf7] dark:hover:bg-[#424754] transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-[#8127cf] flex items-center justify-center">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-sm">Quản lý Users</p>
                    <p className="text-xs text-[#727785]">Phân quyền người dùng</p>
                  </div>
                </button>

                <button className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-[#191b23] hover:bg-[#ecedf7] dark:hover:bg-[#424754] transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-[#924700] flex items-center justify-center">
                    <Database className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-sm">Deploy System</p>
                    <p className="text-xs text-[#727785]">Cập nhật phiên bản</p>
                  </div>
                </button>

                <button className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-[#191b23] hover:bg-[#ecedf7] dark:hover:bg-[#424754] transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-[#22c55e] flex items-center justify-center">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-sm">Xem Logs</p>
                    <p className="text-xs text-[#727785]">Nhật ký hệ thống</p>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* System Status */}
          <div className="mt-6 bg-white dark:bg-[#2e3038] rounded-xl border-2 border-[#191b23] p-4">
            <h2 className="font-bold mb-4">Trạng thái hệ thống</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-sm">API Server</span>
                <span className="text-xs text-green-500 ml-auto">Online</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-sm">Database</span>
                <span className="text-xs text-green-500 ml-auto">Connected</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-sm">AI Engine</span>
                <span className="text-xs text-green-500 ml-auto">Active</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-sm">Cache</span>
                <span className="text-xs text-green-500 ml-auto">Ready</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
