import { RobotLogo } from './icons/RobotLogo';

export function Footer() {
  return (
    <footer className="w-full flex flex-col md:flex-row justify-between items-start md:items-end p-6 md:p-8 gap-4 bg-on-background text-surface border-t-4 border-primary">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center p-1.5">
            <RobotLogo variant="white" className="w-full h-full" />
          </div>
          <div className="font-black text-2xl md:text-3xl tracking-tight">MADA AI</div>
        </div>
        <p className="text-xs md:text-sm text-surface-variant opacity-80 max-w-md">
          Tiên phong trong việc ứng dụng trí tuệ nhân tạo để nâng tầm cuộc sống cho mọi người thông qua công nghệ hỗ trợ chuẩn hóa.
        </p>
        <p className="text-[10px] md:text-xs font-mono uppercase opacity-50 tracking-widest">
          ©2024 MADA AI. HIGH-END ASSISTIVE TECHNOLOGY INTERFACE.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6 md:gap-12">
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-mono uppercase text-primary font-bold">Tài nguyên</span>
          <a className="text-xs font-mono uppercase text-surface-variant hover:text-primary transition-colors" href="#">Đạo đức AI</a>
          <a className="text-xs font-mono uppercase text-surface-variant hover:text-primary transition-colors" href="#">Bảo mật</a>
          <a className="text-xs font-mono uppercase text-surface-variant hover:text-primary transition-colors" href="#">Github</a>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-mono uppercase text-primary font-bold">Liên kết</span>
          <a className="text-xs font-mono uppercase text-surface-variant hover:text-primary transition-colors" href="#">Hỗ trợ</a>
          <a className="text-xs font-mono uppercase text-surface-variant hover:text-primary transition-colors" href="#">Cập nhật</a>
          <a className="text-xs font-mono uppercase text-surface-variant hover:text-primary transition-colors" href="#">ISO 9999</a>
        </div>
      </div>
    </footer>
  );
}
