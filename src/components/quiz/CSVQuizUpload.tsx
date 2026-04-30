import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Upload,
  FileSpreadsheet,
  Download,
  X,
  CheckCircle2,
  AlertCircle,
  Eye,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
} from "lucide-react";
import { QuizQuestion } from "@/types/quiz";
import {
  parseCSVContent,
  readFileAsText,
  downloadCSVTemplate,
  CSVParseResult,
} from "@/lib/csvParser";

interface CSVQuizUploadProps {
  onQuestionsLoaded: (questions: QuizQuestion[]) => void;
}

const ANSWER_COLORS: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  B: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  C: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  D: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400",
};

const ROWS_PER_PAGE = 10;

export function CSVQuizUpload({ onQuestionsLoaded }: CSVQuizUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<CSVParseResult | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File) => {
      // Validate file type
      if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
        setParseResult({
          questions: [],
          errors: ["Please upload a valid CSV file."],
          totalRows: 0,
        });
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setParseResult({
          questions: [],
          errors: ["File size exceeds 5MB limit."],
          totalRows: 0,
        });
        return;
      }

      setIsLoading(true);
      setSelectedFile(file);
      setCurrentPage(0);

      try {
        const content = await readFileAsText(file);
        const result = parseCSVContent(content);
        setParseResult(result);

        if (result.questions.length > 0) {
          onQuestionsLoaded(result.questions);
        }
      } catch {
        setParseResult({
          questions: [],
          errors: ["Failed to read file. Please try again."],
          totalRows: 0,
        });
      } finally {
        setIsLoading(false);
      }
    },
    [onQuestionsLoaded]
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragOver(false);

      const files = event.dataTransfer.files;
      if (files.length > 0) {
        processFile(files[0]);
      }
    },
    [processFile]
  );

  const handleFileInput = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (files && files.length > 0) {
        processFile(files[0]);
      }
    },
    [processFile]
  );

  const handleRemoveFile = useCallback(() => {
    setSelectedFile(null);
    setParseResult(null);
    setCurrentPage(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onQuestionsLoaded([]);
  }, [onQuestionsLoaded]);

  const totalPages =
    parseResult && parseResult.questions.length > 0
      ? Math.ceil(parseResult.questions.length / ROWS_PER_PAGE)
      : 0;

  const paginatedQuestions =
    parseResult?.questions.slice(
      currentPage * ROWS_PER_PAGE,
      (currentPage + 1) * ROWS_PER_PAGE
    ) || [];

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Header with Template Download */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-primary flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            CSV Quiz Upload
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Upload a CSV file with your quiz questions
          </p>
        </div>
        <Button
          variant="default"
          size="sm"
          onClick={downloadCSVTemplate}
          className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
        >
          <Download className="h-4 w-4 mr-2" />
          Template
        </Button>
      </div>

      {/* Drop Zone */}
      <motion.div
        layout
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative cursor-pointer rounded-xl border-2 border-dashed p-8
          transition-all duration-300 ease-out
          ${
            isDragOver
              ? "border-primary bg-primary/5 scale-[1.02] shadow-lg shadow-primary/10"
              : "border-muted-foreground/30 hover:border-primary/60 hover:bg-muted/30"
          }
          ${isLoading ? "pointer-events-none opacity-60" : ""}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileInput}
          className="hidden"
          id="csv-file-input"
          aria-label="Upload CSV file"
        />

        <div className="flex flex-col items-center gap-3">
          <motion.div
            animate={
              isDragOver
                ? { y: -8, scale: 1.1 }
                : { y: 0, scale: 1 }
            }
            transition={{ type: "spring", stiffness: 300 }}
            className={`
              p-4 rounded-full transition-colors duration-300
              ${isDragOver ? "bg-primary/20" : "bg-primary/10"}
            `}
          >
            <Upload
              className={`h-10 w-10 transition-colors ${
                isDragOver ? "text-primary" : "text-primary/60"
              }`}
            />
          </motion.div>

          <div className="text-center">
            <p className="font-semibold text-foreground">
              {isDragOver
                ? "Drop your CSV file here"
                : "Drag & drop CSV file here or click to browse"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Supports CSV with: Question, Option A, Option B, Option C, Option
              D, Correct Answer, Points
            </p>
          </div>
        </div>

        {/* Loading Spinner */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-xl backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium text-foreground">
                Parsing CSV...
              </span>
            </div>
          </div>
        )}
      </motion.div>

      {/* Selected File Info */}
      <AnimatePresence>
        {selectedFile && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <FileSpreadsheet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">
                    Selected File:
                  </p>
                  <p className="text-sm text-foreground">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={(event) => {
                  event.stopPropagation();
                  handleRemoveFile();
                }}
                className="text-destructive hover:bg-destructive/10 h-8 w-8"
                aria-label="Remove file"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Parse Errors */}
      <AnimatePresence>
        {parseResult && parseResult.errors.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong className="block mb-1">
                  {parseResult.errors.length} issue(s) found:
                </strong>
                <ul className="list-disc list-inside space-y-0.5 text-xs max-h-32 overflow-y-auto">
                  {parseResult.errors.slice(0, 10).map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                  {parseResult.errors.length > 10 && (
                    <li className="text-muted-foreground italic">
                      ...and {parseResult.errors.length - 10} more
                    </li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Data Preview Table */}
      <AnimatePresence>
        {parseResult && parseResult.questions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <Card className="border-0 shadow-md overflow-hidden">
              {/* Preview Header */}
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Eye className="h-4 w-4 text-primary" />
                    Data Preview
                  </CardTitle>
                  <Badge
                    variant="secondary"
                    className="bg-primary/10 text-primary border-primary/20"
                  >
                    <HelpCircle className="h-3 w-3 mr-1" />
                    {parseResult.questions.length} questions loaded
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {/* Success Banner */}
                <div className="mx-4 mb-4">
                  <Alert className="border-emerald-500/50 bg-emerald-50 dark:bg-emerald-900/20">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <AlertDescription className="text-emerald-700 dark:text-emerald-300">
                      <strong>{parseResult.questions.length}</strong> questions
                      parsed successfully from{" "}
                      <strong>{parseResult.totalRows}</strong> rows.
                      {parseResult.errors.length > 0 &&
                        ` (${parseResult.errors.length} rows skipped due to errors)`}
                    </AlertDescription>
                  </Alert>
                </div>

                {/* Scrollable Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" id="csv-preview-table">
                    <thead>
                      <tr className="bg-muted/60 border-y border-border">
                        <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground w-10">
                          #
                        </th>
                        <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground min-w-[200px]">
                          Question
                        </th>
                        <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground min-w-[100px]">
                          Option A
                        </th>
                        <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground min-w-[100px]">
                          Option B
                        </th>
                        <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground min-w-[100px]">
                          Option C
                        </th>
                        <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground min-w-[100px]">
                          Option D
                        </th>
                        <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground w-20">
                          Answer
                        </th>
                        <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground w-16">
                          Pts
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedQuestions.map((question, index) => {
                        const globalIndex =
                          currentPage * ROWS_PER_PAGE + index;
                        const pointsMatch =
                          question.explanation.match(/Points:\s*(\d+)/);
                        const points = pointsMatch ? pointsMatch[1] : "1";

                        return (
                          <motion.tr
                            key={question.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.03 }}
                            className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                          >
                            <td className="px-3 py-3 text-muted-foreground font-mono text-xs">
                              {globalIndex + 1}
                            </td>
                            <td className="px-3 py-3 font-medium text-foreground max-w-[300px]">
                              <span className="line-clamp-2">
                                {question.question}
                              </span>
                            </td>
                            {question.options.map((option) => (
                              <td
                                key={option.id}
                                className="px-3 py-3 text-muted-foreground max-w-[140px]"
                              >
                                <span className="line-clamp-2">
                                  {option.text}
                                </span>
                              </td>
                            ))}
                            <td className="px-3 py-3 text-center">
                              <span
                                className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
                                  ANSWER_COLORS[question.correctAnswer] ||
                                  "bg-muted text-foreground"
                                }`}
                              >
                                {question.correctAnswer}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-center font-medium text-foreground">
                              {points}
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/30">
                    <p className="text-xs text-muted-foreground">
                      Showing {currentPage * ROWS_PER_PAGE + 1}–
                      {Math.min(
                        (currentPage + 1) * ROWS_PER_PAGE,
                        parseResult.questions.length
                      )}{" "}
                      of {parseResult.questions.length}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={currentPage === 0}
                        onClick={() => setCurrentPage((prevPage) => prevPage - 1)}
                        aria-label="Previous page"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-xs font-medium text-muted-foreground px-2">
                        {currentPage + 1} / {totalPages}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={currentPage >= totalPages - 1}
                        onClick={() => setCurrentPage((prevPage) => prevPage + 1)}
                        aria-label="Next page"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
