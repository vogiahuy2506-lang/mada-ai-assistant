import { RobotLogo } from './icons/RobotLogo';

export function Footer() {
  return (
    <footer className="w-full flex flex-col md:flex-row justify-between items-start md:items-end p-6 md:p-8 gap-6 bg-zinc-900 text-zinc-100">
      <div className="flex flex-col gap-3 max-w-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center p-1.5">
            <RobotLogo variant="white" className="w-full h-full" />
          </div>
          <div className="font-black text-2xl tracking-tight">MADA AI</div>
        </div>
        <p className="text-sm text-zinc-400">
          Tiên phong trong việc ứng dụng trí tuệ nhân tạo để nâng tầm cuộc sống cho mọi người thông qua công nghệ hỗ trợ chuẩn hóa.
        </p>
        <p className="text-xs text-zinc-500 uppercase tracking-wider">
          © 2024 MADA AI
        </p>
      </div>

      <div className="flex gap-12">
        <div className="flex flex-col gap-3">
          <span className="text-xs font-semibold uppercase text-violet-400 tracking-wider">Tài nguyên</span>
          <a className="text-sm text-zinc-400 hover:text-white transition-colors" href="#">Đạo đức AI</a>
          <a className="text-sm text-zinc-400 hover:text-white transition-colors" href="#">Bảo mật</a>
          <a className="text-sm text-zinc-400 hover:text-white transition-colors" href="#">Github</a>
        </div>
        <div className="flex flex-col gap-3">
          <span className="text-xs font-semibold uppercase text-violet-400 tracking-wider">Liên kết</span>
          <a className="text-sm text-zinc-400 hover:text-white transition-colors" href="#">Hỗ trợ</a>
          <a className="text-sm text-zinc-400 hover:text-white transition-colors" href="#">Cập nhật</a>
          <a className="text-sm text-zinc-400 hover:text-white transition-colors" href="#">ISO 9999</a>
        </div>
      </div>
    </footer>
  );
}
