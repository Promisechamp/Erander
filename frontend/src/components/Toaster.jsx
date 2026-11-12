import { motion, useReducedMotion } from "framer-motion";
import { Toaster } from "sonner";
import {
Check,
CircleAlert,
Info,
LoaderCircle,
X,
} from "lucide-react";

const COLORS = {
success: {
label: "COMPLETED",
title: "Success",
icon: Check,
accent: "#35D07F",
soft: "rgba(53, 208, 127, 0.12)",
border: "rgba(53, 208, 127, 0.25)",
glow: "rgba(53, 208, 127, 0.20)",
paths: ["M5 12.5l4.5 4.5L19 7.5"],
},

error: {
label: "ACTION FAILED",
title: "Something went wrong",
icon: CircleAlert,
accent: "#FB7185",
soft: "rgba(251, 113, 133, 0.12)",
border: "rgba(251, 113, 133, 0.25)",
glow: "rgba(251, 113, 133, 0.18)",
paths: ["M7 7l10 10", "M17 7L7 17"],
},

warning: {
label: "ATTENTION REQUIRED",
title: "Please take note",
icon: CircleAlert,
accent: "#FBBF24",
soft: "rgba(251, 191, 36, 0.12)",
border: "rgba(251, 191, 36, 0.25)",
glow: "rgba(251, 191, 36, 0.18)",
paths: ["M12 7v6.5", "M12 17h.01"],
},

info: {
label: "INFORMATION",
title: "New information",
icon: Info,
accent: "#60A5FA",
soft: "rgba(96, 165, 250, 0.12)",
border: "rgba(96, 165, 250, 0.25)",
glow: "rgba(96, 165, 250, 0.18)",
paths: ["M12 11v6", "M12 7.5h.01"],
},

loading: {
label: "PROCESSING",
title: "Please wait",
icon: LoaderCircle,
accent: "#35D07F",
soft: "rgba(53, 208, 127, 0.12)",
border: "rgba(53, 208, 127, 0.25)",
glow: "rgba(53, 208, 127, 0.18)",
paths: [],
},
};

function StatusIcon({ type }) {
const reduceMotion = useReducedMotion();
const config = COLORS[type] || COLORS.info;

return (
<motion.div
initial={reduceMotion ? false : { scale: 0.75, opacity: 0, y: 8 }}
animate={{ scale: 1, opacity: 1, y: 0 }}
transition={{
type: "spring",
stiffness: 380,
damping: 24,
}}
className="relative flex h-[58px] w-[58px] shrink-0 items-center justify-center overflow-hidden rounded-[19px] border"
style={{
background: "linear-gradient(145deg, ${config.soft}, rgba(255,255,255,0.025))",
borderColor: config.border,
boxShadow: "0 8px 28px ${config.glow}",
}}
>
<div
className="pointer-events-none absolute inset-0"
style={{
background: "radial-gradient(circle at 50% 0%, ${config.glow}, transparent 75%)",
}}
/>

  {type === "loading" ? (
    <motion.div
      animate={reduceMotion ? undefined : { rotate: 360 }}
      transition={{
        duration: 1,
        ease: "linear",
        repeat: Infinity,
      }}
      className="relative"
    >
      <LoaderCircle
        size={27}
        strokeWidth={1.9}
        style={{ color: config.accent }}
      />
    </motion.div>
  ) : (
    <svg
      className="relative"
      width="27"
      height="27"
      viewBox="0 0 24 24"
      fill="none"
      stroke={config.accent}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {config.paths.map((path, index) => (
        <motion.path
          key={path}
          d={path}
          initial={
            reduceMotion
              ? false
              : { pathLength: 0, opacity: 0 }
          }
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{
            duration: 0.4,
            delay: index * 0.12,
            ease: "easeOut",
          }}
        />
      ))}
    </svg>
  )}

  <div
    className="absolute bottom-0 left-0 right-0 h-[2px]"
    style={{ backgroundColor: config.accent, opacity: 0.65 }}
  />
</motion.div>

);
}

function NotificationIcon({ type }) {
const config = COLORS[type] || COLORS.info;

return (
<div className="flex shrink-0 flex-col items-center gap-2">
<StatusIcon type={type} />

  <span
    className="text-[8px] font-extrabold tracking-[0.16em]"
    style={{ color: config.accent }}
  >
    {config.label}
  </span>
</div>

);
}

