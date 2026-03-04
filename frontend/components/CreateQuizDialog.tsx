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

type QuestionType = "mcq" | "fill_blank" | "true_false";

interface Question {
  question: string;
  type: QuestionType;
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
  question_type?: string;
  options?: Array<QuizOption | string>;
  correctAnswer?: string;
  correct_answer_text?: string;
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

const MIN_QUIZ_DURATION_MINUTES = 1;
const MAX_QUIZ_DURATION_MINUTES = 360;
const DEFAULT_QUIZ_DURATION_MINUTES = 30;
const durationQuickPresets = [15, 30, 45, 60];

const clampDurationMinutes = (value: number): number =>
  Math.max(MIN_QUIZ_DURATION_MINUTES, Math.min(MAX_QUIZ_DURATION_MINUTES, Math.round(value)));

const parseDurationToMinutes = (duration: string): number => {
  const normalized = duration.trim().toLowerCase();
  if (!normalized) {
    return DEFAULT_QUIZ_DURATION_MINUTES;
  }

  const clockMatch = normalized.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (clockMatch) {
    const first = Number(clockMatch[1]);
    const second = Number(clockMatch[2]);
    const third = clockMatch[3] ? Number(clockMatch[3]) : 0;
    if (clockMatch[3]) {
      return clampDurationMinutes(first * 60 + Math.round((second * 60 + third) / 60));
    }
    return clampDurationMinutes(first + Math.round(second / 60));
  }

  const unitMatch = normalized.match(
    /(\d+)\s*(hours?|hrs?|hr|h|minutes?|mins?|min|m|seconds?|secs?|sec|s)?/
  );
  if (!unitMatch) {
    return DEFAULT_QUIZ_DURATION_MINUTES;
  }

  const rawValue = Number(unitMatch[1]);
  if (!Number.isFinite(rawValue) || rawValue <= 0) {
    return DEFAULT_QUIZ_DURATION_MINUTES;
  }

  const unit = unitMatch[2] ?? "min";
  let minutes = rawValue;
  if (unit.startsWith("h")) {
    minutes = rawValue * 60;
  } else if (unit.startsWith("s")) {
    minutes = Math.ceil(rawValue / 60);
  }

  return clampDurationMinutes(minutes);
};

const formatDurationForPayload = (minutes: number): string => `${minutes} mins`;

const formatTimerPreview = (minutes: number): string => {
  const totalSeconds = clampDurationMinutes(minutes) * 60;
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, mins, seconds].map((part) => String(part).padStart(2, "0")).join(":");
};

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

const defaultTrueFalseOptions = ["True", "False"] as const;

const normalizeQuestionType = (value: unknown): QuestionType => {
  if (typeof value !== "string") {
    return "mcq";
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "fill_blank" || normalized === "fillblank" || normalized === "fill") {
    return "fill_blank";
  }
  if (
    normalized === "true_false" ||
    normalized === "truefalse" ||
    normalized === "boolean" ||
    normalized === "tf"
  ) {
    return "true_false";
  }
  return "mcq";
};

const normalizeTrueFalseAnswer = (value: string): string => {
  const normalized = value.trim().toLowerCase();
  return normalized === "false" ? "False" : "True";
};

const emptyQuestion = (): Question => ({
  question: "",
  type: "mcq",
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
    const questionType = normalizeQuestionType(rawQuestion.question_type);

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

    if (questionType === "mcq") {
      while (rawOptions.length < 4) {
        rawOptions.push("");
      }
    }

    const correctFromPayload =
      typeof rawQuestion.correctAnswer === "string" ? rawQuestion.correctAnswer : "";
    const correctFromQuestionColumn =
      typeof rawQuestion.correct_answer_text === "string" ? rawQuestion.correct_answer_text : "";
    const correctFromOption = Array.isArray(rawQuestion.options)
      ? rawQuestion.options.find(
          (option): option is QuizOption =>
            typeof option === "object" &&
            option !== null &&
            option.is_correct === true &&
            typeof option.option_text === "string"
        )?.option_text ?? ""
      : "";

    const preferredCorrect = (
      correctFromPayload ||
      correctFromQuestionColumn ||
      correctFromOption
    ).trim();

    if (questionType === "fill_blank") {
      return {
        question: questionText,
        type: questionType,
        options: [],
        correctAnswer: preferredCorrect,
      };
    }

    if (questionType === "true_false") {
      return {
        question: questionText,
        type: questionType,
        options: [...defaultTrueFalseOptions],
        correctAnswer: normalizeTrueFalseAnswer(preferredCorrect || "True"),
      };
    }

    const firstNonEmptyOption = rawOptions.find((optionText) => optionText.trim().length > 0) ?? "";
    const safeCorrect = preferredCorrect || firstNonEmptyOption;
    const correctAnswer = rawOptions.includes(safeCorrect) ? safeCorrect : "";

    return {
      question: questionText,
      type: questionType,
      options: rawOptions,
      correctAnswer,
    };
  });
};

