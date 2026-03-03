import { useState } from "react";
import FacultyLayout from "@/components/FacultyLayout";
import { motion } from "framer-motion";
import { Users, TrendingUp, TrendingDown, CheckCircle, XCircle } from "lucide-react";

const classes = ["III CSE-A", "III CSE-B", "III CSD-A", "II CSE-A"];
const students = [
  { name: "Ravi Kumar", roll: "21BCE7001", attendance: "92%", cgpa: "8.9", literacy: "95%", assignment: "Done" },
  { name: "Priya Sharma", roll: "21BCE7002", attendance: "88%", cgpa: "8.5", literacy: "91%", assignment: "Done" },
  { name: "Karthik M", roll: "21BCE7003", attendance: "65%", cgpa: "6.2", literacy: "70%", assignment: "Not yet" },
  { name: "Swetha R", roll: "21BCE7004", attendance: "95%", cgpa: "9.1", literacy: "97%", assignment: "Done" },
  { name: "Arun P", roll: "21BCE7005", attendance: "72%", cgpa: "7.0", literacy: "75%", assignment: "Not yet" },
  { name: "Deepa L", roll: "21BCE7006", attendance: "90%", cgpa: "8.7", literacy: "93%", assignment: "Done" },
];

const FacultyRoster = () => {
  const [selectedClass, setSelectedClass] = useState(classes[0]);
  const sorted = [...students].sort((a, b) => parseFloat(b.literacy) - parseFloat(a.literacy));

  return (
    <FacultyLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Student Roster</h1>
        </div>

        <div className="flex flex-wrap gap-2">
          {classes.map((cls) => (
            <button key={cls} onClick={() => setSelectedClass(cls)}
              className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${selectedClass === cls ? "gradient-accent text-white shadow-lg glow-accent" : "bg-secondary text-secondary-foreground hover:bg-muted"}`}>
              {cls}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass-card rounded-2xl p-5">
            <h3 className="font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-accent" /> Top Performers
            </h3>
            {sorted.slice(0, 2).map((s, i) => (
              <div key={i} className="p-3 bg-accent/5 rounded-xl mb-2 flex justify-between items-center">
                <span className="font-medium text-foreground text-sm">{s.name}</span>
                <span className="text-accent font-bold text-sm">{s.literacy}</span>
              </div>
            ))}
          </div>
          <div className="glass-card rounded-2xl p-5">
            <h3 className="font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-destructive" /> Need Improvement
            </h3>
            {sorted.slice(-2).map((s, i) => (
              <div key={i} className="p-3 bg-destructive/5 rounded-xl mb-2 flex justify-between items-center">
                <span className="font-medium text-foreground text-sm">{s.name}</span>
                <span className="text-destructive font-bold text-sm">{s.literacy}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="gradient-accent text-white">
                  <th className="text-left p-4 font-medium">Name</th>
                  <th className="text-left p-4 font-medium">Roll No</th>
                  <th className="text-center p-4 font-medium">Attendance</th>
                  <th className="text-center p-4 font-medium">CGPA</th>
                  <th className="text-center p-4 font-medium">Literacy %</th>
                  <th className="text-center p-4 font-medium">Assignment</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => (
                  <motion.tr key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                    className="border-t border-border hover:bg-secondary/50 transition-colors">
                    <td className="p-4 font-medium">{s.name}</td>
                    <td className="p-4 text-muted-foreground font-mono text-xs">{s.roll}</td>
                    <td className="p-4 text-center">{s.attendance}</td>
                    <td className="p-4 text-center">{s.cgpa}</td>
                    <td className="p-4 text-center">{s.literacy}</td>
                    <td className="p-4 text-center">
                      {s.assignment === "Done" ? <CheckCircle className="w-5 h-5 text-accent inline" /> : <XCircle className="w-5 h-5 text-destructive inline" />}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </FacultyLayout>
  );
};

export default FacultyRoster;
