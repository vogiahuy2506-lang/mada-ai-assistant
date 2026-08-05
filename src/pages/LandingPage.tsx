import { Header, Footer } from '@/components';
import { AuthModal } from '@/components/auth/AuthModal';
import { PaywallModal } from '@/components/auth/PaywallModal';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-on-background overflow-x-hidden">
      <Header />

      {/* Hero Canvas */}
      <main className="relative w-full min-h-screen flex items-center justify-center pt-32 pb-20 px-8 md:px-12 overflow-hidden">
        {/* Enhanced Background Shader Emulation */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-20 bg-[radial-gradient(circle_at_50%_50%,_#3b82f6_0%,_transparent_50%)]" />

        <div className="relative z-10 w-full max-w-7xl grid grid-cols-12 gap-6 items-center">
          {/* Left Side: Massive Overlapping Headline */}
          <div className="col-span-12 md:col-span-4 h-full relative flex items-center justify-start pointer-events-none">
            <h1 className="font-black text-[180px] md:text-[280px] leading-none select-none rotate-vertical transform -translate-x-8 md:-translate-x-24 opacity-10 md:opacity-100 mix-blend-multiply">
              MADA
            </h1>
          </div>

          {/* Center-Right: Floating Island Card */}
          <div className="col-span-12 md:col-span-8 flex justify-center md:justify-end">
            <div className="glass-island p-10 md:p-16 lg:p-20 border-[3px] border-on-background neo-brutalist-shadow max-w-2xl transform translate-x-0 md:translate-x-[-20px] md:rotate-[-0.5deg]">
              <div className="flex flex-col gap-8">
                {/* Badge */}
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 bg-primary rounded-full animate-pulse" />
                  <span className="text-xs font-mono text-primary bg-primary-fixed/50 px-4 py-1.5 border-2 border-on-background w-fit uppercase font-bold tracking-widest">
                    THẾ HỆ TRỢ LÝ TIẾP THEO
                  </span>
                </div>

                {/* Title */}
                <h2 className="font-black text-4xl md:text-5xl lg:text-6xl text-on-background leading-[0.9] tracking-tighter">
                  TRÍ TUỆ <br />HỖ TRỢ MADA
                </h2>

                {/* Description */}
                <p className="text-base md:text-lg text-on-surface-variant max-w-md border-l-4 border-primary pl-6 py-2">
                  Kiến trúc AI chuyên biệt cho Công nghệ Hỗ trợ, hội tụ tinh hoa từ ISO 9999, WCAG 2.2 và chiến lược toàn cầu WHO GATE.
                </p>

                {/* Buttons */}
                <div className="flex flex-wrap gap-8 mt-6">
                  <a
                    href="/chat"
                    className="bg-primary text-on-primary px-10 py-6 rounded-full font-bold text-lg border-[3px] border-on-background neo-brutalist-shadow-sm hover:translate-y-[-6px] hover:translate-x-[-6px] hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] transition-all duration-300 btn-active group flex items-center gap-4"
                  >
                    Bắt đầu hội thoại
                    <span className="material-symbols-outlined font-bold group-hover:translate-x-2 transition-transform">arrow_forward</span>
                  </a>
                  <a
                    href="#features"
                    className="bg-white text-on-background px-10 py-6 rounded-full font-bold text-lg border-[3px] border-on-background hover:bg-on-background/5 transition-all duration-300"
                  >
                    Khám phá
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Parallax Icons Layer */}
        <div className="absolute top-[15%] left-[5%] floating-icon pointer-events-none" data-speed="1.5" style={{ '--rot': '10deg' } as React.CSSProperties}>
          <span className="material-symbols-outlined text-[80px] md:text-[100px] text-primary opacity-30 transform rotate-12" style={{ fontVariationSettings: "'FILL' 1" }}>
            assistive_listening_systems
          </span>
        </div>
        <div className="absolute bottom-[10%] right-[10%] floating-icon pointer-events-none" data-speed="2" style={{ '--rot': '-15deg' } as React.CSSProperties}>
          <span className="material-symbols-outlined text-[100px] md:text-[140px] text-secondary opacity-20 transform -rotate-45" style={{ fontVariationSettings: "'FILL' 1" }}>
            neurology
          </span>
        </div>
        <div className="absolute top-[50%] right-[5%] floating-icon pointer-events-none" data-speed="0.8" style={{ '--rot': '25deg' } as React.CSSProperties}>
          <span className="material-symbols-outlined text-[60px] md:text-[80px] text-tertiary opacity-25" style={{ fontVariationSettings: "'FILL' 1" }}>
            settings_accessibility
          </span>
        </div>
      </main>

      {/* Key Features Section */}
      <section className="bg-surface py-24 md:py-32 px-8 md:px-12 border-y-[4px] border-on-background" id="features">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 md:mb-20 gap-8">
            <div className="max-w-2xl">
              <span className="text-xs font-mono text-primary font-bold uppercase tracking-[0.3em] mb-4 block">Khả năng cốt lõi</span>
              <h2 className="font-black text-4xl md:text-5xl lg:text-6xl leading-none">TÍNH NĂNG NỔI BẬT</h2>
            </div>
            <p className="text-base md:text-lg text-on-surface-variant max-w-sm mb-2">
              Hệ thống đa mô hình được thiết kế để xóa bỏ mọi rào cản tiếp cận thông tin.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {/* Feature 1 */}
            <div className="group bg-white border-[3px] border-on-background p-10 neo-brutalist-shadow-sm hover:translate-y-[-10px] hover:translate-x-[-10px] hover:shadow-[16px_16px_0px_0px_#3b82f6] transition-all duration-300">
              <div className="w-20 h-20 bg-primary-fixed border-2 border-on-background flex items-center justify-center mb-8 rotate-[-3deg] group-hover:rotate-0 transition-transform">
                <span className="material-symbols-outlined text-4xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>forum</span>
              </div>
              <h3 className="font-bold text-2xl mb-4">Trò chuyện thông minh</h3>
              <p className="text-base text-on-surface-variant">Hỗ trợ ngôn ngữ tự nhiên, hiểu ngữ cảnh y tế và kỹ thuật hỗ trợ chuyên sâu.</p>
            </div>

            {/* Feature 2 */}
            <div className="group bg-white border-[3px] border-on-background p-10 neo-brutalist-shadow-sm hover:translate-y-[-10px] hover:translate-x-[-10px] hover:shadow-[16px_16px_0px_0px_#8127cf] transition-all duration-300">
              <div className="w-20 h-20 bg-secondary-fixed border-2 border-on-background flex items-center justify-center mb-8 rotate-[5deg] group-hover:rotate-0 transition-transform">
                <span className="material-symbols-outlined text-4xl text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>center_focus_strong</span>
              </div>
              <h3 className="font-bold text-2xl mb-4">Nhận diện thiết bị</h3>
              <p className="text-base text-on-surface-variant">Phân tích hình ảnh và mô tả để xác định các thiết bị hỗ trợ tối ưu theo nhu cầu cá nhân.</p>
            </div>

            {/* Feature 3 */}
            <div className="group bg-white border-[3px] border-on-background p-10 neo-brutalist-shadow-sm hover:translate-y-[-10px] hover:translate-x-[-10px] hover:shadow-[16px_16px_0px_0px_#924700] transition-all duration-300">
              <div className="w-20 h-20 bg-tertiary-fixed border-2 border-on-background flex items-center justify-center mb-8 rotate-[-2deg] group-hover:rotate-0 transition-transform">
                <span className="material-symbols-outlined text-4xl text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>fact_check</span>
              </div>
              <h3 className="font-bold text-2xl mb-4">Tra cứu tiêu chuẩn</h3>
              <p className="text-base text-on-surface-variant">Truy xuất tức thì các thông số kỹ thuật từ thư viện ISO 9999 và WCAG quốc tế.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="bg-white py-24 md:py-32 px-8 md:px-12 overflow-hidden" id="how-it-works">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 md:mb-24">
            <h2 className="font-black text-4xl md:text-5xl lg:text-6xl leading-none mb-6">QUY TRÌNH HOẠT ĐỘNG</h2>
            <div className="h-2 w-48 bg-primary mx-auto border-2 border-on-background" />
          </div>

          <div className="relative">
            {/* Connector Line */}
            <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-on-background hidden md:block opacity-20" />

            <div className="space-y-24 md:space-y-32">
              {/* Step 1 */}
              <div className="relative flex flex-col md:flex-row items-center gap-12 group">
                <div className="md:w-1/2 flex justify-end md:pr-20 text-right">
                  <div className="max-w-md">
                    <span className="text-8xl md:text-[100px] font-black text-primary/10 absolute -top-12 -left-4 md:static md:block leading-none">01</span>
                    <h3 className="font-bold text-2xl mb-4">Đặt câu hỏi</h3>
                    <p className="text-base md:text-lg text-on-surface-variant">Gửi yêu cầu qua văn bản, giọng nói hoặc hình ảnh về nhu cầu hỗ trợ cụ thể của bạn.</p>
                  </div>
                </div>
                <div className="z-10 w-16 h-16 bg-on-background text-white rounded-full flex items-center justify-center font-bold text-2xl border-4 border-white shadow-xl">1</div>
                <div className="md:w-1/2 md:pl-20">
                  <div className="p-8 bg-surface-container border-2 border-on-background neo-brutalist-shadow-sm group-hover:rotate-1 transition-transform">
                    <span className="material-symbols-outlined text-6xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>chat_bubble</span>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="relative flex flex-col md:flex-row-reverse items-center gap-12 group">
                <div className="md:w-1/2 flex justify-start md:pl-20 text-left">
                  <div className="max-w-md">
                    <span className="text-8xl md:text-[100px] font-black text-secondary/10 absolute -top-12 -right-4 md:static md:block leading-none">02</span>
                    <h3 className="font-bold text-2xl mb-4">Phân tích dữ liệu</h3>
                    <p className="text-base md:text-lg text-on-surface-variant">MADA quét qua hàng triệu tài liệu tiêu chuẩn ISO và WHO để tìm kiếm sự tương thích tốt nhất.</p>
                  </div>
                </div>
                <div className="z-10 w-16 h-16 bg-on-background text-white rounded-full flex items-center justify-center font-bold text-2xl border-4 border-white shadow-xl">2</div>
                <div className="md:w-1/2 md:pr-20">
                  <div className="p-8 bg-surface-container border-2 border-on-background neo-brutalist-shadow-sm group-hover:-rotate-1 transition-transform">
                    <span className="material-symbols-outlined text-6xl text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>memory</span>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="relative flex flex-col md:flex-row items-center gap-12 group">
                <div className="md:w-1/2 flex justify-end md:pr-20 text-right">
                  <div className="max-w-md">
                    <span className="text-8xl md:text-[100px] font-black text-tertiary/10 absolute -top-12 -left-4 md:static md:block leading-none">03</span>
                    <h3 className="font-bold text-2xl mb-4">Giải pháp chuẩn hóa</h3>
                    <p className="text-base md:text-lg text-on-surface-variant">Nhận báo cáo chi tiết về thiết bị, hướng dẫn sử dụng và lộ trình tiếp cận phù hợp.</p>
                  </div>
                </div>
                <div className="z-10 w-16 h-16 bg-on-background text-white rounded-full flex items-center justify-center font-bold text-2xl border-4 border-white shadow-xl">3</div>
                <div className="md:w-1/2 md:pl-20">
                  <div className="p-8 bg-surface-container border-2 border-on-background neo-brutalist-shadow-sm group-hover:rotate-1 transition-transform">
                    <span className="material-symbols-outlined text-6xl text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Standards Bento Section */}
      <section className="bg-on-background py-24 md:py-32 px-8 md:px-12" id="standards">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16 md:mb-20 text-surface">
            <h2 className="font-black text-4xl md:text-5xl lg:text-6xl leading-none mb-6">TIÊU CHUẨN VÀNG</h2>
            <p className="text-base md:text-lg text-surface-variant max-w-xl opacity-80">Chúng tôi không chỉ xây dựng AI, chúng tôi xây dựng sự tin cậy dựa trên nền tảng khoa học toàn cầu.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            {/* ISO Card */}
            <div className="md:col-span-8 bg-surface-container p-12 border-2 border-white flex flex-col justify-between min-h-[350px] md:min-h-[400px] group overflow-hidden relative">
              <div className="relative z-10">
                <h3 className="font-bold text-2xl md:text-3xl mb-6">Hệ thống phân loại ISO 9999</h3>
                <p className="text-base text-on-surface-variant max-w-md mb-8">MADA sử dụng hệ thống mã hóa 6 chữ số chuẩn quốc tế để phân loại mọi sản phẩm hỗ trợ cho người khuyết tật.</p>
              </div>
              <div className="relative z-10 w-full h-48 bg-white border-2 border-on-background overflow-hidden">
                <div className="w-full h-full bg-gradient-to-br from-blue-100 via-purple-50 to-blue-100 flex items-center justify-center">
                  <span className="text-6xl md:text-7xl font-black text-on-surface-variant/30">ISO</span>
                </div>
              </div>
              <div className="absolute top-[-50px] right-[-50px] text-[180px] md:text-[240px] font-black text-on-background/5 select-none pointer-events-none">ISO</div>
            </div>

            {/* WCAG Card */}
            <div className="md:col-span-4 bg-tertiary-fixed p-12 border-2 border-white flex flex-col gap-6 group hover:bg-tertiary transition-colors duration-500">
              <span className="material-symbols-outlined text-6xl group-hover:text-white transition-colors" style={{ fontVariationSettings: "'FILL' 1" }}>terminal</span>
              <h3 className="font-bold text-2xl md:text-3xl group-hover:text-white transition-colors">WCAG 2.2</h3>
              <p className="text-base group-hover:text-white/80 transition-colors">Giao diện và nội dung được tối ưu hóa cho tất cả các mức độ tiếp cận AAA kỹ thuật số.</p>
            </div>

            {/* WHO Card */}
            <div className="md:col-span-12 bg-secondary-fixed p-12 border-2 border-white flex flex-col md:flex-row items-center justify-between gap-12 group">
              <div className="max-w-xl">
                <span className="material-symbols-outlined text-6xl mb-4 block" style={{ fontVariationSettings: "'FILL' 1" }}>language</span>
                <h3 className="font-bold text-2xl md:text-3xl">Chiến lược WHO GATE</h3>
                <p className="text-base mt-4">Hỗ trợ các chính sách quốc gia về Công nghệ Hỗ trợ theo khung của Tổ chức Y tế Thế giới, tập trung vào sự công bằng và hiệu quả.</p>
              </div>
              <div className="flex-shrink-0">
                <button className="bg-on-background text-white px-10 py-5 rounded-full font-bold border-2 border-white hover:bg-transparent hover:text-on-background transition-all">Tài liệu kỹ thuật</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ecosystem Section */}
      <section className="bg-surface py-24 md:py-32 border-t-[4px] border-on-background" id="ecosystem">
        <div className="max-w-7xl mx-auto px-8 md:px-12">
          <div className="text-center mb-16">
            <span className="text-xs font-mono text-primary font-bold uppercase mb-4 block tracking-widest">Hợp tác & Kết nối</span>
            <h2 className="font-black text-4xl md:text-5xl lg:text-6xl">HỆ SINH THÁI ĐỐI TÁC</h2>
          </div>

          <div className="marquee-container py-12 border-y-2 border-on-background bg-white">
            <div className="marquee-content flex gap-32 items-center">
              <div className="flex items-center gap-6 grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all cursor-default">
                <span className="material-symbols-outlined text-4xl">medical_services</span>
                <span className="font-bold text-xl md:text-2xl">WHO GATE</span>
              </div>
              <div className="flex items-center gap-6 grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all cursor-default">
                <span className="material-symbols-outlined text-4xl">domain</span>
                <span className="font-bold text-xl md:text-2xl">ISO STANDARDS</span>
              </div>
              <div className="flex items-center gap-6 grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all cursor-default">
                <span className="material-symbols-outlined text-4xl">accessible</span>
                <span className="font-bold text-xl md:text-2xl">W3C WCAG</span>
              </div>
              <div className="flex items-center gap-6 grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all cursor-default">
                <span className="material-symbols-outlined text-4xl">biotech</span>
                <span className="font-bold text-xl md:text-2xl">HEALTH TECH</span>
              </div>
              {/* Duplicate for seamless loop */}
              <div className="flex items-center gap-6 grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all cursor-default">
                <span className="material-symbols-outlined text-4xl">medical_services</span>
                <span className="font-bold text-xl md:text-2xl">WHO GATE</span>
              </div>
              <div className="flex items-center gap-6 grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all cursor-default">
                <span className="material-symbols-outlined text-4xl">domain</span>
                <span className="font-bold text-xl md:text-2xl">ISO STANDARDS</span>
              </div>
              <div className="flex items-center gap-6 grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all cursor-default">
                <span className="material-symbols-outlined text-4xl">accessible</span>
                <span className="font-bold text-xl md:text-2xl">W3C WCAG</span>
              </div>
              <div className="flex items-center gap-6 grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all cursor-default">
                <span className="material-symbols-outlined text-4xl">biotech</span>
                <span className="font-bold text-xl md:text-2xl">HEALTH TECH</span>
              </div>
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
