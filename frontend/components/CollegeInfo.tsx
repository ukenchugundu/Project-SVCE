import { motion } from "framer-motion";
import { GraduationCap, BookOpen, Users, Award } from "lucide-react";

const stats = [
  { icon: GraduationCap, label: "Students", value: "5000+", color: "from-primary to-primary/60" },
  { icon: BookOpen, label: "Programs", value: "9", color: "from-accent to-accent/60" },
  { icon: Users, label: "Faculty", value: "300+", color: "from-gold to-gold/60" },
  { icon: Award, label: "Years", value: "15+", color: "from-destructive to-destructive/60" },
];

const CollegeInfo = () => (
  <section className="section-padding bg-background relative overflow-hidden">
    <div className="gradient-mesh absolute inset-0" />
    <div className="container max-w-6xl relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="text-center mb-16"
      >
        <span className="text-xs font-medium tracking-widest uppercase text-primary mb-3 block">About Us</span>
        <h2 className="text-4xl md:text-5xl font-heading font-bold text-foreground mb-6">
          About <span className="text-gradient">SVCE</span>, Tirupati
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed text-base">
          Sri Venkateswara College of Engineering is a premier institution committed to providing
          quality technical education with state-of-the-art infrastructure and experienced faculty.
        </p>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className="group glass-card rounded-2xl p-6 text-center card-hover cursor-default"
          >
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${stat.color} flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-500`}>
              <stat.icon className="w-7 h-7 text-white" />
            </div>
            <p className="text-3xl md:text-4xl font-heading font-bold text-foreground">
              {stat.value}
            </p>
            <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default CollegeInfo;
