import { motion } from "framer-motion";
import FacultyCard from "./FacultyCard";

const LeadershipSection = () => (
  <section className="section-padding gradient-dark relative overflow-hidden">
    <div className="floating-orb w-80 h-80 bg-primary top-0 right-0" />
    <div className="floating-orb w-60 h-60 bg-accent bottom-0 left-10" style={{ animationDelay: "4s" }} />

    <div className="container max-w-6xl relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="text-center mb-14"
      >
        <span className="text-xs font-medium tracking-widest uppercase text-primary mb-3 block">Leadership</span>
        <h2 className="text-4xl md:text-5xl font-heading font-bold text-white mb-2">
          Our <span className="text-gradient">Leadership</span>
        </h2>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
        {[
          { name: "Dr. Vijaya Gunturu", designation: "Principal", qualification: "Ph.D.(IIT Roorke), Mtech. " },
          { name: "Dr.Tharakeshwar A", designation: "Vice Principal", qualification: "Ph.D." },
        ].map((f, i) => (
          <motion.div
            key={f.name}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.15 }}
          >
            <FacultyCard {...f} isLarge />
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default LeadershipSection;
