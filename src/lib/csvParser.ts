import { QuizQuestion } from "@/types/quiz";

export interface CSVParseResult {
  questions: QuizQuestion[];
  errors: string[];
  totalRows: number;
}

/**
 * Generates a CSV template string for quiz creation.
 * Columns: Question, Option A, Option B, Option C, Option D, Correct Answer, Points
 */
export function generateCSVTemplate(): string {
  const header = "Question,Option A,Option B,Option C,Option D,Correct Answer,Points";
  const sampleRows = [
    '"What is the capital of France?","London","Paris","Berlin","Madrid","B",1',
    '"Which planet is closest to the Sun?","Venus","Earth","Mercury","Mars","C",1',
    '"What does HTML stand for?","Hyper Text Markup Language","Home Tool Multi Language","Hyperlinks Text Mark Language","Hyper Tool Marking Language","A",2',
  ];
  return [header, ...sampleRows].join("\n");
}

/**
 * Downloads the CSV template as a file.
 */
export function downloadCSVTemplate(): void {
  const csvContent = generateCSVTemplate();
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", "quiz_template.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Parses a raw CSV string into individual fields, handling quoted values properly.
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let currentField = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (insideQuotes && i + 1 < line.length && line[i + 1] === '"') {
        // Escaped quote inside quoted field
        currentField += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      fields.push(currentField.trim());
      currentField = "";
    } else {
      currentField += char;
    }
  }

  fields.push(currentField.trim());
  return fields;
}

/**
 * Normalizes the correct answer value to A, B, C, or D.
 * Accepts: "A", "B", "C", "D", "a", "b", "c", "d", "1", "2", "3", "4",
 * "Option A", "option b", etc.
 */
function normalizeCorrectAnswer(value: string): string | null {
  const trimmed = value.trim().toUpperCase();

  // Direct letter match
  if (/^[A-D]$/.test(trimmed)) return trimmed;

  // Numeric mapping: 1=A, 2=B, 3=C, 4=D
  const numericMap: Record<string, string> = { "1": "A", "2": "B", "3": "C", "4": "D" };
  if (numericMap[trimmed]) return numericMap[trimmed];

  // "Option A" / "option b" style
  const optionMatch = trimmed.match(/^OPTION\s*([A-D])$/);
  if (optionMatch) return optionMatch[1];

  return null;
}

/**
 * Parses a CSV file content string into quiz questions.
 */
export function parseCSVContent(csvContent: string): CSVParseResult {
  const errors: string[] = [];
  const questions: QuizQuestion[] = [];

  // Split into lines and filter empty
  const lines = csvContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return { questions: [], errors: ["CSV file must have a header row and at least one data row."], totalRows: 0 };
  }

  // Parse header to detect column mapping
  const headerFields = parseCSVLine(lines[0]).map((header) => header.toLowerCase().replace(/[^a-z0-9]/g, ""));

  // Try to auto-detect columns
  const columnMap = detectColumns(headerFields);

  if (columnMap.question === -1) {
    return { questions: [], errors: ["Could not find 'Question' column in CSV header."], totalRows: lines.length - 1 };
  }

  if (columnMap.optionA === -1 || columnMap.optionB === -1) {
    return {
      questions: [],
      errors: ["Could not find Option columns (A, B, C, D) in CSV header."],
      totalRows: lines.length - 1,
    };
  }

  if (columnMap.correctAnswer === -1) {
    return {
      questions: [],
      errors: ["Could not find 'Correct Answer' column in CSV header."],
      totalRows: lines.length - 1,
    };
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    const rowNumber = i + 1;

    // Skip rows with insufficient fields
    if (fields.length < 6) {
      errors.push(`Row ${rowNumber}: Not enough columns (found ${fields.length}, need at least 6).`);
      continue;
    }

    const questionText = fields[columnMap.question]?.trim();
    const optionA = fields[columnMap.optionA]?.trim();
    const optionB = fields[columnMap.optionB]?.trim();
    const optionC = columnMap.optionC !== -1 ? fields[columnMap.optionC]?.trim() : "-";
    const optionD = columnMap.optionD !== -1 ? fields[columnMap.optionD]?.trim() : "-";
    const correctAnswerRaw = fields[columnMap.correctAnswer]?.trim();
    const points = columnMap.points !== -1 ? parseInt(fields[columnMap.points] || "1", 10) : 1;

    // Validate question text
    if (!questionText) {
      errors.push(`Row ${rowNumber}: Empty question text.`);
      continue;
    }

    // Validate options
    if (!optionA || !optionB) {
      errors.push(`Row ${rowNumber}: Options A and B are required.`);
      continue;
    }

    // Validate correct answer
    const normalizedAnswer = normalizeCorrectAnswer(correctAnswerRaw || "");
    if (!normalizedAnswer) {
      errors.push(`Row ${rowNumber}: Invalid correct answer "${correctAnswerRaw}". Use A, B, C, or D.`);
      continue;
    }

    questions.push({
      id: questions.length + 1,
      question: questionText,
      options: [
        { id: "A", text: optionA || "-" },
        { id: "B", text: optionB || "-" },
        { id: "C", text: optionC || "-" },
        { id: "D", text: optionD || "-" },
      ],
      correctAnswer: normalizedAnswer,
      explanation: `Points: ${isNaN(points) ? 1 : points}`,
    });
  }

  return { questions, errors, totalRows: lines.length - 1 };
}

interface ColumnMapping {
  question: number;
  optionA: number;
  optionB: number;
  optionC: number;
  optionD: number;
  correctAnswer: number;
  points: number;
}

/**
 * Auto-detects column indices from header fields.
 */
function detectColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    question: -1,
    optionA: -1,
    optionB: -1,
    optionC: -1,
    optionD: -1,
    correctAnswer: -1,
    points: -1,
  };

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];

    if (header.includes("question") || header.includes("ques") || header === "q") {
      mapping.question = i;
    } else if (header.includes("optiona") || header === "a" || header === "opta") {
      mapping.optionA = i;
    } else if (header.includes("optionb") || header === "b" || header === "optb") {
      mapping.optionB = i;
    } else if (header.includes("optionc") || header === "c" || header === "optc") {
      mapping.optionC = i;
    } else if (header.includes("optiond") || header === "d" || header === "optd") {
      mapping.optionD = i;
    } else if (
      header.includes("correctanswer") ||
      header.includes("answer") ||
      header.includes("correct") ||
      header === "ans"
    ) {
      mapping.correctAnswer = i;
    } else if (
      header.includes("point") ||
      header.includes("score") ||
      header.includes("mark") ||
      header.includes("level")
    ) {
      mapping.points = i;
    }
  }

  // Fallback: if we have sequential unnamed columns, assume standard order
  // Question, Option A, Option B, Option C, Option D, Correct Answer, Points
  if (mapping.question === -1 && headers.length >= 6) {
    mapping.question = 0;
    mapping.optionA = 1;
    mapping.optionB = 2;
    mapping.optionC = 3;
    mapping.optionD = 4;
    mapping.correctAnswer = 5;
    if (headers.length >= 7) mapping.points = 6;
  }

  return mapping;
}

/**
 * Reads a File object and returns its text content.
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsText(file);
  });
}
