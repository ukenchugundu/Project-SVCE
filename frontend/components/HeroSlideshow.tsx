import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import campus1 from "@/assets/campus-1.jpeg";
import campus2 from "@/assets/campus-2.jpg";
import campus3 from "@/assets/campus-3.jpg";
import campus4 from "@/assets/campus-4.avif";
import campus5 from "@/assets/campus-5.jpeg";

const images = [campus1, campus2, campus3, campus4, campus5];
const captions = [
  "SVCE Tirupati — Building Future Engineers",
  "State-of-the-Art Library & Learning Resources",
  "A Campus Built for Learning, Growth, and Excellence",
  "Grand Auditorium & Events",
  "World-Class Sports Facilities",
];
 
const HeroSlideshow = () => {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setCurrent((p) => (p + 1) % images.length), 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          <img
            src={images[current]}
            alt={captions[current]}
            className="w-full h-full object-cover animate-ken-burns"
          />
        </motion.div>
      </AnimatePresence>

      {/* Gradient overlay */}
      <div className="absolute inset-0 gradient-hero-overlay" />

      {/* Floating orbs */}
      <div className="floating-orb w-96 h-96 bg-primary top-10 -left-20" />
      <div className="floating-orb w-72 h-72 bg-accent bottom-20 right-10" style={{ animationDelay: "3s" }} />

      {/* Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 z-10">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          <span className="inline-block px-4 py-1.5 rounded-full text-xs font-medium tracking-wider uppercase bg-primary/20 text-primary-foreground border border-primary/30 backdrop-blur-sm mb-6">
            Sri Venkateswara College of Engineering
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="text-5xl md:text-7xl lg:text-8xl font-heading font-bold mb-4 text-white"
        >
          Edu<span className="text-gradient">Hub</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="text-lg md:text-xl text-white/70 font-light max-w-xl mb-4"
        >
          A Learning Platform
        </motion.p>

        <AnimatePresence mode="wait">
          <motion.p
            key={current}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5 }}
            className="text-sm text-white/50 mb-10"
          >
            {captions[current]}
          </motion.p>
        </AnimatePresence>

        {/* Dots */}
        <div className="flex gap-2">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i === current
                  ? "bg-primary w-10"
                  : "bg-white/30 w-4 hover:bg-white/50"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
      >
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs text-white/40 tracking-widest uppercase">Scroll</span>
          <ChevronDown className="w-5 h-5 text-white/40" />
        </div>
      </motion.div>
    </div>
  );
};

export default HeroSlideshow;
