import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Upload, Image, FileText, Video, Music, File, 
  Save, RefreshCw, CheckCircle, XCircle, Info, 
  ArrowLeft, Loader2, AlertTriangle
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import clsx from 'clsx';

interface FileSettings {
  fileAttachmentEnabled: boolean;
  imageUploadEnabled: boolean;
  documentUploadEnabled: boolean;
  videoUploadEnabled: boolean;
  audioUploadEnabled: boolean;
  otherFileUploadEnabled: boolean;
  maxFileSizeMB: number;
  maxImageSizeMB: number;
  maxDocumentSizeMB: number;
  maxVideoSizeMB: number;
  maxAudioSizeMB: number;
  maxOtherFileSizeMB: number;
  maxFilesPerSession: number;
  maxFilesTotal: number;
  fileUploadLimitFree: number;
  fileUploadLimitPro: number;
  fileUploadLimitEnterprise: number;
}

const FileManagement: React.FC = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<FileSettings>({
    fileAttachmentEnabled: true,
    imageUploadEnabled: true,
    documentUploadEnabled: true,
    videoUploadEnabled: true,
    audioUploadEnabled: true,
    otherFileUploadEnabled: true,
    maxFileSizeMB: 50,
    maxImageSizeMB: 10,
    maxDocumentSizeMB: 50,
    maxVideoSizeMB: 100,
    maxAudioSizeMB: 50,
    maxOtherFileSizeMB: 25,
    maxFilesPerSession: 10,
    maxFilesTotal: 100,
    fileUploadLimitFree: 10,
    fileUploadLimitPro: 0,
    fileUploadLimitEnterprise: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const token = localStorage.getItem('mada-access-token') || localStorage.getItem('token');
      const res = await fetch('/api/admin/file-settings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setSettings(prev => ({ ...prev, ...data.data }));
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const token = localStorage.getItem('mada-access-token') || localStorage.getItem('token');
      const res = await fetch('/api/admin/file-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Cài đặt đã được lưu thành công!' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Không thể lưu cài đặt' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Đã xảy ra lỗi khi lưu cài đặt' });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof FileSettings>(key: K, value: FileSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const ToggleSwitch = ({ 
    checked, 
    onChange, 
    disabled = false 
  }: { 
    checked: boolean; 
    onChange: () => void; 
    disabled?: boolean;
  }) => (
    <button
      onClick={onChange}
      disabled={disabled}
      className={clsx(
        'relative w-14 h-7 rounded-full transition-colors border-2 border-black',
        checked ? 'bg-emerald-500' : 'bg-slate-300',
        disabled && 'opacity-40 cursor-not-allowed'
      )}
    >
      <span
        className={clsx(
          'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform',
          checked ? 'left-[22px]' : 'left-0.5'
        )}
      />
    </button>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <AdminLayout
      title="Quản Lý Upload File"
      titleEn="File Management"
      titleAr="إدارة الملفات"
      titleFr="Gestion des fichiers"
      subtitle="Cấu hình tính năng và giới hạn upload file cho người dùng."
      subtitleEn="Configure file upload features and limits for users."
      subtitleAr="تكوين ميزات وحlimits تحميل الملفات للمستخدمين."
      subtitleFr="Configurer les fonctionnalités et limites de téléchargement."
      showFab={false}
      showLayoutTitle={false}
    >
      {/* Hero Banner - Match AdminUsers style */}
      <section className="mb-8">
        <div className="flex justify-between items-end mb-6 relative gap-4 flex-wrap">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-white to-teal-500/10 backdrop-blur-xl rounded-3xl"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent rounded-3xl"></div>
          <div className="max-w-2xl relative z-10 py-6 px-6">
            <h2 className="text-3xl md:text-4xl font-black text-on-surface mb-2 tracking-tight">
              Quản Lý Upload File
            </h2>
            <p className="text-sm md:text-base font-medium text-on-surface-variant border-l-4 border-emerald-500 pl-4 py-1 bg-white/40 backdrop-blur-sm rounded-r-xl">
              Cấu hình tính năng và <b>giới hạn upload file</b> cho người dùng.
            </p>
          </div>
          <div className="relative z-10 py-6 px-6">
            <button
              onClick={saveSettings}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-sm border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:shadow-[5px_5px_0px_0px_#000] hover:-translate-x-[1px] hover:-translate-y-[1px] transition-all disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> 
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Lưu Thay Đổi</span>
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Message */}
      {message && (
        <div className={clsx(
          'flex items-center gap-3 px-4 py-3 rounded-xl border-2',
          message.type === 'success' 
            ? 'bg-emerald-100 text-emerald-700 border-emerald-300' 
            : 'bg-red-100 text-red-700 border-red-300'
        )}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      {/* Global Toggle */}
      <div className="bg-white rounded-xl border-2 border-black p-5 shadow-[2px_2px_0px_0px_#000] mb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center border-2 border-black">
              <Upload className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-black">Tính Năng Đính Kèm File</h2>
              <p className="text-sm text-slate-500">Công tắc chính cho tất cả tính năng upload file</p>
            </div>
          </div>
          <ToggleSwitch
            checked={settings.fileAttachmentEnabled}
            onChange={() => updateSetting('fileAttachmentEnabled', !settings.fileAttachmentEnabled)}
          />
        </div>
      </div>

      {/* File Type Toggles */}
      <div className="bg-white rounded-xl border-2 border-black p-5 shadow-[2px_2px_0px_0px_#000] mb-5">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2 uppercase tracking-wider">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center border-2 border-black">
            <Info className="w-4 h-4 text-white" />
          </div>
          Cài Đặt Loại File
        </h2>
        
        <div className="space-y-3">
          {/* Images */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-blue-50 border-2 border-black hover:border-blue-400 hover:bg-blue-100 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center border-2 border-black">
                <Image className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Upload Hình Ảnh</h3>
                <p className="text-sm text-slate-500">JPG, JPEG, PNG, WEBP, BMP, TIFF, GIF</p>
              </div>
            </div>
            <ToggleSwitch
              checked={settings.imageUploadEnabled}
              onChange={() => updateSetting('imageUploadEnabled', !settings.imageUploadEnabled)}
              disabled={!settings.fileAttachmentEnabled}
            />
          </div>

          {/* Documents */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-red-50 border-2 border-black hover:border-red-400 hover:bg-red-100 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center border-2 border-black">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Upload Tài Liệu</h3>
                <p className="text-sm text-slate-500">PDF, DOC, DOCX, TXT, MD</p>
              </div>
            </div>
            <ToggleSwitch
              checked={settings.documentUploadEnabled}
              onChange={() => updateSetting('documentUploadEnabled', !settings.documentUploadEnabled)}
              disabled={!settings.fileAttachmentEnabled}
            />
          </div>

          {/* Videos */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-purple-50 border-2 border-black hover:border-purple-400 hover:bg-purple-100 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center border-2 border-black">
                <Video className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Upload Video</h3>
                <p className="text-sm text-slate-500">MP4, AVI, MOV, MKV, WebM</p>
              </div>
            </div>
            <ToggleSwitch
              checked={settings.videoUploadEnabled}
              onChange={() => updateSetting('videoUploadEnabled', !settings.videoUploadEnabled)}
              disabled={!settings.fileAttachmentEnabled}
            />
          </div>

          {/* Audio */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-green-50 border-2 border-black hover:border-green-400 hover:bg-green-100 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center border-2 border-black">
                <Music className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Upload Âm Thanh</h3>
                <p className="text-sm text-slate-500">MP3, WAV, AAC, OGG, M4A</p>
              </div>
            </div>
            <ToggleSwitch
              checked={settings.audioUploadEnabled}
              onChange={() => updateSetting('audioUploadEnabled', !settings.audioUploadEnabled)}
              disabled={!settings.fileAttachmentEnabled}
            />
          </div>

          {/* Other Files */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-orange-50 border-2 border-black hover:border-orange-400 hover:bg-orange-100 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center border-2 border-black">
                <File className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Các Loại File Khác</h3>
                <p className="text-sm text-slate-500">ZIP, RAR, CSV, XLSX, JSON, XML</p>
              </div>
            </div>
            <ToggleSwitch
              checked={settings.otherFileUploadEnabled}
              onChange={() => updateSetting('otherFileUploadEnabled', !settings.otherFileUploadEnabled)}
              disabled={!settings.fileAttachmentEnabled}
            />
          </div>
        </div>
      </div>

      {/* File Size Limits */}
      <div className="bg-white rounded-xl border-2 border-black p-5 shadow-[2px_2px_0px_0px_#000] mb-5">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2 uppercase tracking-wider">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center border-2 border-black">
            <Info className="w-4 h-4 text-white" />
          </div>
          Giới Hạn Dung Lượng (MB)
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2 p-4 rounded-xl bg-blue-50 border-2 border-black">
            <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Image className="w-4 h-4 text-blue-600" /> Hình Ảnh
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={settings.maxImageSizeMB}
              onChange={(e) => updateSetting('maxImageSizeMB', parseInt(e.target.value) || 1)}
              disabled={!settings.fileAttachmentEnabled || !settings.imageUploadEnabled}
              className="w-full px-4 py-2.5 rounded-lg border-2 border-black focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed bg-white font-medium text-sm"
            />
          </div>

          <div className="space-y-2 p-4 rounded-xl bg-red-50 border-2 border-black">
            <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-red-600" /> Tài Liệu
            </label>
            <input
              type="number"
              min="1"
              max="200"
              value={settings.maxDocumentSizeMB}
              onChange={(e) => updateSetting('maxDocumentSizeMB', parseInt(e.target.value) || 1)}
              disabled={!settings.fileAttachmentEnabled || !settings.documentUploadEnabled}
              className="w-full px-4 py-2.5 rounded-lg border-2 border-black focus:ring-2 focus:ring-red-500 disabled:bg-slate-100 disabled:cursor-not-allowed bg-white font-medium text-sm"
            />
          </div>

          <div className="space-y-2 p-4 rounded-xl bg-purple-50 border-2 border-black">
            <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Video className="w-4 h-4 text-purple-600" /> Video
            </label>
            <input
              type="number"
              min="1"
              max="500"
              value={settings.maxVideoSizeMB}
              onChange={(e) => updateSetting('maxVideoSizeMB', parseInt(e.target.value) || 1)}
              disabled={!settings.fileAttachmentEnabled || !settings.videoUploadEnabled}
              className="w-full px-4 py-2.5 rounded-lg border-2 border-black focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100 disabled:cursor-not-allowed bg-white font-medium text-sm"
            />
          </div>

          <div className="space-y-2 p-4 rounded-xl bg-green-50 border-2 border-black">
            <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Music className="w-4 h-4 text-green-600" /> Âm Thanh
            </label>
            <input
              type="number"
              min="1"
              max="200"
              value={settings.maxAudioSizeMB}
              onChange={(e) => updateSetting('maxAudioSizeMB', parseInt(e.target.value) || 1)}
              disabled={!settings.fileAttachmentEnabled || !settings.audioUploadEnabled}
              className="w-full px-4 py-2.5 rounded-lg border-2 border-black focus:ring-2 focus:ring-green-500 disabled:bg-slate-100 disabled:cursor-not-allowed bg-white font-medium text-sm"
            />
          </div>

          <div className="space-y-2 p-4 rounded-xl bg-orange-50 border-2 border-black">
            <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <File className="w-4 h-4 text-orange-600" /> File Khác
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={settings.maxOtherFileSizeMB}
              onChange={(e) => updateSetting('maxOtherFileSizeMB', parseInt(e.target.value) || 1)}
              disabled={!settings.fileAttachmentEnabled || !settings.otherFileUploadEnabled}
              className="w-full px-4 py-2.5 rounded-lg border-2 border-black focus:ring-2 focus:ring-orange-500 disabled:bg-slate-100 disabled:cursor-not-allowed bg-white font-medium text-sm"
            />
          </div>

          <div className="space-y-2 p-4 rounded-xl bg-teal-50 border-2 border-black">
            <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Upload className="w-4 h-4 text-teal-600" /> Tổng Max
            </label>
            <input
              type="number"
              min="1"
              max="500"
              value={settings.maxFileSizeMB}
              onChange={(e) => updateSetting('maxFileSizeMB', parseInt(e.target.value) || 1)}
              disabled={!settings.fileAttachmentEnabled}
              className="w-full px-4 py-2.5 rounded-lg border-2 border-black focus:ring-2 focus:ring-teal-500 disabled:bg-slate-100 disabled:cursor-not-allowed bg-white font-medium text-sm"
            />
          </div>
        </div>
      </div>

      {/* Upload Limits by Plan */}
      <div className="bg-white rounded-xl border-2 border-black p-5 shadow-[2px_2px_0px_0px_#000] mb-5">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2 uppercase tracking-wider">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center border-2 border-black">
            <Info className="w-4 h-4 text-white" />
          </div>
          Giới Hạn Upload Theo Plan (File/tháng)
        </h2>
        <p className="text-sm text-slate-500 mb-4">Đặt 0 = Không giới hạn</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2 p-4 rounded-xl bg-slate-50 border-2 border-black">
            <label className="text-sm font-bold text-slate-900">Free Plan</label>
            <input
              type="number"
              min="0"
              value={settings.fileUploadLimitFree}
              onChange={(e) => updateSetting('fileUploadLimitFree', parseInt(e.target.value) || 0)}
              disabled={!settings.fileAttachmentEnabled}
              className="w-full px-4 py-2.5 rounded-lg border-2 border-black focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 disabled:cursor-not-allowed bg-white font-medium text-sm"
            />
            <p className="text-xs text-slate-500">0 = Không giới hạn</p>
          </div>

          <div className="space-y-2 p-4 rounded-xl bg-amber-50 border-2 border-black">
            <label className="text-sm font-bold text-slate-900">Pro Plan</label>
            <input
              type="number"
              min="0"
              value={settings.fileUploadLimitPro}
              onChange={(e) => updateSetting('fileUploadLimitPro', parseInt(e.target.value) || 0)}
              disabled={!settings.fileAttachmentEnabled}
              className="w-full px-4 py-2.5 rounded-lg border-2 border-black focus:ring-2 focus:ring-amber-500 disabled:bg-slate-100 disabled:cursor-not-allowed bg-white font-medium text-sm"
            />
            <p className="text-xs text-slate-500">0 = Không giới hạn</p>
          </div>

          <div className="space-y-2 p-4 rounded-xl bg-purple-50 border-2 border-black">
            <label className="text-sm font-bold text-slate-900">Enterprise Plan</label>
            <input
              type="number"
              min="0"
              value={settings.fileUploadLimitEnterprise}
              onChange={(e) => updateSetting('fileUploadLimitEnterprise', parseInt(e.target.value) || 0)}
              disabled={!settings.fileAttachmentEnabled}
              className="w-full px-4 py-2.5 rounded-lg border-2 border-black focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100 disabled:cursor-not-allowed bg-white font-medium text-sm"
            />
            <p className="text-xs text-slate-500">0 = Không giới hạn</p>
          </div>
        </div>
      </div>

      {/* Session Limits */}
      <div className="bg-white rounded-xl border-2 border-black p-5 shadow-[2px_2px_0px_0px_#000] mb-5">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2 uppercase tracking-wider">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center border-2 border-black">
            <Info className="w-4 h-4 text-white" />
          </div>
          Giới Hạn Phiên & Tổng
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 p-4 rounded-xl bg-cyan-50 border-2 border-black">
            <label className="text-sm font-bold text-slate-900">Max Files Per Session</label>
            <input
              type="number"
              min="1"
              max="100"
              value={settings.maxFilesPerSession}
              onChange={(e) => updateSetting('maxFilesPerSession', parseInt(e.target.value) || 1)}
              disabled={!settings.fileAttachmentEnabled}
              className="w-full px-4 py-2.5 rounded-lg border-2 border-black focus:ring-2 focus:ring-cyan-500 disabled:bg-slate-100 disabled:cursor-not-allowed bg-white font-medium text-sm"
            />
            <p className="text-xs text-slate-500">Số file tối đa trong một phiên chat</p>
          </div>

          <div className="space-y-2 p-4 rounded-xl bg-indigo-50 border-2 border-black">
            <label className="text-sm font-bold text-slate-900">Max Total Files</label>
            <input
              type="number"
              min="1"
              max="1000"
              value={settings.maxFilesTotal}
              onChange={(e) => updateSetting('maxFilesTotal', parseInt(e.target.value) || 1)}
              disabled={!settings.fileAttachmentEnabled}
              className="w-full px-4 py-2.5 rounded-lg border-2 border-black focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:cursor-not-allowed bg-white font-medium text-sm"
            />
            <p className="text-xs text-slate-500">Tổng số file tối đa người dùng có thể upload</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border-2 border-black p-5 shadow-[2px_2px_0px_0px_#000]">
        <h2 className="text-lg font-bold text-slate-900 mb-4 uppercase tracking-wider">Hành Động Nhanh</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setSettings({
              ...settings,
              fileAttachmentEnabled: true,
              imageUploadEnabled: true,
              documentUploadEnabled: true,
              videoUploadEnabled: true,
              audioUploadEnabled: true,
              otherFileUploadEnabled: true,
            })}
            disabled={!settings.fileAttachmentEnabled}
            className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:from-emerald-400 hover:to-teal-400 transition-all border-2 border-black shadow-[3px_3px_0px_0px_#000] disabled:opacity-50 disabled:cursor-not-allowed font-bold flex items-center gap-2 hover:-translate-x-[1px] hover:-translate-y-[1px]"
          >
            <CheckCircle className="w-4 h-4" /> Bật Tất Cả
          </button>
          <button
            onClick={() => setSettings({
              ...settings,
              imageUploadEnabled: false,
              documentUploadEnabled: false,
              videoUploadEnabled: false,
              audioUploadEnabled: false,
              otherFileUploadEnabled: false,
            })}
            disabled={!settings.fileAttachmentEnabled}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-white rounded-xl hover:from-amber-400 hover:to-yellow-400 transition-all border-2 border-black shadow-[3px_3px_0px_0px_#000] disabled:opacity-50 disabled:cursor-not-allowed font-bold flex items-center gap-2 hover:-translate-x-[1px] hover:-translate-y-[1px]"
          >
            <XCircle className="w-4 h-4" /> Tắt Tất Cả Loại File
          </button>
          <button
            onClick={loadSettings}
            className="px-5 py-2.5 bg-gradient-to-r from-slate-500 to-gray-500 text-white rounded-xl hover:from-slate-400 hover:to-gray-400 transition-all border-2 border-black shadow-[3px_3px_0px_0px_#000] font-bold flex items-center gap-2 hover:-translate-x-[1px] hover:-translate-y-[1px]"
          >
            <RefreshCw className="w-4 h-4" /> Khôi Phục Mặc Định
          </button>
        </div>
      </div>
    </AdminLayout>
  );
};

export default FileManagement;
