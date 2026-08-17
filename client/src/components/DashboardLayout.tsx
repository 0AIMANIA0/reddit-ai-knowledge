import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { BookOpenText, Gauge, LogOut, PanelLeft, SlidersHorizontal, Sparkles } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

const menuItems = [
  { icon: Gauge, label: "ダッシュボード", path: "/" },
  { icon: BookOpenText, label: "知識ベース", path: "/knowledge" },
  { icon: SlidersHorizontal, label: "収集条件", path: "/rules" },
];

const SIDEBAR_WIDTH_KEY = "reddit-ai-sidebar-width";
const DEFAULT_WIDTH = 276;
const MIN_WIDTH = 220;
const MAX_WIDTH = 360;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) {
    return (
      <div className="auth-stage">
        <div className="auth-orbit auth-orbit-a" />
        <div className="auth-orbit auth-orbit-b" />
        <section className="auth-card">
          <div className="brand-mark"><Sparkles size={18} /></div>
          <p className="eyebrow">REDDIT AI KNOWLEDGE</p>
          <h1>海外のAIシグナルを、<br />日本語の知識へ。</h1>
          <p className="auth-copy">対象コミュニティの情報を選び、翻訳・要約・分類された知識として蓄積します。</p>
          <Button onClick={() => startLogin()} className="auth-button">ログインして開始する</Button>
        </section>
      </div>
    );
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>{children}</DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({ children, setSidebarWidth }: { children: React.ReactNode; setSidebarWidth: (width: number) => void }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const isMobile = useIsMobile();
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find(item => (item.path === "/" ? location === "/" : location.startsWith(item.path)));

  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      if (!isResizing) return;
      const left = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const width = event.clientX - left;
      if (width >= MIN_WIDTH && width <= MAX_WIDTH) setSidebarWidth(width);
    };
    const handleUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMove);
      document.addEventListener("mouseup", handleUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="app-sidebar border-r-0" disableTransition={isResizing}>
          <SidebarHeader className="h-[88px] justify-center px-3">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={toggleSidebar} className="brand-mark shrink-0" aria-label="ナビゲーションを開閉"><PanelLeft size={17} /></button>
              {!isCollapsed && <div className="min-w-0"><p className="brand-title">Knowledge Signal</p><p className="brand-subtitle">REDDIT / AI / JP</p></div>}
            </div>
          </SidebarHeader>
          <SidebarContent className="px-3 pt-5">
            <p className="sidebar-label group-data-[collapsible=icon]:hidden">WORKSPACE</p>
            <SidebarMenu className="gap-1.5">
              {menuItems.map(item => {
                const isActive = item.path === "/" ? location === "/" : location.startsWith(item.path);
                return <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton isActive={isActive} onClick={() => setLocation(item.path)} tooltip={item.label} className="h-11 rounded-xl px-3 font-medium">
                    <item.icon size={17} />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>;
              })}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="profile-trigger">
                  <Avatar className="h-9 w-9 border border-white/15"><AvatarFallback className="profile-avatar">{user?.name?.charAt(0).toUpperCase() ?? "U"}</AvatarFallback></Avatar>
                  <span className="min-w-0 group-data-[collapsible=icon]:hidden"><strong>{user?.name || "ユーザー"}</strong><small>管理者ワークスペース</small></span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive"><LogOut className="mr-2 h-4 w-4" />ログアウト</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div className={`sidebar-resizer ${isCollapsed ? "hidden" : ""}`} onMouseDown={() => !isCollapsed && setIsResizing(true)} />
      </div>
      <SidebarInset className="app-inset">
        {isMobile && <header className="mobile-topbar"><SidebarTrigger className="h-9 w-9 rounded-xl" /><span>{activeMenuItem?.label ?? "Knowledge Signal"}</span></header>}
        <main className="app-main">{children}</main>
      </SidebarInset>
    </>
  );
}
