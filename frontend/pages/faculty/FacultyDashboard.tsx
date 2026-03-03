import FacultyLayout from "@/components/FacultyLayout";
import { motion } from "framer-motion";
import { Clock, Users, FileText, Calendar, BookOpen, AlertCircle, Zap } from "lucide-react";

const FacultyDashboard = () => {
  return (
    <FacultyLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Command Center</h1>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: BookOpen, label: "Active Classes", value: "4", gradient: "from-accent to-accent/60" },
            { icon: Users, label: "Total Students", value: "240", gradient: "from-primary to-primary/60" },
            { icon: FileText, label: "Pending Grades", value: "12", gradient: "from-destructive to-destructive/60" },
            { icon: Clock, label: "Next Class", value: "10:00 AM", sub: "CS-302 · DBMS", gradient: "from-gold to-gold/60" },
          ].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="glass-card rounded-2xl p-5 card-hover">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.gradient} flex items-center justify-center mb-3`}>
                <s.icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-heading font-bold text-foreground">{s.value}</p>
              {s.sub && <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>}
            </motion.div>
          ))}
        </div>

        <div className="glass-card rounded-2xl p-6">
          <h2 className="font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-accent" /> Today's Schedule
          </h2>
          <div className="space-y-2">
            {[
              { time: "9:00 - 9:50", cls: "III CSE-A", subject: "Data Structures", room: "CS-301" },
              { time: "10:00 - 10:50", cls: "III CSE-B", subject: "DBMS", room: "CS-302" },
              { time: "11:00 - 12:50", cls: "III CSD-A", subject: "DS Lab", room: "Lab-1" },
              { time: "2:00 - 2:50", cls: "II CSE-A", subject: "Programming in C", room: "CS-101" },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-4 p-3.5 rounded-xl bg-secondary/50 text-sm hover:bg-secondary transition-colors">
                <span className="text-muted-foreground w-28 shrink-0 font-mono text-xs">{s.time}</span>
                <span className="font-medium text-foreground flex-1">{s.subject}</span>
                <span className="text-xs text-accent font-medium">{s.cls}</span>
                <span className="text-xs text-muted-foreground">{s.room}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6">
          <h2 className="font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-destructive" /> Pending Grades
          </h2>
          <div className="space-y-2">
            {[
              { cls: "III CSE-A", assignment: "DS Assignment #3", pending: 8 },
              { cls: "III CSE-B", assignment: "DBMS Quiz Unit 2", pending: 4 },
            ].map((g, i) => (
              <div key={i} className="flex items-center justify-between p-3.5 bg-secondary/50 rounded-xl text-sm hover:bg-secondary transition-colors">
                <div>
                  <p className="font-medium text-foreground">{g.assignment}</p>
                  <p className="text-xs text-muted-foreground">{g.cls}</p>
                </div>
                <span className="px-3 py-1.5 rounded-full bg-destructive/10 text-destructive text-xs font-semibold">{g.pending} pending</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </FacultyLayout>
  );
};

export default FacultyDashboard;
