import { useState } from "react";
import FacultyLayout from "@/components/FacultyLayout";
import { motion } from "framer-motion";
import { ClipboardCheck, CheckCircle, XCircle, Save } from "lucide-react";

const classes = ["III CSE-A", "III CSE-B", "III CSD-A", "II CSE-A"];
const studentsList = [
  { name: "Ravi Kumar", roll: "21BCE7001" },
  { name: "Priya Sharma", roll: "21BCE7002" },
  { name: "Karthik M", roll: "21BCE7003" },
  { name: "Swetha R", roll: "21BCE7004" },
  { name: "Arun P", roll: "21BCE7005" },
  { name: "Deepa L", roll: "21BCE7006" },
];

const FacultyAttendance = () => {
  const [selectedClass, setSelectedClass] = useState(classes[0]);
  const [attendance, setAttendance] = useState<Record<string, boolean>>(
    Object.fromEntries(studentsList.map((s) => [s.roll, true]))
  );

  const toggle = (roll: string) => setAttendance((prev) => ({ ...prev, [roll]: !prev[roll] }));
  const present = Object.values(attendance).filter(Boolean).length;

  return (
    <FacultyLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center">
            <ClipboardCheck className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Attendance</h1>
        </div>

        <div className="flex flex-wrap gap-2">
          {classes.map((cls) => (
            <button key={cls} onClick={() => setSelectedClass(cls)}
              className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${selectedClass === cls ? "gradient-accent text-white shadow-lg glow-accent" : "bg-secondary text-secondary-foreground hover:bg-muted"}`}>
              {cls}
            </button>
          ))}
        </div>

        <div className="glass-card rounded-2xl p-4 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Date: Feb 24, 2026 · {selectedClass}</span>
          <span className="text-sm font-semibold text-foreground">{present}/{studentsList.length} Present</span>
        </div>

        <div className="space-y-2">
          {studentsList.map((s, i) => (
            <motion.div key={s.roll} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
              className="glass-card rounded-2xl p-4 flex items-center justify-between card-hover">
              <div>
                <p className="font-medium text-foreground">{s.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{s.roll}</p>
              </div>
              <button onClick={() => toggle(s.roll)} className="p-2 rounded-xl hover:bg-secondary transition-colors">
                {attendance[s.roll] ? (
                  <CheckCircle className="w-7 h-7 text-accent" />
                ) : (
                  <XCircle className="w-7 h-7 text-destructive" />
                )}
              </button>
            </motion.div>
          ))}
        </div>

        <button className="w-full py-3.5 rounded-xl gradient-accent text-white font-semibold flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-accent/20 transition-all hover:-translate-y-0.5">
          <Save className="w-5 h-5" /> Save Attendance
        </button>
      </div>
    </FacultyLayout>
  );
};

export default FacultyAttendance;
