import { Facebook, Twitter, Instagram, Linkedin, Youtube, Mail, Phone, MapPin, GraduationCap } from "lucide-react";

const Footer = () => (
  <footer className="gradient-dark text-white relative overflow-hidden">
    <div className="floating-orb w-60 h-60 bg-primary -top-10 -right-10" />
    <div className="container max-w-6xl px-4 py-14 md:px-8 relative z-10">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="font-heading font-bold text-xl">EduHub</span>
          </div>
          <p className="text-sm text-white/50 leading-relaxed">
            A comprehensive platform for students, faculty, and administration of SVCE Tirupati.
          </p>
        </div>

        <div>
          <h4 className="font-heading font-semibold mb-4 text-sm tracking-wider uppercase text-white/70">Contact</h4>
          <div className="space-y-3 text-sm text-white/50">
            <p className="flex items-center gap-2.5"><MapPin className="w-4 h-4 text-primary shrink-0" /> SVCE, Tirupati, Andhra Pradesh</p>
            <p className="flex items-center gap-2.5"><Phone className="w-4 h-4 text-primary" /> +91-877-XXXXXXX</p>
            <p className="flex items-center gap-2.5"><Mail className="w-4 h-4 text-primary" /> info@svce-tirupati.edu.in</p>
          </div>
        </div>

        <div>
          <h4 className="font-heading font-semibold mb-4 text-sm tracking-wider uppercase text-white/70">Follow Us</h4>
          <div className="flex gap-3">
            {[Facebook, Twitter, Instagram, Linkedin, Youtube].map((Icon, i) => (
              <a key={i} href="#" className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center hover:bg-primary/20 hover:scale-110 transition-all duration-300 group border border-white/10">
                <Icon className="w-4 h-4 text-white/50 group-hover:text-primary transition-colors" />
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 pt-6 text-center text-xs text-white/30">
        © 2026 EduHub — SVCE Tirupati. All rights reserved.
      </div>
    </div>
  </footer>
);

export default Footer;
