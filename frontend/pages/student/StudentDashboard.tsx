import StudentLayout from "@/components/StudentLayout";
import { motion } from "framer-motion";
import {
  BarChart3, BookOpen, Clock, AlertTriangle, TrendingUp,
  CheckCircle, Calendar, Zap
} from "lucide-react";

const StudentDashboard = () => (
  <StudentLayout>
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">My Insights</h1>
          <p className="text-sm text-muted-foreground">Welcome back, John!</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Attendance", value: "87%", icon: CheckCircle, gradient: "from-accent to-accent/60" },
          { label: "Current CGPA", value: "8.45", icon: TrendingUp, gradient: "from-primary to-primary/60" },
          { label: "Literacy %", value: "92%", icon: BarChart3, gradient: "from-gold to-gold/60" },
          { label: "Pending Tasks", value: "3", icon: Clock, gradient: "from-destructive to-destructive/60" },
        ].map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className="glass-card rounded-2xl p-5 card-hover">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
            </div>
            <p className="text-3xl font-heading font-bold text-foreground">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Upcoming tasks */}
      <div className="glass-card rounded-2xl p-6">
        <h2 className="font-heading font-semibold text-foreground text-lg mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-primary" /> Upcoming Tasks
        </h2>
        <div className="space-y-3">
          {[
            { task: "Data Structures Assignment #4", due: "Feb 28, 2026", type: "Assignment" },
            { task: "DBMS Quiz - Unit 3", due: "Mar 2, 2026", type: "Quiz" },
            { task: "OS Lab Report Submission", due: "Mar 5, 2026", type: "Assignment" },
          ].map((t, i) => (
            <div key={i} className="flex items-center justify-between p-3.5 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors duration-300">
              <div>
                <p className="font-medium text-foreground text-sm">{t.task}</p>
                <p className="text-xs text-muted-foreground">Due: {t.due}</p>
              </div>
              <span className="text-xs px-3 py-1.5 rounded-full gradient-primary text-white font-medium">{t.type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Risk & Timetable */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-2xl p-6">
          <h2 className="font-heading font-semibold text-foreground text-lg mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" /> Risk Management
          </h2>
          <div className="space-y-3">
            {[
              { subject: "Computer Networks", risk: "High", attendance: "65%" },
              { subject: "Operating Systems", risk: "Medium", attendance: "72%" },
              { subject: "DBMS", risk: "Low", attendance: "90%" },
            ].map((s, i) => (
              <div key={i} className="flex items-center justify-between p-3.5 rounded-xl bg-secondary/50">
                <span className="text-sm font-medium text-foreground">{s.subject}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">Att: {s.attendance}</span>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    s.risk === "High" ? "bg-destructive/10 text-destructive" :
                    s.risk === "Medium" ? "bg-gold/10 text-gold" :
                    "bg-accent/10 text-accent"
                  }`}>{s.risk}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6">
          <h2 className="font-heading font-semibold text-foreground text-lg mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" /> Today's Timetable
          </h2>
          <div className="space-y-2">
            {[
              { time: "9:00 - 9:50", subject: "Data Structures", room: "CS-301" },
              { time: "10:00 - 10:50", subject: "DBMS", room: "CS-302" },
              { time: "11:00 - 11:50", subject: "Computer Networks", room: "CS-303" },
              { time: "12:00 - 12:50", subject: "Operating Systems", room: "CS-304" },
              { time: "2:00 - 3:50", subject: "DS Lab", room: "Lab-1" },
            ].map((cls, i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-secondary/50 text-sm hover:bg-secondary transition-colors">
                <span className="text-muted-foreground w-28 shrink-0 font-mono text-xs">{cls.time}</span>
                <span className="font-medium text-foreground flex-1">{cls.subject}</span>
                <span className="text-xs text-primary font-medium">{cls.room}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </StudentLayout>
);

export default StudentDashboard;