const sanitizeQuestionsForSubmit = (questions: Question[]): Question[] =>
  questions.map((question) => {
    if (question.type === "mcq") {
      const filteredOptions = question.options
        .map((option) => option.trim())
        .filter((option) => option.length > 0);
      return {
        ...question,
        question: question.question.trim(),
        options: filteredOptions,
        correctAnswer: question.correctAnswer.trim(),
      };
    }

    return {
      ...question,
      question: question.question.trim(),
      correctAnswer: question.correctAnswer.trim(),
    };
  });

const CreateQuizDialog = ({ mode = "create", quiz, trigger }: CreateQuizDialogProps) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [quizDetails, setQuizDetails] = useState({
    title: "",
    cls: "",
    duration: formatDurationForPayload(DEFAULT_QUIZ_DURATION_MINUTES),
  });
  const [durationMinutes, setDurationMinutes] = useState(DEFAULT_QUIZ_DURATION_MINUTES);
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
      const parsedDurationMinutes = parseDurationToMinutes(quiz.duration ?? "");
      setQuizDetails({
        title: quiz.title ?? "",
        cls: quiz.cls ?? "",
        duration: formatDurationForPayload(parsedDurationMinutes),
      });
      setDurationMinutes(parsedDurationMinutes);
      setQuestions(normalizeEditableQuestions(quiz.questions));
      setStep(1);
      setIsNewClass(false);
      return;
    }

    setDurationMinutes(DEFAULT_QUIZ_DURATION_MINUTES);
    setQuizDetails({
      title: "",
      cls: "",
      duration: formatDurationForPayload(DEFAULT_QUIZ_DURATION_MINUTES),
    });
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
      setDurationMinutes(DEFAULT_QUIZ_DURATION_MINUTES);
      setQuizDetails({
        title: "",
        cls: "",
        duration: formatDurationForPayload(DEFAULT_QUIZ_DURATION_MINUTES),
      });
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

  const handleDurationMinutesChange = (value: string) => {
    if (!value.trim()) {
      return;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return;
    }
    const clamped = clampDurationMinutes(parsed);
    setDurationMinutes(clamped);
    setQuizDetails((prev) => ({
      ...prev,
      duration: formatDurationForPayload(clamped),
    }));
  };

  const handleDurationPreset = (minutes: number) => {
    const clamped = clampDurationMinutes(minutes);
    setDurationMinutes(clamped);
    setQuizDetails((prev) => ({
      ...prev,
      duration: formatDurationForPayload(clamped),
    }));
  };

  const handleAddQuestion = () => {
    setQuestions([...questions, emptyQuestion()]);
  };

  const handleQuestionChange = (index: number, value: string) => {
    const newQuestions = [...questions];
    newQuestions[index].question = value;
    setQuestions(newQuestions);
  };

  const handleQuestionTypeChange = (qIndex: number, type: QuestionType) => {
    const newQuestions = [...questions];
    const current = newQuestions[qIndex];
    if (type === "mcq") {
      newQuestions[qIndex] = {
        ...current,
        type,
        options: ["", "", "", ""],
        correctAnswer: "",
      };
      setQuestions(newQuestions);
      return;
    }

    if (type === "true_false") {
      newQuestions[qIndex] = {
        ...current,
        type,
        options: [...defaultTrueFalseOptions],
        correctAnswer: normalizeTrueFalseAnswer(current.correctAnswer || "True"),
      };
      setQuestions(newQuestions);
      return;
    }

    newQuestions[qIndex] = {
      ...current,
      type: "fill_blank",
      options: [],
      correctAnswer: current.type === "fill_blank" ? current.correctAnswer : "",
    };
    setQuestions(newQuestions);
  };

  const handleOptionChange = (qIndex: number, optIndex: number, value: string) => {
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
      questions: sanitizeQuestionsForSubmit(questions),
      statusAfterSave,
    });
  };

  const isStep2Valid = () => {
    return (
      questions.length > 0 &&
      questions.every((q) => {
        if (!q.question.trim()) {
          return false;
        }
        if (q.type === "fill_blank") {
          return Boolean(q.correctAnswer.trim());
        }
        const validOptions = q.options.map((opt) => opt.trim()).filter((opt) => Boolean(opt));
        if (validOptions.length < 2) {
          return false;
        }
        return Boolean(q.correctAnswer.trim()) && validOptions.includes(q.correctAnswer.trim());
      })
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
                <Label htmlFor="durationMinutes">Quiz Timer (minutes)</Label>
                <div className="mt-2 grid gap-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                    <Input
                      id="durationMinutes"
                      type="number"
                      min={MIN_QUIZ_DURATION_MINUTES}
                      max={MAX_QUIZ_DURATION_MINUTES}
                      step={1}
                      value={durationMinutes}
                      onChange={(e) => handleDurationMinutesChange(e.target.value)}
                      required
                    />
                    <div className="rounded-md border px-3 py-2 text-sm font-mono text-center sm:min-w-[108px]">
                      {formatTimerPreview(durationMinutes)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {durationQuickPresets.map((presetMinutes) => (
                      <Button
                        key={presetMinutes}
                        type="button"
                        variant={durationMinutes === presetMinutes ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleDurationPreset(presetMinutes)}
                      >
                        {presetMinutes} min
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Students will get {formatTimerPreview(durationMinutes)} to complete this quiz.
                  </p>
                </div>
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
                    <div>
                      <Label className="text-xs text-muted-foreground">Question Type</Label>
                      <Select
                        value={q.type}
                        onValueChange={(value) =>
                          handleQuestionTypeChange(qIndex, value as QuestionType)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mcq">Multiple Choice</SelectItem>
                          <SelectItem value="fill_blank">Fill in the Blank</SelectItem>
                          <SelectItem value="true_false">True / False</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      placeholder="Question text"
                      value={q.question}
                      onChange={(e) =>
                        handleQuestionChange(qIndex, e.target.value)
                      }
                    />

                    {q.type === "fill_blank" ? (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Expected Answer</Label>
                        <Input
                          placeholder="Type the expected answer"
                          value={q.correctAnswer}
                          onChange={(e) =>
                            handleCorrectAnswerChange(qIndex, e.target.value)
                          }
                        />
                      </div>
                    ) : (
                      <RadioGroup
                        value={q.correctAnswer}
                        onValueChange={(value) => handleCorrectAnswerChange(qIndex, value)}
                      >
                        {q.options.map((opt, optIndex) => (
                          <div key={optIndex} className="flex items-center gap-2">
                            <RadioGroupItem value={opt} id={`q${qIndex}o${optIndex}`} />
                            {q.type === "mcq" ? (
                              <Input
                                placeholder={`Option ${optIndex + 1}`}
                                value={opt}
                                onChange={(e) =>
                                  handleOptionChange(qIndex, optIndex, e.target.value)
                                }
                              />
                            ) : (
                              <Input value={opt} disabled readOnly />
                            )}
                          </div>
                        ))}
                      </RadioGroup>
                    )}
                  </div>
                ))}
              </div>

              <Button onClick={handleAddQuestion}>
                <Plus className="w-4 h-4 mr-2" /> Add Question
              </Button>
              <p className="text-xs text-muted-foreground">
                Quiz questions are auto-shuffled per student when they start the attempt.
              </p>
              <p className="text-xs text-muted-foreground">
                For MCQ, fill at least 2 options and select one correct answer.
              </p>

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
