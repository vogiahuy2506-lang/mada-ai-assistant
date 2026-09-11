import React, { useState, useEffect } from 'react';
import { 
  Upload, Image, FileText, Video, Music, File, 
  Save, RefreshCw, CheckCircle, XCircle, Info
} from 'lucide-react';
import clsx from 'clsx';

interface FileSettings {
  // Global feature toggle
  fileAttachmentEnabled: boolean;
  
  // File type toggles
  imageUploadEnabled: boolean;
  documentUploadEnabled: boolean;
  videoUploadEnabled: boolean;
  audioUploadEnabled: boolean;
  otherFileUploadEnabled: boolean;
  
  // Size limits (MB)
  maxFileSizeMB: number;
  maxImageSizeMB: number;
  maxDocumentSizeMB: number;
  maxVideoSizeMB: number;
  maxAudioSizeMB: number;
  maxOtherFileSizeMB: number;
  
  // Quantity limits
  maxFilesPerSession: number;
  maxFilesTotal: number;
  fileUploadLimitFree: number;
  fileUploadLimitPro: number;
  fileUploadLimitEnterprise: number;
}

const FileManagement: React.FC = () => {
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
      const res = await fetch('/api/admin/file-settings', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
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
      const res = await fetch('/api/admin/file-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Settings saved successfully!' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save settings' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save settings' });
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
        'relative w-14 h-7 rounded-full transition-colors flex-shrink-0',
        checked ? 'bg-primary' : 'bg-gray-300',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <span
        className={clsx(
          'absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform',
          checked ? 'left-[26px]' : 'left-0.5'
        )}
      />
    </button>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Quản Lý Upload File</h1>
          <p className="text-gray-500 mt-1">Cấu hình tính năng và giới hạn upload file</p>
        </div>
        <button
          onClick={saveSettings}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className={clsx(
          'flex items-center gap-3 px-4 py-3 rounded-lg',
          message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        )}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      {/* Global Toggle */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Tính Năng Đính Kèm File</h2>
              <p className="text-gray-500 text-sm">Công tắc chính cho tất cả tính năng upload file</p>
            </div>
          </div>
          <ToggleSwitch
            checked={settings.fileAttachmentEnabled}
            onChange={() => updateSetting('fileAttachmentEnabled', !settings.fileAttachmentEnabled)}
          />
        </div>
      </div>

      {/* File Type Toggles */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Info className="w-5 h-5 text-primary" />
          Cài Đặt Loại File
        </h2>
        
        <div className="space-y-4">
          {/* Images */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Image className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium">Upload Hình Ảnh</h3>
                <p className="text-gray-500 text-sm">JPG, JPEG, PNG, WEBP, BMP, TIFF, GIF</p>
              </div>
            </div>
            <ToggleSwitch
              checked={settings.imageUploadEnabled}
              onChange={() => updateSetting('imageUploadEnabled', !settings.imageUploadEnabled)}
              disabled={!settings.fileAttachmentEnabled}
            />
          </div>

          {/* Documents */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-red-100 rounded-lg">
                <FileText className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="font-medium">Upload Tài Liệu</h3>
                <p className="text-gray-500 text-sm">PDF, DOC, DOCX, TXT, MD</p>
              </div>
            </div>
            <ToggleSwitch
              checked={settings.documentUploadEnabled}
              onChange={() => updateSetting('documentUploadEnabled', !settings.documentUploadEnabled)}
              disabled={!settings.fileAttachmentEnabled}
            />
          </div>

          {/* Videos */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Video className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-medium">Upload Video</h3>
                <p className="text-gray-500 text-sm">MP4, AVI, MOV, MKV, WebM</p>
              </div>
            </div>
            <ToggleSwitch
              checked={settings.videoUploadEnabled}
              onChange={() => updateSetting('videoUploadEnabled', !settings.videoUploadEnabled)}
              disabled={!settings.fileAttachmentEnabled}
            />
          </div>

          {/* Audio */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <Music className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-medium">Upload Âm Thanh</h3>
                <p className="text-gray-500 text-sm">MP3, WAV, AAC, OGG, M4A</p>
              </div>
            </div>
            <ToggleSwitch
              checked={settings.audioUploadEnabled}
              onChange={() => updateSetting('audioUploadEnabled', !settings.audioUploadEnabled)}
              disabled={!settings.fileAttachmentEnabled}
            />
          </div>

          {/* Other Files */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-orange-100 rounded-lg">
                <File className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h3 className="font-medium">Các Loại File Khác</h3>
                <p className="text-gray-500 text-sm">ZIP, RAR, CSV, XLSX, JSON, XML</p>
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
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Info className="w-5 h-5 text-primary" />
          Giới Hạn Dung Lượng (MB)
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Image className="w-4 h-4 text-blue-600" /> Hình Ảnh
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={settings.maxImageSizeMB}
              onChange={(e) => updateSetting('maxImageSizeMB', parseInt(e.target.value) || 1)}
              disabled={!settings.fileAttachmentEnabled || !settings.imageUploadEnabled}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <FileText className="w-4 h-4 text-red-600" /> Tài Liệu
            </label>
            <input
              type="number"
              min="1"
              max="200"
              value={settings.maxDocumentSizeMB}
              onChange={(e) => updateSetting('maxDocumentSizeMB', parseInt(e.target.value) || 1)}
              disabled={!settings.fileAttachmentEnabled || !settings.documentUploadEnabled}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Video className="w-4 h-4 text-purple-600" /> Video
            </label>
            <input
              type="number"
              min="1"
              max="500"
              value={settings.maxVideoSizeMB}
              onChange={(e) => updateSetting('maxVideoSizeMB', parseInt(e.target.value) || 1)}
              disabled={!settings.fileAttachmentEnabled || !settings.videoUploadEnabled}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Music className="w-4 h-4 text-green-600" /> Âm Thanh
            </label>
            <input
              type="number"
              min="1"
              max="200"
              value={settings.maxAudioSizeMB}
              onChange={(e) => updateSetting('maxAudioSizeMB', parseInt(e.target.value) || 1)}
              disabled={!settings.fileAttachmentEnabled || !settings.audioUploadEnabled}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <File className="w-4 h-4 text-orange-600" /> File Khác
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={settings.maxOtherFileSizeMB}
              onChange={(e) => updateSetting('maxOtherFileSizeMB', parseInt(e.target.value) || 1)}
              disabled={!settings.fileAttachmentEnabled || !settings.otherFileUploadEnabled}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Upload className="w-4 h-4 text-primary" /> Tổng Max
            </label>
            <input
              type="number"
              min="1"
              max="500"
              value={settings.maxFileSizeMB}
              onChange={(e) => updateSetting('maxFileSizeMB', parseInt(e.target.value) || 1)}
              disabled={!settings.fileAttachmentEnabled}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      {/* Upload Limits by Plan */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Info className="w-5 h-5 text-primary" />
          Giới Hạn Upload Theo Plan (File/tháng)
        </h2>
        <p className="text-gray-500 text-sm mb-4">Set to 0 for unlimited uploads</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Free Plan</label>
            <input
              type="number"
              min="0"
              value={settings.fileUploadLimitFree}
              onChange={(e) => updateSetting('fileUploadLimitFree', parseInt(e.target.value) || 0)}
              disabled={!settings.fileAttachmentEnabled}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-gray-500">0 = Unlimited</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Pro Plan</label>
            <input
              type="number"
              min="0"
              value={settings.fileUploadLimitPro}
              onChange={(e) => updateSetting('fileUploadLimitPro', parseInt(e.target.value) || 0)}
              disabled={!settings.fileAttachmentEnabled}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-gray-500">0 = Unlimited</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Enterprise Plan</label>
            <input
              type="number"
              min="0"
              value={settings.fileUploadLimitEnterprise}
              onChange={(e) => updateSetting('fileUploadLimitEnterprise', parseInt(e.target.value) || 0)}
              disabled={!settings.fileAttachmentEnabled}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-gray-500">0 = Unlimited</p>
          </div>
        </div>
      </div>

      {/* Session Limits */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Info className="w-5 h-5 text-primary" />
          Giới Hạn Phiên & Tổng
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Max Files Per Session</label>
            <input
              type="number"
              min="1"
              max="100"
              value={settings.maxFilesPerSession}
              onChange={(e) => updateSetting('maxFilesPerSession', parseInt(e.target.value) || 1)}
              disabled={!settings.fileAttachmentEnabled}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-gray-500">Maximum files allowed in one chat session</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Max Total Files</label>
            <input
              type="number"
              min="1"
              max="1000"
              value={settings.maxFilesTotal}
              onChange={(e) => updateSetting('maxFilesTotal', parseInt(e.target.value) || 1)}
              disabled={!settings.fileAttachmentEnabled}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-gray-500">Maximum files user can upload in total</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Hành Động Nhanh</h2>
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
            className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Enable All
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
            className="px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Disable All Types
          </button>
          <button
            onClick={loadSettings}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Reset to Saved
          </button>
        </div>
      </div>
    </div>
  );
};

export default FileManagement;
