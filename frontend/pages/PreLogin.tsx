import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LogIn, GraduationCap } from "lucide-react";
import HeroSlideshow from "@/components/HeroSlideshow";
import CollegeInfo from "@/components/CollegeInfo";
import LeadershipSection from "@/components/LeadershipSection";
import DepartmentBulletins from "@/components/DepartmentBulletins";
import UpcomingEvents from "@/components/UpcomingEvents";
import Footer from "@/components/Footer";

const PreLogin = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Navbar */}
      <motion.nav
        initial={{ y: -80 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50"
      >
        <div className="container max-w-6xl flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="font-heading font-bold text-foreground text-lg">
              EduHub
            </span>
          </div>
          <button
            onClick={() => navigate("/auth")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full gradient-primary text-white font-medium text-sm hover:shadow-lg hover:shadow-primary/25 transition-all duration-300 hover:-translate-y-0.5"
          >
            <LogIn className="w-4 h-4" />
            Login
          </button>
        </div>
      </motion.nav>

      <HeroSlideshow />
      <CollegeInfo />
      <LeadershipSection />
      <DepartmentBulletins />
      <UpcomingEvents />
      <Footer />
    </div>
  );
};

export default PreLogin;
