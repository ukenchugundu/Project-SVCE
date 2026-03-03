import { motion } from "framer-motion";
import { Calendar, Clock, MapPin, ArrowRight } from "lucide-react";

const events = [
  { title: "Annual Tech Fest - Innovista 2026", date: "March 15-17, 2026", time: "9:00 AM - 6:00 PM", location: "Main Auditorium", tag: "Tech Fest", color: "from-primary to-primary/60" },
  { title: "National Level Hackathon", date: "March 22, 2026", time: "24 Hours", location: "CS Block Lab", tag: "Hackathon", color: "from-accent to-accent/60" },
  { title: "Guest Lecture: AI in Healthcare", date: "March 28, 2026", time: "2:00 PM", location: "Seminar Hall", tag: "Seminar", color: "from-gold to-gold/60" },
  { title: "Sports Day 2026", date: "April 5, 2026", time: "8:00 AM", location: "Sports Ground", tag: "Sports", color: "from-destructive to-destructive/60" },
];

const UpcomingEvents = () => (
  <section className="section-padding bg-secondary/30 relative overflow-hidden">
    <div className="container max-w-6xl relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="text-center mb-14"
      >
        <span className="text-xs font-medium tracking-widest uppercase text-primary mb-3 block">What's Coming</span>
        <h2 className="text-4xl md:text-5xl font-heading font-bold text-foreground">
          Upcoming <span className="text-gradient">Events</span>
        </h2>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {events.map((event, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className="group glass-card rounded-2xl p-6 card-hover cursor-default"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`px-3 py-1 rounded-full text-xs font-semibold text-white bg-gradient-to-r ${event.color}`}>
                {event.tag}
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all duration-300" />
            </div>
            <h3 className="font-heading font-bold text-foreground text-lg mb-3">{event.title}</h3>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-primary" /> {event.date}</span>
              <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-primary" /> {event.time}</span>
              <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-primary" /> {event.location}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default UpcomingEvents;
