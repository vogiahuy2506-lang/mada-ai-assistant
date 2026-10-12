import { useState } from 'react';
import AttachmentModal from '../components/ui/AttachmentModal';

const AttachmentDemo = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSelectOption = (option: 'document' | 'image' | 'camera' | 'ocr') => {
    console.log('Selected option:', option);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-slate-100 flex items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-800 mb-4">
          Demo Modal Đính kèm tệp & Dữ liệu
        </h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-brand px-6 py-3 text-base"
        >
          Mở Modal Đính kèm
        </button>
      </div>

      <AttachmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelectOption={handleSelectOption}
      />
    </div>
  );
};

export default AttachmentDemo;
