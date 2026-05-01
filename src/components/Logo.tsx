import logoImg from "/logo.png";

interface LogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
  textClassName?: string;
  animated?: boolean;
}

export default function Logo({ size = 40, showText = true, className = "", textClassName = "", animated = false }: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div
        className={`relative shrink-0 ${animated ? "animate-float" : ""}`}
        style={{ width: size, height: size }}
      >
        <div className="absolute inset-0 rounded-2xl bg-gradient-primary opacity-30 blur-lg" />
        <img
          src={logoImg}
          alt="MediRecall logo"
          width={size}
          height={size}
          className="relative drop-shadow-lg"
        />
      </div>
      {showText && (
        <div className="flex flex-col leading-none">
          <span className={`font-extrabold gradient-text tracking-tight ${textClassName || "text-xl"}`}>
            MediRecall
          </span>
        </div>
      )}
    </div>
  );
}
