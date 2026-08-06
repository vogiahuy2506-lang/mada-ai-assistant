import { Header, Footer } from '@/components';
import { AuthModal } from '@/components/auth/AuthModal';
import { PaywallModal } from '@/components/auth/PaywallModal';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 overflow-x-hidden">
      <Header />

      {/* Hero Section */}
      <main className="relative w-full min-h-screen flex items-center justify-center pt-24 pb-16 px-6 md:px-12">
        {/* Background gradient */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-30 bg-gradient-to-br from-violet-100 via-blue-50 to-white" />

        <div className="relative z-10 w-full max-w-6xl mx-auto">
          {/* Hero Card */}
          <div className="bg-white border-2 border-zinc-900 p-8 md:p-12 shadow-[6px_6px_0px_0px_rgba(0,0,0,0.1)] max-w-2xl mx-auto">
            {/* Badge */}
            <div className="flex items-center gap-2 mb-6">
              <span className="w-2 h-2 bg-violet-500 rounded-full animate-pulse" />
              <span className="text-xs font-semibold text-violet-600 uppercase tracking-wider">
                Thế hệ trợ lý tiếp theo
              </span>
            </div>

            {/* Title */}
            <h1 className="font-black text-3xl md:text-4xl lg:text-5xl text-zinc-900 leading-tight mb-6">
              Trí tuệ hỗ trợ MADA
            </h1>

            {/* Description */}
            <p className="text-base md:text-lg text-zinc-600 mb-8 max-w-lg">
              Kiến trúc AI chuyên biệt cho Công nghệ Hỗ trợ, hội tụ tinh hoa từ ISO 9999, WCAG 2.2 và chiến lược toàn cầu WHO GATE.
            </p>

            {/* Buttons */}
            <div className="flex flex-wrap gap-4">
              <a
                href="/chat"
                className="bg-violet-500 text-white px-8 py-4 rounded-full font-bold text-sm border-2 border-zinc-900 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] transition-all"
              >
                Bắt đầu hội thoại
              </a>
              <a
                href="#features"
                className="bg-white text-zinc-900 px-8 py-4 rounded-full font-bold text-sm border-2 border-zinc-900 hover:bg-zinc-100 transition-colors"
              >
                Khám phá
              </a>
            </div>
          </div>

          {/* Floating Icons */}
          <div className="absolute top-1/4 left-0 hidden lg:block">
            <span className="material-symbols-outlined text-6xl text-violet-400 opacity-40" style={{ fontVariationSettings: "'FILL' 1" }}>
              assistive_listening_systems
            </span>
          </div>
          <div className="absolute bottom-1/4 right-0 hidden lg:block">
            <span className="material-symbols-outlined text-6xl text-blue-400 opacity-30" style={{ fontVariationSettings: "'FILL' 1" }}>
              settings_accessibility
            </span>
          </div>
        </div>
      </main>

      {/* Features Section */}
      <section className="bg-white py-20 px-6 md:px-12 border-t-2 border-zinc-200" id="features">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12">
            <span className="text-xs font-semibold text-violet-600 uppercase tracking-wider mb-2 block">Khả năng cốt lõi</span>
            <h2 className="font-black text-2xl md:text-3xl">Tính năng nổi bật</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="bg-zinc-50 border-2 border-zinc-200 p-6 hover:border-violet-400 transition-colors">
              <div className="w-12 h-12 bg-violet-100 flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-2xl text-violet-600" style={{ fontVariationSettings: "'FILL' 1" }}>forum</span>
              </div>
              <h3 className="font-bold text-lg mb-2">Trò chuyện thông minh</h3>
              <p className="text-sm text-zinc-600">Hỗ trợ ngôn ngữ tự nhiên, hiểu ngữ cảnh y tế và kỹ thuật hỗ trợ chuyên sâu.</p>
            </div>

            {/* Feature 2 */}
            <div className="bg-zinc-50 border-2 border-zinc-200 p-6 hover:border-blue-400 transition-colors">
              <div className="w-12 h-12 bg-blue-100 flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-2xl text-blue-600" style={{ fontVariationSettings: "'FILL' 1" }}>center_focus_strong</span>
              </div>
              <h3 className="font-bold text-lg mb-2">Nhận diện thiết bị</h3>
              <p className="text-sm text-zinc-600">Phân tích hình ảnh và mô tả để xác định các thiết bị hỗ trợ tối ưu.</p>
            </div>

            {/* Feature 3 */}
            <div className="bg-zinc-50 border-2 border-zinc-200 p-6 hover:border-amber-400 transition-colors">
              <div className="w-12 h-12 bg-amber-100 flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-2xl text-amber-600" style={{ fontVariationSettings: "'FILL' 1" }}>fact_check</span>
              </div>
              <h3 className="font-bold text-lg mb-2">Tra cứu tiêu chuẩn</h3>
              <p className="text-sm text-zinc-600">Truy xuất tức thì các thông số kỹ thuật từ thư viện ISO 9999 và WCAG.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-zinc-50 py-20 px-6 md:px-12 border-t-2 border-zinc-200" id="how-it-works">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-black text-2xl md:text-3xl text-center mb-12">Quy trình hoạt động</h2>

          <div className="space-y-8">
            {/* Step 1 */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-violet-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">1</div>
              <div>
                <h3 className="font-bold text-lg mb-1">Đặt câu hỏi</h3>
                <p className="text-sm text-zinc-600">Gửi yêu cầu qua văn bản, giọng nói hoặc hình ảnh về nhu cầu hỗ trợ của bạn.</p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">2</div>
              <div>
                <h3 className="font-bold text-lg mb-1">Phân tích dữ liệu</h3>
                <p className="text-sm text-zinc-600">MADA quét qua hàng triệu tài liệu tiêu chuẩn ISO và WHO để tìm kiếm sự tương thích.</p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-amber-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">3</div>
              <div>
                <h3 className="font-bold text-lg mb-1">Giải pháp chuẩn hóa</h3>
                <p className="text-sm text-zinc-600">Nhận báo cáo chi tiết về thiết bị, hướng dẫn sử dụng và lộ trình phù hợp.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Standards Section */}
      <section className="bg-zinc-900 py-20 px-6 md:px-12 text-white" id="standards">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-black text-2xl md:text-3xl mb-12">Tiêu chuẩn vàng</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* ISO Card */}
            <div className="bg-zinc-800 p-6 border border-zinc-700">
              <div className="flex items-center gap-3 mb-4">
                <span className="material-symbols-outlined text-3xl text-violet-400" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                <h3 className="font-bold text-xl">ISO 9999</h3>
              </div>
              <p className="text-sm text-zinc-400">Hệ thống mã hóa 6 chữ số chuẩn quốc tế để phân loại mọi sản phẩm hỗ trợ.</p>
            </div>

            {/* WCAG Card */}
            <div className="bg-zinc-800 p-6 border border-zinc-700">
              <div className="flex items-center gap-3 mb-4">
                <span className="material-symbols-outlined text-3xl text-blue-400" style={{ fontVariationSettings: "'FILL' 1" }}>accessibility</span>
                <h3 className="font-bold text-xl">WCAG 2.2</h3>
              </div>
              <p className="text-sm text-zinc-400">Giao diện và nội dung được tối ưu hóa cho tất cả các mức độ tiếp cận AAA.</p>
            </div>
          </div>
        </div>
      </section>

      <Footer />

      <AuthModal />
      <PaywallModal />
    </div>
  );
}
