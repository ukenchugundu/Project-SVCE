import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import FacultyCard from "./FacultyCard";

const departments = ["CSE", "CSD", "CSM", "CSC", "IT", "EEE", "ME", "CE", "ECE"];

const departmentNames: Record<string, string> = {
  CSE: "Computer Science & Engineering",
  CSD: "Computer Science (Data Science)",
  CSM: "Computer Science (ML & AI)",
  CSC: "Computer Science (Cyber Security)",
  IT: "Information Technology",
  EEE: "Electrical & Electronics Engineering",
  ME: "Mechanical Engineering",
  CE: "Civil Engineering",
  ECE: "Electronics & Communication Engineering",
};

const facultyData: Record<
  string,
  { name: string; designation: string; qualification: string }[]
> = {
  CSE: [
    { name: "Dr.A.Ganesh", designation: "HOD - CSE", qualification: "Ph.D. AI & ML" },
    { name: "Prof. R. Lakshmi", designation: "Associate Professor", qualification: "M.Tech CSE" },
    { name: "Prof. K. Suresh", designation: "Assistant Professor", qualification: "M.Tech SE" },
    { name: "Prof. M. Priya", designation: "Assistant Professor", qualification: "M.Tech CSE" },
    { name: "Prof. V. Ravi Kumar", designation: "Assistant Professor", qualification: "M.Tech AI" },
  ],
  CSD: [
    { name: "Dr.Keerthipati Kumar", designation: "HOD - CSD", qualification: "Ph.D. Data Science" },
    { name: "Prof. S. Narasimhulu", designation: "Associate Professor", qualification: "M.Tech DS" },
    { name: "Prof. M. Sai Kumar", designation: "Assistant Professor", qualification: "M.Tech ML" },
    { name: "Prof. D. Lavanya", designation: "Assistant Professor", qualification: "M.Tech DS" },
    { name: "Prof. K. JeevanaSagari", designation: "Assistant Professor", qualification: "M.Tech DS" },
    { name: "Prof. K. JeevanaSagari", designation: "Assistant Professor", qualification: "M.Tech DS" },
  ],
  CSM: [
    { name: "Dr.R.Swathi", designation: "HOD - CSM", qualification: "Ph.D. Machine Learning" },
    { name: "Prof. L. Swathi", designation: "Associate Professor", qualification: "M.Tech AI" },
    { name: "Prof. B. Arun", designation: "Assistant Professor", qualification: "M.Tech ML" },
    { name: "Prof. D. Kavitha", designation: "Assistant Professor", qualification: "M.Tech DL" },
  ],
  CSC: [
    { name: "Dr Ch Santhaiah", designation: "HOD - CSC", qualification: "Ph.D. Cyber Security" },
    { name: "Prof. E. Swetha", designation: "Associate Professor", qualification: "M.Tech CS" },
    { name: "Prof. F. Mohan", designation: "Assistant Professor", qualification: "M.Tech NS" },
  ],
  IT: [
    { name: "Dr.B.Purushotham", designation: "HOD - IT", qualification: "Ph.D. Information Systems" },
    { name: "Prof. C. Anitha", designation: "Associate Professor", qualification: "M.Tech IT" },
    { name: "Prof. I. Ramesh", designation: "Assistant Professor", qualification: "M.Tech SE" },
    { name: "Prof. O. Divya", designation: "Assistant Professor", qualification: "M.Tech IT" },
  ],
  EEE: [
    { name: "Dr. V Lakshmi Devi", designation: "HOD - EEE", qualification: "Ph.D. Power Systems" },
    { name: "Prof. W. Padma", designation: "Associate Professor", qualification: "M.Tech EEE" },
    { name: "Prof. X. Vinod", designation: "Assistant Professor", qualification: "M.Tech PS" },
  ],
  ME: [
    { name: "Dr.M.ChandraSekharaReddy", designation: "HOD - ME", qualification: "Ph.D. Thermal Engg" },
    { name: "Prof. Z. Ravi", designation: "Associate Professor", qualification: "M.Tech ME" },
    { name: "Prof. Q. Sunitha", designation: "Assistant Professor", qualification: "M.Tech Design" },
  ],
  CE: [
    { name: "Dr.K.RamaKrishnaReddy", designation: "HOD - CE", qualification: "Ph.D. Structural Engg" },
    { name: "Prof. BB. Lavanya", designation: "Associate Professor", qualification: "M.Tech CE" },
    { name: "Prof. CC. Sreedhar", designation: "Assistant Professor", qualification: "M.Tech Geo" },
  ],
  ECE: [
    { name: "Dr.D.Srinivasulu Reddy", designation: "HOD - ECE", qualification: "Ph.D. VLSI" },
    { name: "Prof. EE. Rekha", designation: "Associate Professor", qualification: "M.Tech ECE" },
    { name: "Prof. FF. Kiran", designation: "Assistant Professor", qualification: "M.Tech Comm" },
    { name: "Prof. GG. Shalini", designation: "Assistant Professor", qualification: "M.Tech VLSI" },
  ],
};

const DepartmentBulletins = () => {
  const [activeDept, setActiveDept] = useState("CSE");
  const [currentIndex, setCurrentIndex] = useState(0);

  const faculty = facultyData[activeDept] || [];
  const hod = faculty[0];
  const otherFaculty = faculty.slice(1);

  const visibleCount = 4;
  const maxIndex = Math.max(0, otherFaculty.length - visibleCount);

  useEffect(() => {
    setCurrentIndex(0);
  }, [activeDept]);

  return (
    <section className="section-padding bg-background relative overflow-hidden">
      <div className="container max-w-6xl relative z-10">

        {/* Department Buttons */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {departments.map((dept) => (
            <button
              key={dept}
              onClick={() => setActiveDept(dept)}
              className={`px-5 py-2 rounded-full ${
                activeDept === dept
                  ? "bg-primary text-white"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {dept}
            </button>
          ))}
        </div>

        {/* HOD */}
        {hod && (
          <div className="flex justify-center mb-10">
            <FacultyCard
              name={hod.name}
              designation={hod.designation}
              qualification={hod.qualification}
              isLarge
            />
          </div>
        )}

        {/* Carousel */}
        {otherFaculty.length > 0 && (
          <div className="relative">
            <div className="flex items-center gap-4">

              <button
                onClick={() => setCurrentIndex((prev) => Math.max(prev - 1, 0))}
                disabled={currentIndex === 0}
                className="w-10 h-10 rounded-full bg-secondary disabled:opacity-30"
              >
                <ChevronLeft />
              </button>

              <div className="overflow-hidden w-full">
                <motion.div
                  className="flex gap-4"
                  animate={{ x: -currentIndex * 240 }}
                  transition={{ duration: 0.4 }}
                >
                  {otherFaculty.map((f, i) => (
                    <div key={i} className="min-w-[220px]">
                      <FacultyCard
                        name={f.name}
                        designation={f.designation}
                        qualification={f.qualification}
                      />
                    </div>
                  ))}
                </motion.div>
              </div>

              <button
                onClick={() =>
                  setCurrentIndex((prev) =>
                    Math.min(prev + 1, maxIndex)
                  )
                }
                disabled={currentIndex >= maxIndex}
                className="w-10 h-10 rounded-full bg-secondary disabled:opacity-30"
              >
                <ChevronRight />
              </button>

            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default DepartmentBulletins;