function CloseIcon() {
return (
<X
size={15}
strokeWidth={2}
aria-hidden="true"
/>
);
}

function ToastProgress({ type }) {
const reduceMotion = useReducedMotion();
const config = COLORS[type] || COLORS.info;

if (type === "loading") return null;

return (
<motion.div
initial={{ scaleX: 1 }}
animate={reduceMotion ? { scaleX: 1 } : { scaleX: 0 }}
transition={{
duration: 4.5,
ease: "linear",
}}
style={{
backgroundColor: config.accent,
transformOrigin: "left",
}}
className="absolute bottom-0 left-0 right-0 h-[2px]"
/>
);
}

export default function AppToaster() {
const createIcon = (type) => (
<NotificationIcon type={type} />
);

return (
<Toaster
position="top-right"
closeButton
visibleToasts={4}
gap={14}
offset={24}
duration={4500}
pauseWhenPageIsHidden
icons={{
success: createIcon("success"),
error: createIcon("error"),
warning: createIcon("warning"),
info: createIcon("info"),
loading: createIcon("loading"),
close: <CloseIcon />,
}}
toastOptions={{
unstyled: true,

    classNames: {
      toast: [
        "font-manrope",
        "relative",
        "flex",
        "w-full",
        "items-start",
        "gap-4",
        "overflow-hidden",
        "rounded-[23px]",
        "border",
        "border-white/[0.09]",
        "bg-[#14213D]",
        "px-4",
        "py-[19px]",
        "pr-12",
        "shadow-[0_24px_70px_rgba(7,15,30,0.30)]",
        "ring-1",
        "ring-black/[0.05]",
        "backdrop-blur-2xl",
        "transition-all",
        "duration-300",
        "hover:border-white/[0.15]",
        "sm:w-[410px]",
        "max-w-[calc(100vw-28px)]",
      ].join(" "),

      icon: [
        "mt-0.5",
        "flex",
        "shrink-0",
      ].join(" "),

      content: [
        "min-w-0",
        "flex-1",
        "pt-1",
      ].join(" "),

      title: [
        "block",
        "text-[13px]",
        "font-extrabold",
        "leading-[1.5]",
        "tracking-[-0.025em]",
        "!text-white",
      ].join(" "),

      description: [
        "mt-1.5",
        "block",
        "text-[11.5px]",
        "font-medium",
        "leading-[1.75]",
        "tracking-[0.005em]",
        "!text-slate-300/75",
        "break-words",
      ].join(" "),

      closeButton: [
        "!absolute",
        "!right-3",
        "!top-3",
        "!left-auto",
        "!transform-none",
        "!flex",
        "!h-7",
        "!w-7",
        "!items-center",
        "!justify-center",
        "!rounded-xl",
        "!border",
        "!border-white/[0.08]",
        "!bg-white/[0.035]",
        "!text-slate-400",
        "!shadow-none",
        "transition-all",
        "duration-200",
        "hover:!border-white/[0.16]",
        "hover:!bg-white/[0.09]",
        "hover:!text-white",
        "focus-visible:!outline-none",
        "focus-visible:!ring-2",
        "focus-visible:!ring-[#35D07F]",
      ].join(" "),

      actionButton: [
        "ml-2",
        "shrink-0",
        "rounded-xl",
        "!bg-[#35D07F]",
        "px-3.5",
        "py-2",
        "text-[10px]",
        "font-extrabold",
        "tracking-wide",
        "!text-[#14213D]",
        "shadow-[0_3px_12px_rgba(53,208,127,0.18)]",
        "transition-all",
        "duration-200",
        "hover:!bg-[#52E994]",
        "active:scale-[0.97]",
      ].join(" "),

      cancelButton: [
        "shrink-0",
        "rounded-xl",
        "border",
        "border-white/10",
        "!bg-white/[0.05]",
        "px-3.5",
        "py-2",
        "text-[10px]",
        "font-bold",
        "!text-slate-300",
        "transition-all",
        "hover:!bg-white/10",
      ].join(" "),

      success: "!border-l-2 !border-l-[#35D07F]",
      error: "!border-l-2 !border-l-[#FB7185]",
      warning: "!border-l-2 !border-l-[#FBBF24]",
      info: "!border-l-2 !border-l-[#60A5FA]",
      loading: "!border-l-2 !border-l-[#35D07F]",
    },
  }}
/>

);
}