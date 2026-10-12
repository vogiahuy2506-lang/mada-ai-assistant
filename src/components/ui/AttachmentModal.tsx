import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface AttachmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectOption: (option: 'document' | 'image' | 'camera' | 'ocr') => void;
}

const AttachmentModal = ({ isOpen, onClose, onSelectOption }: AttachmentModalProps) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isVisible) return null;

  const handleOptionClick = (option: 'document' | 'image' | 'camera' | 'ocr') => {
    setSelectedOption(option);
    onSelectOption(option);
    onClose();
  };

  const options = [
    {
      id: 'document' as const,
      title: 'Tải tài liệu lên',
      description: 'PDF, DOCX, XLSX, TXT',
      icon: (
        <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
      bgColor: 'bg-blue-500',
    },
    {
      id: 'image' as const,
      title: 'Tải hình ảnh',
      description: 'PNG, JPG, DICOM thumbnails',
      icon: (
        <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      ),
      bgColor: 'bg-pink-500',
    },
    {
      id: 'camera' as const,
      title: 'Chụp ảnh trực tiếp',
      description: 'Camera scan medicine, device',
      icon: (
        <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      ),
      bgColor: 'bg-green-500',
    },
    {
      id: 'ocr' as const,
      title: 'Quét văn bản OCR',
      description: 'Near/far vision & color blind test',
      icon: (
        <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="4 7 4 4 20 4 20 7" />
          <line x1="9" y1="20" x2="15" y2="20" />
          <line x1="12" y1="4" x2="12" y2="20" />
          <path d="M4 14h6v6" />
          <path d="M20 14h-6v6" />
          <path d="M4 14v-4h4" />
          <path d="M20 14v-4h-4" />
        </svg>
      ),
      bgColor: 'bg-orange-500',
    },
  ];

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ 
        backgroundColor: 'rgba(0,0,0,0.3)', 
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)'
      }}
      onClick={onClose}
    >
      {/* Modal Container */}
      <div 
        className="relative w-full max-w-lg mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden"
        style={{
          animation: 'slideUp 0.25s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-6 pt-6 pb-5 border-b border-slate-100">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            <svg className="w-5 h-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          <h2 className="text-lg font-semibold text-slate-800 pr-10">
            Đính kèm tệp & Dữ liệu
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Hỗ trợ tối đa 50MB
          </p>
        </div>

        {/* Options Container - Using flex-col with gap */}
        <div className="flex flex-col gap-3 p-6">
          {options.map((option, index) => (
            <button
              key={option.id}
              onClick={() => handleOptionClick(option.id)}
              className={`
                w-full flex items-center gap-4 p-4 rounded-2xl border-2 
                transition-all duration-200 hover:scale-[1.01] hover:shadow-lg
                active:scale-[0.99]
                ${selectedOption === option.id
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-slate-100 bg-white hover:border-slate-200'
                }
              `}
              style={{ marginBottom: index < options.length - 1 ? '0' : '0' }}
            >
              {/* Icon Container */}
              <div 
                className={`${option.bgColor} w-14 h-14 rounded-xl flex items-center justify-center text-white flex-shrink-0`}
              >
                {option.icon}
              </div>

              {/* Text Content */}
              <div className="text-left flex-1 min-w-0">
                <p className="font-semibold text-slate-800 text-base leading-tight">
                  {option.title}
                </p>
                <p className="text-xs text-slate-500 mt-1 leading-snug">
                  {option.description}
                </p>
              </div>

              {/* Arrow Icon */}
              <svg 
                className="w-5 h-5 text-slate-300 flex-shrink-0" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* CSS Keyframes */}
      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>,
    document.body
  );
};

export default AttachmentModal;
