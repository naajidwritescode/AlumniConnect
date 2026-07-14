import React, { useState } from "react";
import { 
  Users, 
  Briefcase, 
  Megaphone, 
  Inbox, 
  MessageSquare, 
  User, 
  Settings, 
  ShieldAlert, 
  LogOut, 
  Menu, 
  X,
  Sparkles
} from "lucide-react";
import { UserRole } from "../types";

interface SidebarProps {
  role: UserRole;
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  networkName: string;
  userName: string;
  userPhoto: string;
  onLogout: () => void;
  pendingRequestsCount?: number;
  onSwitchNetwork?: () => void;
}

export default function Sidebar({
  role,
  currentTab,
  setCurrentTab,
  networkName,
  userName,
  userPhoto,
  onLogout,
  pendingRequestsCount = 0,
  onSwitchNetwork
}: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);

  const getMenuItems = () => {
    const items = [
      { id: "dashboard", label: "Dashboard", icon: Sparkles, roles: ["student", "alumnus", "admin"] },
      { id: "directory", label: "Alumni Directory", icon: Users, roles: ["student", "alumnus", "admin"] },
      { id: "opportunities", label: "Opportunity Board", icon: Briefcase, roles: ["student", "alumnus", "admin"] },
      { id: "announcements", label: "Announcements", icon: Megaphone, roles: ["student", "alumnus", "admin"] },
    ];

    if (role === "student") {
      items.push(
        { id: "requests", label: "My Requests", icon: Inbox, roles: ["student"] },
        { id: "messages", label: "Messages", icon: MessageSquare, roles: ["student"] },
        { id: "profile", label: "My Interests", icon: User, roles: ["student"] }
      );
    }

    if (role === "alumnus") {
      items.push(
        { id: "requests", label: "Mentorship Requests", icon: Inbox, roles: ["alumnus"] },
        { id: "messages", label: "Messages", icon: MessageSquare, roles: ["alumnus"] },
        { id: "profile", label: "My Profile & Journey", icon: User, roles: ["alumnus"] }
      );
    }

    if (role === "admin") {
      items.push(
        { id: "manage-alumni", label: "Manage Alumni", icon: ShieldAlert, roles: ["admin"] },
        { id: "settings", label: "Network Settings", icon: Settings, roles: ["admin"] }
      );
    }

    return items;
  };

  const menuItems = getMenuItems();

  const handleTabClick = (tabId: string) => {
    setCurrentTab(tabId);
    setIsOpen(false);
  };

  return (
    <>
      {/* Mobile Top Bar */}
      <header className="lg:hidden h-16 bg-[#1C1A17] text-[#FAF7F2] flex items-center justify-between px-4 fixed top-0 left-0 right-0 z-40 shadow-sm border-b border-[#2E2B27]">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-none border border-[#E5E2DA]/30 bg-[#2E2B27] flex items-center justify-center font-serif italic text-[#FAF7F2] font-semibold text-sm">
            AC
          </div>
          <span className="font-serif italic font-semibold tracking-tight truncate max-w-[180px]">{networkName || "AlumniConnect"}</span>
        </div>
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="p-1 hover:bg-[#2E2B27] rounded-none transition-colors"
          id="mobile-menu-btn"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* Sidebar Overlay for Mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden transition-opacity" 
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Main Sidebar Container */}
      <aside className={`
        fixed lg:sticky top-0 left-0 bottom-0 z-40
        w-64 bg-[#1C1A17] text-[#FAF7F2] border-r border-[#2E2B27]
        flex flex-col justify-between h-screen
        transition-transform duration-300 ease-in-out
        ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        pt-16 lg:pt-0
      `}>
        {/* Network Header for Desktop */}
        <div className="hidden lg:flex items-center space-x-3 px-6 py-6 border-b border-[#2E2B27]">
          <div className="w-10 h-10 rounded-none border border-[#FAF7F2]/20 bg-[#2E2B27] flex items-center justify-center font-serif italic text-[#FAF7F2] text-lg font-bold shadow-sm shrink-0">
            AC
          </div>
          <div className="min-w-0">
            <h1 className="font-serif italic font-semibold text-[#FAF7F2] tracking-tight leading-tight truncate max-w-[150px] text-lg">
              {networkName || "AlumniConnect"}
            </h1>
            <p className="text-[10px] text-stone-400 font-mono tracking-wider uppercase pt-0.5">
              {role} portal
            </p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            const showBadge = item.id === "requests" && role === "alumnus" && pendingRequestsCount > 0;

            return (
              <button
                key={item.id}
                id={`tab-${item.id}`}
                onClick={() => handleTabClick(item.id)}
                className={`
                  w-full flex items-center justify-between px-3 py-2.5 rounded-none text-xs font-medium tracking-wide uppercase transition-all duration-150 border
                  ${isActive 
                    ? "bg-[#2E2B27] text-[#FAF7F2] border-[#3E3A35] font-semibold" 
                    : "text-stone-300 border-transparent hover:bg-[#2E2B27]/40 hover:text-white"
                  }
                `}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-4 h-4 ${isActive ? "text-amber-500" : "text-stone-400"}`} />
                  <span className="font-sans">{item.label}</span>
                </div>
                {showBadge && (
                  <span className="bg-amber-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-none shadow-sm animate-pulse">
                    {pendingRequestsCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Card & Logout */}
        <div className="p-4 border-t border-[#2E2B27] bg-[#141311]">
          <div className="flex items-center space-x-3 mb-4">
            <img 
              src={userPhoto || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80"} 
              alt={userName}
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-none border border-[#2E2B27] bg-[#1C1A17] object-cover shrink-0"
            />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-serif font-semibold text-[#FAF7F2] truncate leading-none mb-1.5">
                {userName}
              </h2>
              <span className="inline-block text-[10px] bg-[#2E2B27] text-stone-300 px-2 py-0.5 rounded-none font-mono tracking-wider capitalize">
                {role}
              </span>
            </div>
          </div>

          {onSwitchNetwork && (
            <button
              onClick={onSwitchNetwork}
              id="switch-network-btn"
              className="w-full mb-2 flex items-center justify-center space-x-2 px-3 py-2 border border-stone-800 rounded-none text-xs font-medium text-stone-400 hover:text-white hover:bg-[#2E2B27] hover:border-stone-700 transition-colors"
            >
              <span>Switch School Network</span>
            </button>
          )}

          <button
            onClick={onLogout}
            id="logout-btn"
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 border border-stone-800 rounded-none text-xs font-medium text-stone-400 hover:text-white hover:bg-[#2E2B27] hover:border-stone-700 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
