import { ChangeEvent, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, Settings,
  LogOut, Menu, X, User, Shield, ChevronRight, Camera, Trash2
} from "lucide-react";
import {
  buildProfileImageDataUrl,
  getProfileIdentifierLabel,
  getProfileIdentifierValue,
  isAcceptedProfileImageFile,
  PROFILE_IMAGE_ACCEPT,
  readStoredAuth,
  readStoredProfileImage,
  removeStoredProfileImage,
  writeStoredProfileImage,
} from "@/lib/authSession";

const sidebarItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/admin" },
  { label: "Manage Users", icon: Users, path: "/admin/users" },
  { label: "Settings", icon: Settings, path: "/admin/settings" },
];

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const auth = readStoredAuth();
  const profileName = auth?.fullName?.trim() || auth?.email.split("@")[0] || "Admin";
  const profileEmail = auth?.email || "-";
  const profileIdentifierLabel = getProfileIdentifierLabel(auth);
  const profileIdentifierValue = getProfileIdentifierValue(auth);
  const [profileImage, setProfileImage] = useState<string>(() => readStoredProfileImage(auth));
  const profileFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleUploadProfileImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!isAcceptedProfileImageFile(file)) {
      window.alert("Unsupported image type. Please choose a valid image format.");
      event.target.value = "";
      return;
    }

    const maxSizeBytes = 15 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      window.alert("Profile image must be 15 MB or smaller.");
      event.target.value = "";
      return;
    }

    buildProfileImageDataUrl(file)
      .then((result) => {
        setProfileImage(result);
        const persisted = writeStoredProfileImage(auth, result);
        if (!persisted) {
          window.alert(
            "Photo updated, but browser storage is full. Use a smaller image for permanent save."
          );
        }
      })
      .catch(() => {
        window.alert("Could not process this image. Please try a different format.");
      });
    event.target.value = "";
  };

  const handleRemoveProfileImage = () => {
    setProfileImage("");
    removeStoredProfileImage(auth);
  };

  const handleLogout = () => {
    localStorage.removeItem("eduhub_auth");
    localStorage.removeItem("eduhub_student_id");
    navigate("/auth");
  };

  return (
    <div className="min-h-screen flex bg-background">
      <aside className={`fixed inset-y-0 left-0 z-40 bg-sidebar border-r border-sidebar-border transition-all duration-500 flex flex-col ${sidebarOpen ? "w-64" : "w-[72px]"}`}>
        <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
          <div className="w-9 h-9 rounded-xl gradient-gold flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-white" />
          </div>
          {sidebarOpen && <span className="font-heading font-bold text-sidebar-foreground text-sm">Admin Panel</span>}
        </div>
        <nav className="flex-1 py-4 space-y-1 px-3">
          {sidebarItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <button key={item.path} onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-all duration-300 ${active ? "gradient-gold text-white shadow-lg shadow-gold/20 font-medium" : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50"}`}>
                <item.icon className="w-5 h-5 shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
                {sidebarOpen && active && <ChevronRight className="w-4 h-4 ml-auto" />}
              </button>
            );
          })}
        </nav>
        <div className="px-3 py-4 border-t border-sidebar-border">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-sidebar-foreground/50 hover:bg-destructive/10 hover:text-destructive transition-all duration-300">
            <LogOut className="w-5 h-5 shrink-0" />{sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      <div className={`flex-1 transition-all duration-500 ${sidebarOpen ? "ml-64" : "ml-[72px]"}`}>
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/50 px-6 py-3 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2.5 rounded-xl hover:bg-secondary transition-colors">
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="relative">
            <button
              onClick={() => setProfileOpen((previous) => !previous)}
              className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-secondary transition-colors"
            >
              <div className="w-9 h-9 rounded-xl gradient-gold flex items-center justify-center">
                {profileImage ? (
                  <img src={profileImage} alt={profileName} className="w-9 h-9 rounded-xl object-cover" />
                ) : (
                  <User className="w-4 h-4 text-white" />
                )}
              </div>
              <span className="text-sm font-medium text-foreground hidden md:inline">{profileName}</span>
            </button>
            <AnimatePresence>
              {profileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 top-full mt-2 w-72 glass-card rounded-2xl p-6 shadow-2xl border border-border z-50"
                >
                  <div className="text-center mb-4">
                    <div className="w-16 h-16 rounded-2xl gradient-gold flex items-center justify-center mx-auto mb-3">
                      {profileImage ? (
                        <img src={profileImage} alt={profileName} className="w-16 h-16 rounded-2xl object-cover" />
                      ) : (
                        <User className="w-8 h-8 text-white" />
                      )}
                    </div>
                    <h3 className="font-heading font-bold text-foreground">{profileName}</h3>
                    <p className="text-sm text-muted-foreground">{profileIdentifierLabel}: {profileIdentifierValue}</p>
                  </div>
                  <input
                    ref={profileFileInputRef}
                    type="file"
                    accept={PROFILE_IMAGE_ACCEPT}
                    className="hidden"
                    onChange={handleUploadProfileImage}
                  />
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() => profileFileInputRef.current?.click()}
                      className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs bg-secondary text-foreground hover:bg-secondary/70"
                    >
                      <Camera className="w-3.5 h-3.5" /> Update Photo
                    </button>
                    {profileImage ? (
                      <button
                        type="button"
                        onClick={handleRemoveProfileImage}
                        className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs bg-destructive/15 text-destructive hover:bg-destructive/25"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    ) : null}
                  </div>
                  <div className="text-sm space-y-2 text-muted-foreground">
                    <p><strong className="text-foreground">Username:</strong> {profileName}</p>
                    <p><strong className="text-foreground">Email:</strong> {profileEmail}</p>
                    <p><strong className="text-foreground">{profileIdentifierLabel}:</strong> {profileIdentifierValue}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </header>
        <main className="p-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
