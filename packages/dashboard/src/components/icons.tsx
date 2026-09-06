import React from "react";
import {
  Link2,
  LayoutDashboard,
  FileCode2,
  Bell,
  Coins,
  Plus,
  Copy,
  Check,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Zap,
  Terminal,
  MessageSquare,
  Radio,
  Webhook,
  X,
  Search,
  ExternalLink,
  Trash2,
  Lightbulb,
  Info,
  ArrowRight,
  ArrowLeft,
  LucideProps,
} from "lucide-react";

export interface IconProps extends LucideProps {
  size?: number;
  className?: string;
}

export const IconChain = ({ size = 18, className, ...props }: IconProps) => (
  <Link2 size={size} className={className} strokeWidth={2} {...props} />
);

export const IconDashboard = ({ size = 18, className, ...props }: IconProps) => (
  <LayoutDashboard size={size} className={className} strokeWidth={2} {...props} />
);

export const IconContracts = ({ size = 18, className, ...props }: IconProps) => (
  <FileCode2 size={size} className={className} strokeWidth={2} {...props} />
);

export const IconAlerts = ({ size = 18, className, ...props }: IconProps) => (
  <Bell size={size} className={className} strokeWidth={2} {...props} />
);

export const IconCost = ({ size = 18, className, ...props }: IconProps) => (
  <Coins size={size} className={className} strokeWidth={2} {...props} />
);

export const IconPlus = ({ size = 16, className, ...props }: IconProps) => (
  <Plus size={size} className={className} strokeWidth={2.5} {...props} />
);

export const IconCopy = ({ size = 14, className, ...props }: IconProps) => (
  <Copy size={size} className={className} strokeWidth={2} {...props} />
);

export const IconCheck = ({ size = 14, className, ...props }: IconProps) => (
  <Check size={size} className={className} strokeWidth={2.5} {...props} />
);

export const IconShield = ({ size = 32, className, ...props }: IconProps) => (
  <ShieldCheck size={size} className={className} strokeWidth={1.8} {...props} />
);

export const IconWarning = ({ size = 16, className, ...props }: IconProps) => (
  <AlertTriangle size={size} className={className} strokeWidth={2} {...props} />
);

export const IconCritical = ({ size = 18, className, ...props }: IconProps) => (
  <AlertCircle size={size} className={className} strokeWidth={2} {...props} />
);

export const IconSuccess = ({ size = 20, className, ...props }: IconProps) => (
  <CheckCircle2 size={size} className={className} strokeWidth={2} {...props} />
);

export const IconZap = ({ size = 16, className, ...props }: IconProps) => (
  <Zap size={size} className={className} strokeWidth={2.2} {...props} />
);

export const IconTerminal = ({ size = 18, className, ...props }: IconProps) => (
  <Terminal size={size} className={className} strokeWidth={2} {...props} />
);

export const IconSlack = ({ size = 18, className, ...props }: IconProps) => (
  <MessageSquare size={size} className={className} strokeWidth={2} {...props} />
);

export const IconPagerDuty = ({ size = 18, className, ...props }: IconProps) => (
  <Radio size={size} className={className} strokeWidth={2} {...props} />
);

export const IconWebhook = ({ size = 18, className, ...props }: IconProps) => (
  <Webhook size={size} className={className} strokeWidth={2} {...props} />
);

export const IconClose = ({ size = 16, className, ...props }: IconProps) => (
  <X size={size} className={className} strokeWidth={2.2} {...props} />
);

export const IconSearch = ({ size = 16, className, ...props }: IconProps) => (
  <Search size={size} className={className} strokeWidth={2} {...props} />
);

export const IconInspect = ({ size = 14, className, ...props }: IconProps) => (
  <ExternalLink size={size} className={className} strokeWidth={2} {...props} />
);

export const IconDelete = ({ size = 14, className, ...props }: IconProps) => (
  <Trash2 size={size} className={className} strokeWidth={2} {...props} />
);

export const IconTip = ({ size = 16, className, ...props }: IconProps) => (
  <Lightbulb size={size} className={className} strokeWidth={2} {...props} />
);

export const IconInfo = ({ size = 16, className, ...props }: IconProps) => (
  <Info size={size} className={className} strokeWidth={2} {...props} />
);

export const IconArrowRight = ({ size = 14, className, ...props }: IconProps) => (
  <ArrowRight size={size} className={className} strokeWidth={2} {...props} />
);

export const IconArrowLeft = ({ size = 14, className, ...props }: IconProps) => (
  <ArrowLeft size={size} className={className} strokeWidth={2} {...props} />
);
