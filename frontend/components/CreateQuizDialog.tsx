import React, { ReactNode, useEffect, useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, School } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Question {
  question: string;
  options: string[];
  correctAnswer: string;
}

interface QuizOption {
  option_text?: string;
  is_correct?: boolean;
}

interface QuizQuestion {
  question?: string;
  question_text?: string;
  options?: Array<QuizOption | string>;
  correctAnswer?: string;
}

export interface EditableQuiz {
  quiz_id: number;
  title: string;
  cls: string;
  duration: string;
  questions?: QuizQuestion[];
}

interface ApiErrorResponse {
  error?: string;
}

type QuizStatus = "Draft" | "Published";

interface CreateQuizDialogProps {
  mode?: "create" | "edit";
  quiz?: EditableQuiz;
  trigger?: ReactNode;
}

const getApiErrorMessage = async (
  response: Response,
  fallback: string
): Promise<string> => {
  try {
    const body = (await response.json()) as ApiErrorResponse;
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
};

const emptyQuestion = (): Question => ({
  question: "",
  options: ["", "", "", ""],
  correctAnswer: "",
});

const normalizeEditableQuestions = (questions: QuizQuestion[] | undefined): Question[] => {
  if (!Array.isArray(questions) || questions.length === 0) {
    return [];
  }

  return questions.map((rawQuestion) => {
    const questionText =
      typeof rawQuestion.question_text === "string"
        ? rawQuestion.question_text
        : typeof rawQuestion.question === "string"
          ? rawQuestion.question
          : "";

    const rawOptions = Array.isArray(rawQuestion.options)
      ? rawQuestion.options
          .map((option) =>
            typeof option === "string"
              ? option
              : typeof option?.option_text === "string"
                ? option.option_text
                : ""
          )
          .filter((optionText) => optionText.trim().length > 0)
      : [];

    while (rawOptions.length < 4) {
      rawOptions.push("");
    }

    const correctFromPayload =
      typeof rawQuestion.correctAnswer === "string" ? rawQuestion.correctAnswer : "";
    const correctFromOption = Array.isArray(rawQuestion.options)
      ? rawQuestion.options.find(
          (option): option is QuizOption =>
            typeof option === "object" &&
            option !== null &&
            option.is_correct === true &&
            typeof option.option_text === "string"
        )?.option_text ?? ""
      : "";
    const firstNonEmptyOption = rawOptions.find((optionText) => optionText.trim().length > 0) ?? "";
    const preferredCorrect = (correctFromPayload || correctFromOption || firstNonEmptyOption).trim();
    const correctAnswer = rawOptions.includes(preferredCorrect) ? preferredCorrect : "";

    return {
      question: questionText,
      options: rawOptions,
      correctAnswer,
    };
  });
};

const CreateQuizDialog = ({ mode = "create", quiz, trigger }: CreateQuizDialogProps) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [quizDetails, setQuizDetails] = useState({
    title: "",
    cls: "",
    duration: "",
  });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [requestedStatus, setRequestedStatus] = useState<QuizStatus | null>(null);
  const [isNewClass, setIsNewClass] = useState(false);
  const queryClient = useQueryClient();

  const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
  const QUIZZES_API_URL = `${API_BASE}/api/quizzes`;

  // Fetch existing quizzes to get unique class names
  const { data: existingQuizzes } = useQuery({
    queryKey: ["quizzes-for-classes"],
    queryFn: async () => {
      const response = await fetch(QUIZZES_API_URL);
      if (!response.ok) {
        throw new Error("Failed to fetch quizzes");
      }
      return response.json();
    },
    staleTime: 30000,
  });

  // Extract unique class names from existing quizzes
  const existingClasses = useMemo(() => {
    if (!Array.isArray(existingQuizzes)) return [];
    const classes = new Set<string>();
    existingQuizzes.forEach((quiz: { cls?: string }) => {
      if (quiz.cls) {
        classes.add(quiz.cls);
      }
    });
    return Array.from(classes).sort();
  }, [existingQuizzes]);

  useEffect(() => {
    if (!open) {
      setRequestedStatus(null);
      return;
    }

    if (mode === "edit" && quiz) {
      setQuizDetails({
        title: quiz.title ?? "",
        cls: quiz.cls ?? "",
        duration: quiz.duration ?? "",
      });
      setQuestions(normalizeEditableQuestions(quiz.questions));
      setStep(1);
      setIsNewClass(false);
      return;
    }

    setQuizDetails({ title: "", cls: "", duration: "" });
    setQuestions([]);
    setStep(1);
    setIsNewClass(false);
  }, [mode, open, quiz]);

  const mutation = useMutation({
    mutationFn: async (params: {
      title: string;
      cls: string;
      duration: string;
      questions: Question[];
      statusAfterSave?: QuizStatus;
    }) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const isEditMode = mode === "edit";
        const quizId = quiz?.quiz_id;
        if (isEditMode && !quizId) {
          throw new Error("Quiz id is required for editing.");
        }

        const endpoint = isEditMode ? `${QUIZZES_API_URL}/${quizId}` : QUIZZES_API_URL;
        const method = isEditMode ? "PUT" : "POST";

        const response = await fetch(endpoint, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: params.title,
            cls: params.cls,
            duration: params.duration,
            questions: params.questions,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const message = await getApiErrorMessage(
            response,
            isEditMode ? "Failed to update quiz" : "Failed to create quiz"
          );
          throw new Error(message);
        }

        const updatedQuiz = await response.json();
        if (isEditMode && params.statusAfterSave) {
          const statusResponse = await fetch(`${QUIZZES_API_URL}/${quizId}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: params.statusAfterSave }),
            signal: controller.signal,
          });
          if (!statusResponse.ok) {
            const message = await getApiErrorMessage(statusResponse, "Failed to publish quiz");
            throw new Error(message);
          }
          return statusResponse.json();
        }

        return updatedQuiz;
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw new Error(
            `Cannot reach backend API (${QUIZZES_API_URL}). Start backend or set VITE_API_URL.`
          );
        }
        if (error instanceof TypeError) {
          throw new Error(
            `Cannot reach backend API (${QUIZZES_API_URL}). Start backend or set VITE_API_URL.`
          );
        }
        if (error instanceof Error && error.message === "Failed to fetch") {
          throw new Error(
            `Cannot reach backend API (${QUIZZES_API_URL}). Start backend or set VITE_API_URL.`
          );
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["quizzes"] });
      setOpen(false);
      setStep(1);
      setQuizDetails({ title: "", cls: "", duration: "" });
      setQuestions([]);
      if (mode === "edit") {
        if (variables.statusAfterSave === "Published") {
          toast.success("Quiz updated and published successfully!");
        } else if (variables.statusAfterSave === "Draft") {
          toast.success("Quiz updated and saved as draft.");
        } else {
          toast.success("Quiz updated successfully!");
        }
      } else {
        toast.success("Quiz created successfully!");
      }
      setRequestedStatus(null);
    },
    onError: (err) => {
      console.error("Quiz save failed", err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : mode === "edit"
            ? "Failed to update quiz"
            : "Failed to create quiz";
      toast.error(errorMessage);
      setRequestedStatus(null);
    },
  });

  const handleNextStep = () => {
    const clsValue = quizDetails.cls.trim();
    if (quizDetails.title.trim() && clsValue && quizDetails.duration.trim()) {
      setStep(2);
    }
  };

  const handleClassChange = (value: string) => {
    if (value === "__new__") {
      setIsNewClass(true);
      setQuizDetails({ ...quizDetails, cls: "" });
    } else {
      setIsNewClass(false);
      setQuizDetails({ ...quizDetails, cls: value });
    }
  };

  const handleAddQuestion = () => {
    setQuestions([
      ...questions,
      emptyQuestion(),
    ]);
  };

  const handleQuestionChange = (index: number, value: string) => {
    const newQuestions = [...questions];
    newQuestions[index].question = value;
    setQuestions(newQuestions);
  };

  const handleOptionChange = (
    qIndex: number,
    optIndex: number,
    value: string
  ) => {
    const newQuestions = [...questions];
    const previousOption = newQuestions[qIndex].options[optIndex];
    newQuestions[qIndex].options[optIndex] = value;
    if (newQuestions[qIndex].correctAnswer === previousOption) {
      newQuestions[qIndex].correctAnswer = value;
    }
    setQuestions(newQuestions);
  };

  const handleCorrectAnswerChange = (qIndex: number, value: string) => {
    const newQuestions = [...questions];
    newQuestions[qIndex].correctAnswer = value;
    setQuestions(newQuestions);
  };

  const handleRemoveQuestion = (index: number) => {
    const newQuestions = [...questions];
    newQuestions.splice(index, 1);
    setQuestions(newQuestions);
  };

  const handleSubmit = (statusAfterSave?: QuizStatus) => {
    setRequestedStatus(statusAfterSave ?? null);
    mutation.mutate({
      ...quizDetails,
      questions,
      statusAfterSave,
    });
  };

  const isStep2Valid = () => {
    return (
      questions.length > 0 &&
          questions.every(
            (q) =>
              q.question &&
              q.options.every((opt) => opt) &&
              q.correctAnswer &&
              q.options.includes(q.correctAnswer)
          )
    );
  };

  const defaultTrigger =
    mode === "edit" ? (
      <Button variant="outline" size="sm">
        Edit Quiz
      </Button>
    ) : (
      <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-accent text-white text-sm font-medium hover:shadow-lg hover:shadow-accent/20 transition-all hover:-translate-y-0.5">
        <Plus className="w-4 h-4" /> Create Quiz
      </button>
    );

  const isEditMode = mode === "edit";
  const dialogTitle = isEditMode ? "Edit Quiz" : "Create a New Quiz";
  const createButtonText = mutation.isPending ? "Creating..." : "Create Quiz";
  const saveDraftText =
    mutation.isPending && requestedStatus === "Draft" ? "Saving..." : "Save as Draft";
  const savePublishText =
    mutation.isPending && requestedStatus === "Published"
      ? "Saving & Publishing..."
      : "Save & Publish";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="cls">Class</Label>
                {mode === "edit" ? (
                  <Input
                    id="cls"
                    value={quizDetails.cls}
                    onChange={(e) =>
                      setQuizDetails({ ...quizDetails, cls: e.target.value })
                    }
                    required
                    disabled
                  />
                ) : (
                  <>
                    <Select
                      value={isNewClass ? "" : quizDetails.cls}
                      onValueChange={handleClassChange}
                    >
                      <SelectTrigger id="cls">
                        <SelectValue placeholder="Select existing class or create new" />
                      </SelectTrigger>
                      <SelectContent>
                        {existingClasses.map((cls) => (
                          <SelectItem key={cls} value={cls}>
                            {cls}
                          </SelectItem>
                        ))}
                        <SelectItem value="__new__">
                          <div className="flex items-center gap-2">
                            <Plus className="w-4 h-4" />
                            <span>Create New Class</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {isNewClass && (
                      <div className="mt-2">
                        <Input
                          placeholder="Enter new class name (e.g., CSE - Section A)"
                          value={quizDetails.cls}
                          onChange={(e) =>
                            setQuizDetails({ ...quizDetails, cls: e.target.value })
                          }
                          required
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Creating a new class will add it to the list for future quizzes.
                        </p>
                      </div>
                    )}
                  </>
                )}
                {existingClasses.length > 0 && !isNewClass && mode !== "edit" && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <School className="w-3 h-3" />
                    Showing classes where you've created quizzes
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={quizDetails.title}
                  onChange={(e) =>
                    setQuizDetails({ ...quizDetails, title: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="duration">Duration (e.g., 30 mins)</Label>
                <Input
                  id="duration"
                  value={quizDetails.duration}
                  onChange={(e) =>
                    setQuizDetails({
                      ...quizDetails,
                      duration: e.target.value,
                    })
                  }
                  required
                />
              </div>
              <Button onClick={handleNextStep}>Next</Button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                {questions.map((q, qIndex) => (
                  <div key={qIndex} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Question {qIndex + 1}</Label>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveQuestion(qIndex)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                    <Input
                      placeholder="Question text"
                      value={q.question}
                      onChange={(e) =>
                        handleQuestionChange(qIndex, e.target.value)
                      }
                    />
                    <RadioGroup
                      value={q.correctAnswer}
                      onValueChange={(value) =>
                        handleCorrectAnswerChange(qIndex, value)
                      }
                    >
                      {q.options.map((opt, optIndex) => (
                        <div key={optIndex} className="flex items-center gap-2">
                          <RadioGroupItem value={opt} id={`q${qIndex}o${optIndex}`} />
                          <Input
                            placeholder={`Option ${optIndex + 1}`}
                            value={opt}
                            onChange={(e) =>
                              handleOptionChange(qIndex, optIndex, e.target.value)
                            }
                          />
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                ))}
              </div>

              <Button onClick={handleAddQuestion}>
                <Plus className="w-4 h-4 mr-2" /> Add Question
              </Button>

              <div className="flex flex-wrap justify-between gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                {isEditMode ? (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => handleSubmit("Draft")}
                      disabled={!isStep2Valid() || mutation.isPending}
                    >
                      {saveDraftText}
                    </Button>
                    <Button
                      onClick={() => handleSubmit("Published")}
                      disabled={!isStep2Valid() || mutation.isPending}
                    >
                      {savePublishText}
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={() => handleSubmit()}
                    disabled={!isStep2Valid() || mutation.isPending}
                  >
                    {createButtonText}
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};

export default CreateQuizDialog;
