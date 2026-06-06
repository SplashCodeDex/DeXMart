import {
  Zap,
  Search,
  Globe,
  Terminal,
  Code,
  MessageSquare,
  Bot,
  DollarSign,
  ShieldCheck,
  Calendar,
  Brain,
  FileSearch,
  Cpu,
} from "lucide-react";
import React from "react";

const ICON_MAP: Record<string, React.ReactNode> = {
  // Agent Templates
  sales: <DollarSign className="h-5 w-5 text-emerald-500" />,
  support: <ShieldCheck className="h-5 w-5 text-blue-500" />,
  assistant: <Calendar className="h-5 w-5 text-purple-500" />,
  bot: <Bot className="h-5 w-5 text-primary" />,

  // Skills
  "web-search": <Globe className="h-5 w-5 text-sky-500" />,
  firecrawl: <FileSearch className="h-5 w-5 text-orange-500" />,
  "brave-search": <Search className="h-5 w-5 text-amber-500" />,
  perplexity: <Brain className="h-5 w-5 text-purple-500" />,
  "coding-agent": <Code className="h-5 w-5 text-emerald-500" />,
  "custom-hooks": <Terminal className="h-5 w-5 text-pink-500" />,
  whatsapp: <MessageSquare className="h-5 w-5 text-green-500" />,
  default: <Zap className="h-5 w-5 text-primary" />,
  memory: <Cpu className="h-5 w-5 text-blue-400" />,
};

/**
 * Get a Lucide icon for a given key (skill ID, agent type, etc.)
 * Adheres to Rule 181 by avoiding emoji fallbacks.
 */
export function getIcon(key: string | undefined): React.ReactNode {
  if (!key) return ICON_MAP.default;
  return ICON_MAP[key.toLowerCase()] || ICON_MAP.default;
}
