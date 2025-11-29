"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Wand2,
  Copy,
  RefreshCw,
  Sparkles,
  Check,
  Moon,
  Sun,
  AlertCircle,
  Trash2,
  Image,
  X,
  Settings,
  AlertTriangle,
  UploadCloud,
  Loader2, // Menambahkan Loader2 untuk loading gambar
} from "lucide-react";

// --- Definisi Tipe (Interfaces) ---

type PromptResult = PromiseSettledResult<string | null>;
type ApiSource = "system" | "user";

// --- Daftar API Keys Sistem (Hanya untuk Display dan Default) ---
// GANTI DENGAN KUNCI API GEMINI ANDA YANG SEBENARNYA DI SINI
const SYSTEM_API_KEYS: string[] = [
  // "Isi dengan API KEY mu sendiri",
  "AIzaSyCe9nA3mAIBuqW9089PsqfHm7AwJk00c9A",
  "AIzaSyBdm4zVjr6g3hn2IhYplAxzqV0qhLlwzkE",
  "AIzaSyDpdytRzoDCq1wi4l475s7dFvVOVoSfL_I",
  "AIzaSyAtAWfMtjOfQ6idID2gvCT1F1uw9aZBr2E",
  "AIzaSyAsUtoY_ynbDcxJtihueM0jVVu896S7lkA",
  "AIzaSyAkjz01Why_3m6L-k2vlnbFrjyZjLtDWKY",
  "AIzaSyCsqRZA4gK8ZsbIw17ofloQonF_qTE5a-8",
  "AIzaSyBWTly-IkMMBt20sOGGi6ZeGDk2vqdu6dA",
  "AIzaSyDTdwDM52hIAlE8bF6zObRu6CHZi_0u9hM",
  "AIzaSyD405biRF3aOIH9sut6GlT-5JR29L8lZMs",
];

const INJECTED_API_KEY: string = "";

// Total API Keys yang tersedia untuk sistem
const ALL_SYSTEM_KEYS: string[] = [
  ...new Set(
    [
      ...(INJECTED_API_KEY ? [INJECTED_API_KEY] : []),
      ...SYSTEM_API_KEYS,
    ].filter((key) => key.trim() !== "")
  ),
];
// --- Akhir Daftar API Keys Sistem ---

/**
 * Helper untuk memanggil API Gemini Text (Prompt Generation)
 */
const generatePromptWithKeyRotation = async (
  idea: string,
  keysToUse: string[],
  initialKeyIndex: number,
  systemPrompt: string
): Promise<string> => {
  if (keysToUse.length === 0) {
    throw new Error(
      "Daftar API keys kosong. Mohon sediakan kunci API yang valid!!!"
    );
  }

  const MAX_RETRIES = 10;
  let attempt = 0;
  let currentKeyIndex = initialKeyIndex;

  while (attempt < MAX_RETRIES) {
    attempt++;
    const key = keysToUse[currentKeyIndex % keysToUse.length];
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${key}`;

    const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;

    const payload = {
      contents: [{ parts: [{ text: `Content Idea: ${idea}` }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        temperature: 0.9,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      },
    };

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage =
          errorData.error?.message ||
          `API request failed with status: ${response.status}`;

        const isRotatableError =
          response.status === 429 ||
          response.status >= 500 ||
          response.status === 401 ||
          response.status === 403;

        if (isRotatableError) {
          currentKeyIndex++;
          const newKey = keysToUse[currentKeyIndex % keysToUse.length];

          const waitDelay =
            response.status === 429 || response.status >= 500 ? delay : 500;
          const waitMessage =
            response.status === 429 || response.status >= 500
              ? `${waitDelay / 1000}s`
              : "segera";

          console.warn(
            `Percobaan ${attempt} gagal (Status: ${
              response.status
            }). Merotasi ke key ${newKey.substring(
              0,
              4
            )}... dan mencoba lagi ${waitMessage}...`
          );

          if (attempt < MAX_RETRIES) {
            await new Promise((resolve) => setTimeout(resolve, waitDelay));
            continue;
          }
        } else {
          throw new Error(`FATAL_API_ERROR: ${errorMessage}`);
        }
      }

      const data = await response.json();
      if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
        return data.candidates[0].content.parts[0].text.trim();
      } else {
        throw new Error(
          "Format respons API tidak sesuai atau konten kosong (error struktural)."
        );
      }
    } catch (fetchError: unknown) {
      // 'fetchError' is now explicitly typed as 'unknown'
      let errorMessage = "Jaringan atau Error Transient tidak dikenal.";
      if (fetchError instanceof Error) {
        errorMessage = fetchError.message;
      }

      if (errorMessage.startsWith("FATAL_API_ERROR")) {
        console.error(
          `Error API fatal, menghentikan percobaan: ${errorMessage}`
        );
        throw new Error(
          `Error Kredensial/Izin: Mohon periksa kunci API Anda. ${errorMessage.replace(
            "FATAL_API_ERROR: ",
            ""
          )}`
        );
      }

      currentKeyIndex++;

      if (attempt === MAX_RETRIES) {
        throw new Error(
          "Gagal mendapatkan prompt setelah beberapa kali percobaan. (Jaringan/Timeout)"
        );
      }

      const newKey = keysToUse[currentKeyIndex % keysToUse.length];
      console.error(
        `Percobaan ${attempt} gagal (Jaringan/Transient). Merotasi ke key ${newKey.substring(
          0,
          4
        )}... dan mencoba lagi dalam ${delay / 1000}s...`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error(
    "Gagal mendapatkan prompt setelah beberapa kali percobaan. (Gagal Total)"
  );
};

// --- KOMPONEN MODAL API KEY (TIDAK BERUBAH) ---
const ApiKeyModal = ({
  isOpen,
  onClose,
  darkMode,
  systemKeys,
  apiSource,
  setApiSource,
  uploadedKeysCount,
  setUploadedKeys,
}: {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  systemKeys: string[];
  apiSource: ApiSource;
  setApiSource: React.Dispatch<React.SetStateAction<ApiSource>>;
  uploadedKeysCount: number;
  setUploadedKeys: React.Dispatch<React.SetStateAction<string[]>>;
}) => {
  if (!isOpen) return null;

  const [localApiSource, setLocalApiSource] = useState<ApiSource>(apiSource);
  const [fileStatus, setFileStatus] = useState<{
    count: number | null;
    name: string | null;
    error: string | null;
  }>({
    count: uploadedKeysCount > 0 ? uploadedKeysCount : null,
    name: uploadedKeysCount > 0 ? "File Terakhir Di-upload" : null,
    error: null,
  });

  const modalClasses = darkMode
    ? "bg-[#292929] text-gray-100 border-[#404040] shadow-2xl"
    : "bg-white text-gray-900 border-gray-200 shadow-xl";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files ? e.target.files[0] : null;

    if (!file) {
      setFileStatus({ count: null, name: null, error: null });
      return;
    }

    if (file.type !== "text/plain") {
      setFileStatus({ count: null, name: null, error: "Tipe file harus .txt" });
      return;
    }

    setFileStatus({ count: null, name: file.name, error: null });

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;

      // Memfilter keys yang valid (dimulai dengan "AIzaSy" dan tidak kosong)
      const keys = content
        .split("\n")
        .map((key) => key.trim())
        .filter((key) => key.length > 0 && key.startsWith("AIzaSy"));

      if (keys.length === 0) {
        setFileStatus({
          count: 0,
          name: file.name,
          error: "Tidak ditemukan API Key yang valid (AIzaSy...) di file.",
        });
        setUploadedKeys([]);
      } else {
        setUploadedKeys(keys);
        setFileStatus({ count: keys.length, name: file.name, error: null });
        // Auto-select 'Your API Key' setelah berhasil upload
        setLocalApiSource("user");
      }
    };
    reader.onerror = () => {
      setFileStatus({
        count: null,
        name: file.name,
        error: "Gagal membaca file.",
      });
    };
    reader.readAsText(file);
  };

  const handleSave = () => {
    // 1. Validasi
    if (localApiSource === "user" && uploadedKeysCount === 0) {
      if (!fileStatus.count || fileStatus.count === 0) {
        // Mengganti alert dengan console.error karena alert dilarang
        console.error(
          "Error: Anda memilih Your API Key, tetapi belum ada API Key yang berhasil di-upload."
        );
        setFileStatus((prev) => ({
          ...prev,
          error:
            "Anda memilih Your API Key, tetapi belum ada API Key yang berhasil di-upload.",
        }));
        return;
      }
    }

    // 2. Terapkan perubahan ke state global
    setApiSource(localApiSource);

    // 3. Tutup modal
    onClose();
  };

  // Classes untuk box pilihan
  const getBoxClasses = (source: ApiSource) => {
    const isActive = localApiSource === source;
    const base =
      "flex-1 p-5 rounded-xl transition-all duration-300 cursor-pointer border-2 min-h-36";

    if (isActive) {
      return `${base} shadow-xl transform scale-[1.02] ${
        darkMode
          ? "bg-blue-700/30 border-blue-400 text-white"
          : "bg-blue-100 border-blue-500 text-blue-900"
      }`;
    } else {
      return `${base} ${
        darkMode
          ? "bg-[#333333] border-[#404040] text-gray-400 hover:border-blue-500"
          : "bg-gray-50 border-gray-200 text-gray-600 hover:border-blue-500"
      }`;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0 backdrop-blur-sm backdrop-filter animate-fade-in-quick-opacity">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose}></div>

      {/* Modal Content - Menggunakan flex-col dan max-h-full pada kontainer modal */}
      <div
        className={`relative w-full max-w-2xl mx-auto rounded-2xl p-0 border ${modalClasses} transition-all duration-300 transform animate-scale-in max-h-[90vh] flex flex-col`}
      >
        {/* Header Modal (Sticky Top) */}
        <div
          className="flex justify-between items-center p-6 border-b pb-4 flex-shrink-0"
          style={{ borderColor: darkMode ? "#404040" : "#e5e7eb" }}
        >
          <h2
            className={`text-xl font-bold flex items-center gap-2 ${
              darkMode ? "text-white" : "text-gray-900"
            }`}
          >
            <Settings className="w-6 h-6 text-pink-500" />
            API Key Settings
          </h2>
          <button
            onClick={onClose}
            className={`p-2 rounded-full transition hover:opacity-75 ${
              darkMode
                ? "text-gray-400 hover:text-white"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Konten Utama Modal (Scrollable Area) */}
        <div className="p-6 overflow-y-auto flex-grow">
          {/* Choose API Key Source */}
          <h3
            className={`font-semibold mb-4 text-lg ${
              darkMode ? "text-gray-200" : "text-gray-800"
            }`}
          >
            Choose API Key Source
          </h3>

          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            {/* Opsi 1: System API Keys */}
            <div
              className={getBoxClasses("system")}
              onClick={() => setLocalApiSource("system")}
            >
              <h4 className="font-bold mb-1 flex items-center gap-2 text-lg">
                System API Keys
              </h4>
              <p className="text-sm">
                Use built-in keys ({systemKeys.length} available, round-robin)
              </p>
            </div>

            {/* Opsi 2: Your API Key */}
            <div
              className={getBoxClasses("user")}
              onClick={() => setLocalApiSource("user")}
            >
              <h4 className="font-bold mb-1 flex items-center gap-2 text-lg">
                Your API Key
              </h4>
              <p className="text-sm">Use your own Google Gemini API key</p>
            </div>
          </div>

          {/* Content berdasarkan pilihan */}
          <div
            className={`rounded-xl p-5 border transition-all duration-300 ${
              darkMode
                ? "bg-[#333333] border-[#404040]"
                : "bg-gray-50 border-gray-200"
            }`}
          >
            {localApiSource === "system" && (
              <div className="animate-fade-in-quick">
                <p className="text-sm mb-4">
                  The application is using built-in Gemini API keys with a
                  round-robin system to distribute requests. No action is
                  required from you.
                </p>
                <div
                  className={`p-3 rounded-lg flex items-start gap-3 text-sm ${
                    darkMode
                      ? "bg-yellow-900/40 text-yellow-300 border-yellow-800"
                      : "bg-yellow-100 text-yellow-800 border-yellow-300"
                  }`}
                >
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p>
                    Note that these keys are shared and may have rate limits.
                    For heavy usage, we recommend using your own API key.
                  </p>
                </div>
              </div>
            )}

            {localApiSource === "user" && (
              <div className="animate-fade-in-quick">
                {/* Area Upload File */}
                <label className="block text-sm font-medium mb-2">
                  Upload Your API Key File (.txt)
                </label>
                <div
                  className={`relative flex items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer hover:border-blue-500 transition-all duration-200 ${
                    darkMode
                      ? "border-gray-600 bg-gray-800"
                      : "border-gray-300 bg-white"
                  }`}
                >
                  <input
                    type="file"
                    accept=".txt"
                    className="absolute w-full h-full opacity-0 cursor-pointer"
                    onChange={handleFileChange}
                  />
                  <div
                    className={`text-center ${
                      darkMode ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    <UploadCloud className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sm font-semibold">
                      {fileStatus.name
                        ? fileStatus.name
                        : "Click to select a .txt file"}
                    </p>
                    <p className="text-xs">
                      File harus berisi satu API key per baris (misal:
                      AIzaSy...)
                    </p>
                  </div>
                </div>

                {/* Status Pesan Setelah Upload */}
                {fileStatus.error && (
                  <p className="text-red-500 text-sm mt-3 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    Error: {fileStatus.error}
                  </p>
                )}
                {fileStatus.count !== null && (
                  <p
                    className={`text-sm mt-3 font-medium flex items-start gap-2 ${
                      fileStatus.count > 0 ? "text-green-500" : "text-red-500"
                    }`}
                  >
                    <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    Ada total{" "}
                    <span className="font-bold">{fileStatus.count}</span> API
                    key yang valid yang dimuat dari file.
                  </p>
                )}

                <div className="mt-6">
                  <h4 className="font-semibold mb-2">
                    How to get your own Gemini API Key
                  </h4>
                  <ol
                    className={`list-decimal pl-5 text-sm space-y-1 ${
                      darkMode ? "text-gray-400" : "text-gray-700"
                    }`}
                  >
                    <li>
                      Visit the{" "}
                      <a
                        href="https://ai.google.dev/gemini-api/docs/api-key"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                      >
                        Google AI Studio
                      </a>
                    </li>
                    <li>Sign in with your Google account</li>
                    <li>Click on "Get API key" or create a new API key</li>
                    <li>
                      Copy the generated key(s) and paste them into a plain
                      ".txt file", one key per line.
                    </li>
                    <li>The keys should start with "AIzaSy..."</li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Modal Buttons (Sticky Bottom) */}
        <div
          className={`flex justify-end gap-3 p-6 pt-4 border-t flex-shrink-0`}
          style={{ borderColor: darkMode ? "#404040" : "border-gray-200" }}
        >
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              darkMode
                ? "bg-gray-700 hover:bg-gray-600 text-gray-200"
                : "bg-gray-200 hover:bg-gray-300 text-gray-800"
            }`}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition transform active:scale-95 disabled:opacity-50"
            disabled={
              localApiSource === "user" &&
              uploadedKeysCount === 0 &&
              (!fileStatus.count || fileStatus.count === 0)
            }
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

// --- KOMPONEN APLIKASI UTAMA ---
export default function App() {
  // State Global Aplikasi
  const [ideaContent, setIdeaContent] = useState<string>("");
  const [promptCount, setPromptCount] = useState<number>(3);
  const [generatedPrompts, setGeneratedPrompts] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false); // Loading untuk prompt generator
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"prompt" | "image">("prompt");
  const [error, setError] = useState<string>(""); // Error untuk prompt generator
  const [showSuccessMessage, setShowSuccessMessage] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);

  // NEW: State untuk Image Generator (dikosongkan)
  const [imagePrompt, setImagePrompt] = useState<string>("");
  const [generatedImageUrls, setGeneratedImageUrls] = useState<string[]>([]);
  const [imageLoading, setImageLoading] = useState<boolean>(false);
  const [imageError, setImageError] = useState<string>("");

  // NEW: State untuk Input Gambar di tab Image Generator
  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);

  // NEW: State untuk Manajemen API Key
  const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(false);
  // 'system' adalah default
  const [apiSource, setApiSource] = useState<ApiSource>("system");
  // Daftar API Key yang di-upload oleh pengguna
  const [uploadedApiKeys, setUploadedApiKeys] = useState<string[]>([]);

  // Menentukan API Keys yang akan digunakan berdasarkan apiSource
  const keysToUse = apiSource === "system" ? ALL_SYSTEM_KEYS : uploadedApiKeys;

  // Cleanup effect for uploaded image URL
  useEffect(() => {
    return () => {
      if (uploadedImageUrl) {
        URL.revokeObjectURL(uploadedImageUrl);
      }
    };
  }, [uploadedImageUrl]);

  // Reset untuk Prompt Generator
  const resetApp = () => {
    setIdeaContent("");
    setPromptCount(3);
    setGeneratedPrompts([]);
    setLoading(false);
    setCopiedIndex(null);
    setCopiedAll(false);
    setError("");
    setShowSuccessMessage(false);
    setProgressPercent(0);
  };

  // Reset untuk Image Generator
  const resetImageGenerator = () => {
    setImagePrompt("");
    setGeneratedImageUrls([]);
    setImageLoading(false);
    setImageError("");
    // Revoke old URL before resetting
    if (uploadedImageUrl) {
      URL.revokeObjectURL(uploadedImageUrl);
    }
    setUploadedImageFile(null);
    setUploadedImageUrl(null);
  };

  // --- Image Upload Handler ---
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files ? e.target.files[0] : null;

    // Check if a file was selected and it's an image
    if (file && file.type.startsWith("image/")) {
      setUploadedImageFile(file);
      // Revoke previous URL to prevent memory leak
      if (uploadedImageUrl) {
        URL.revokeObjectURL(uploadedImageUrl);
      }
      // Create object URL for preview
      setUploadedImageUrl(URL.createObjectURL(file));
      setImageError(""); // Clear image error
    } else if (file) {
      setImageError("File yang diunggah harus berupa gambar (jpg, jpeg, png).");
      setUploadedImageFile(null);
      setUploadedImageUrl(null);
    } else {
      setUploadedImageFile(null);
      setUploadedImageUrl(null);
      setImageError("");
    }
    // Reset input agar bisa upload file yang sama lagi jika perlu
    e.target.value = "";
  };

  // --- Fungsi Generate Prompt (Tidak Berubah Signifikan) ---
  const generatePrompt = async () => {
    // ... (Logika generatePrompt) ...
    if (keysToUse.length === 0) {
      setError(
        "Error: Tidak ada API keys yang terdeteksi. Silakan atur API Key di Pengaturan."
      );
      return;
    }

    if (!ideaContent.trim()) {
      setError("Mohon masukkan ide konten terlebih dahulu!");
      return;
    }

    setLoading(true);
    setGeneratedPrompts([]);
    setError("");
    setShowSuccessMessage(false);
    setProgressPercent(0);

    const systemPrompt: string = `You are an expert AI image prompt engineer. Analyze this content idea and create a detailed, professional image generation prompt in English.
      Instructions:
      1. Extract and describe the main visual elements, subjects, and objects from the content idea. Include details about texture and depth of field.
      2. Identify and include the artistic style mentioned (e.g., realistic, anime, pixel art, oil painting, dot matrix, etc.) - use exactly what's mentioned in the content
      3. Identify and include the mood/atmosphere mentioned (e.g., dramatic, peaceful, mysterious, gentle, etc.) - use exactly what's mentioned
      4. Identify and include the color scheme or palette mentioned (e.g., cyan and magenta, neon colors, pastel, dark, 8-bit, etc.)
      5. If lighting is mentioned (e.g., golden hour, studio lighting, neon lights, etc.), include it. If not mentioned, suggest appropriate lighting that fits the scene
      6. If composition/framing is mentioned (e.g., centered, close-up, aerial view, etc.), include it. If not mentioned, suggest appropriate composition and viewing angle.
      7. If background is mentioned (e.g., dark background, grey background, etc.), include it
      8. Select 5-7 distinct, high-quality descriptive phrases (quality enhancers) from a diverse pool (e.g., 'award-winning photography', 'cinematic lighting', 'unreal engine render', 'volumetric light', 'intricate details', 'trending on artstation', 'commercial-grade imagery', 'hyper-realistic texture', 'photorealistic CGI', 'adobe stock quality', '8k resolution', 'sharp focus', 'exceptional clarity', 'masterpiece'). Ensure these are varied for each prompt generated to maximize diversity.
      9. **Ensure the prompt is a single, robust paragraph (minimum 80 words if possible) that flows logically, starting with the main subject and its action/setting, followed by the artistic style, color palette, lighting, composition, and ending with the selected quality enhancers.**
      10. Make it sound like a professional art direction brief.
      11. **CRITICAL DIVERSITY MANDATE:** Since you are generating multiple independent prompts from the same initial idea, your goal is to maximize visual and stylistic difference *for this specific prompt*. **You MUST force a drastic change in at least two major categories (Style, Composition, Lighting, or Mood) compared to the 'default' or 'obvious' interpretation of the initial idea.** For example: If the idea suggests 'realistic', choose 'low-poly 3D render' or 'wood carving' for this prompt; if the idea suggests 'centered', choose 'extreme wide-shot' or 'fisheye lens' instead. Prioritize using unique combinations of quality enhancers for maximum differentiation.
      IMPORTANT: Extract ALL visual details from the user's content idea. Donan't add random elements - only use what's provided or logically fits the described scene.
      Return ONLY the final prompt paragraph. No explanations, no preamble, no extra text.`;

    try {
      // Tipe di sini sekarang adalah Promise<string | null>[]
      const promptPromises: Promise<string | null>[] = [];
      let resolvedCount = 0;

      for (let i = 0; i < promptCount; i++) {
        const initialKeyIndex: number = i % keysToUse.length;

        const promise = generatePromptWithKeyRotation(
          ideaContent,
          keysToUse, // MENGGUNAKAN keysToUse yang sudah ditentukan
          initialKeyIndex,
          systemPrompt
        )
          .then((result: string) => {
            resolvedCount++;
            setProgressPercent(Math.round((resolvedCount / promptCount) * 100));
            return result;
          })
          .catch((err: Error) => {
            resolvedCount++;
            setProgressPercent(Math.round((resolvedCount / promptCount) * 100));
            console.error(`Prompt ${i + 1} gagal:`, err);
            return null;
          });

        promptPromises.push(promise);
      }

      // Menggunakan tipe PromptResult[] (PromiseSettledResult<string | null>[])
      const results: PromptResult[] = await Promise.allSettled(promptPromises);

      // KOREKSI UTAMA: Menggunakan Type Guard untuk menyaring hasil yang "fulfilled" DAN bukan "null"
      const successfulPrompts: string[] = results
        .filter(
          (result): result is PromiseFulfilledResult<string | null> =>
            result.status === "fulfilled"
        )
        .map((result) => result.value)
        .filter((value): value is string => value !== null); // Memastikan hanya string yang masuk ke array

      // Mengakses properti 'reason' dengan aman
      const firstRejectedReason = results.find(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected"
      )?.reason;

      if (successfulPrompts.length === 0) {
        if (
          firstRejectedReason &&
          firstRejectedReason instanceof Error &&
          firstRejectedReason.message
        ) {
          // Memastikan 'reason' adalah objek Error sebelum mengakses 'message'
          throw new Error(firstRejectedReason.message);
        }
        throw new Error(
          "Semua upaya pembuatan prompt gagal. Mohon periksa ide konten atau coba lagi."
        );
      }

      setGeneratedPrompts(successfulPrompts);
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 4000);
    } catch (error: unknown) {
      // Menggunakan 'unknown' untuk error
      let errorMessage = "Terjadi kesalahan tidak dikenal.";
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      console.error("Error generating prompt:", error);
      setProgressPercent(100);
      setError(
        `Terjadi kesalahan: ${errorMessage}. Silakan coba lagi atau periksa kunci API Anda.`
      );
    } finally {
      setLoading(false);
    }
  };

  // --- Fungsi Generate Image (Baru - Dikosongkan) ---
  const generateImage = async () => {
    // Fungsionalitas Dihapus, hanya untuk menahan error jika tombol diklik
    setImageError("Silakan berikan prompt baru untuk fitur Image Generator.");
    setImageLoading(false);
    setGeneratedImageUrls([]);
  };

  // --- FIX: Fungsi CopyToClipboard diubah untuk prioritas document.execCommand ---
  const copyToClipboard = async (text: string, index: number) => {
    try {
      // PRIORITAS 1: document.execCommand (Paling andal di iFrame/Canvas)
      if (document.execCommand) {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        // Membuat textarea tidak terlihat dan tidak mengganggu layout
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);

        // PENTING: harus menyeleksi dan mengeksekusi perintah salin
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);

        setCopiedIndex(index);
        setTimeout(() => {
          setCopiedIndex(null);
        }, 2000);
      }
      // PRIORITAS 2: navigator.clipboard (Metode modern, tetapi sering diblokir)
      else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => {
          setCopiedIndex(null);
        }, 2000);
      }
    } catch (err) {
      console.error("Gagal menyalin teks:", err);
      // Jika kedua metode gagal, error akan dicatat
    }
  };

  // --- FIX: Fungsi CopyAllPrompts diubah untuk prioritas document.execCommand ---
  const copyAllPrompts = async () => {
    const allPromptsText: string = generatedPrompts.join("\n\n");

    try {
      // PRIORITAS 1: document.execCommand (Paling andal di iFrame/Canvas)
      if (document.execCommand) {
        const textarea = document.createElement("textarea");
        textarea.value = allPromptsText;
        // Membuat textarea tidak terlihat dan tidak mengganggu layout
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);

        // PENTING: harus menyeleksi dan mengeksekusi perintah salin
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);

        setCopiedAll(true);
        setTimeout(() => {
          setCopiedAll(false);
        }, 2000);
      }
      // PRIORITAS 2: navigator.clipboard (Metode modern, tetapi sering diblokir)
      else if (navigator.clipboard) {
        await navigator.clipboard.writeText(allPromptsText);
        setCopiedAll(true);
        setTimeout(() => {
          setCopiedAll(false);
        }, 2000);
      }
    } catch (err) {
      console.error("Gagal menyalin semua prompt:", err);
    }
  };

  const randomize = () => {
    generatePrompt();
  };

  const regenerateClasses: string = darkMode
    ? "bg-green-700 hover:bg-green-800 text-white"
    : "bg-green-600 hover:bg-green-700 text-white";

  // Fungsi untuk mendapatkan kelas tombol tab yang sesuai
  const getTabClasses = (tabName: "prompt" | "image") => {
    // Di Dark Mode, tab aktif akan menggunakan teks putih (text-white) untuk kontras yang lebih baik
    const activeTextColor = darkMode ? "text-white" : "text-gray-900";

    const isDarkModeActive = darkMode
      ? "dark-mode-tab-active"
      : "light-mode-tab-active";
    const baseClasses =
      "flex-1 py-3 px-6 text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 rounded-t-lg border-b-2"; // rounded-t-lg for less rounded corners

    if (activeTab === tabName) {
      // Tab Aktif: Menggunakan warna teks yang dikoreksi
      return `${baseClasses} tab-active-style ${isDarkModeActive} ${activeTextColor}`;
    } else {
      // Tab Tidak Aktif: Latar belakang kontainer tab, ada border bawah
      return `${baseClasses} border-transparent ${
        darkMode
          ? "text-gray-400 hover:bg-[#333333]"
          : "text-gray-600 hover:bg-gray-200"
      }`;
    }
  };

  // Mendefinisikan kelas untuk kontainer tab luar
  const tabContainerClasses = darkMode
    ? "bg-gray-800 border-gray-700"
    : "bg-gray-100 border-gray-300";

  // Mendefinisikan kelas untuk kartu konten utama
  const contentCardClasses = darkMode
    ? "bg-[#292929] border-[#404040]" // Warna card di dark mode
    : "bg-white border-gray-200";

  return (
    // Memanggil Modal di luar struktur utama agar bisa di atas semua elemen
    <>
      <ApiKeyModal
        isOpen={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
        darkMode={darkMode}
        systemKeys={ALL_SYSTEM_KEYS} // Mengirim keys sistem ke modal
        apiSource={apiSource}
        setApiSource={setApiSource}
        uploadedKeysCount={uploadedApiKeys.length} // Mengirim count key upload
        setUploadedKeys={setUploadedApiKeys} // Mengirim setter key upload
      />

      <div
        className={`min-h-screen ${
          darkMode ? "dark-mode-bg" : "bg-gray-100" // Mengubah bg-white menjadi bg-gray-100 agar lebih kontras dengan card
        } py-6 px-4 sm:px-6 transition-colors duration-300 font-sans`}
      >
        <div className="max-w-4xl mx-auto">
          {/* Header with Toggle */}
          <div className="flex justify-between items-start mb-8 flex-col sm:flex-row sm:items-center">
            <div className="flex-1 w-full text-center sm:text-left mb-4 sm:mb-0">
              <div className="flex items-center justify-center sm:justify-start gap-3 mb-1 sm:mb-3">
                <Sparkles
                  className={`w-8 h-8 sm:w-10 sm:h-10 ${
                    darkMode ? "text-blue-400" : "text-blue-600"
                  }`}
                />
                {/* Ukuran font disesuaikan untuk mobile (text-3xl) dan desktop (sm:text-4xl) */}
                <h1
                  className={`text-3xl sm:text-4xl font-bold ${
                    darkMode ? "text-white" : "text-gray-900"
                  }`}
                >
                  AI Creative Studio
                </h1>
              </div>
              <p
                className={`text-sm sm:text-base ${
                  darkMode ? "text-gray-400" : "text-gray-600"
                } text-center sm:text-left`}
              >
                Ciptakan prompt image yang detail dan visualisasikan hasilnya
                secara langsung.
              </p>
              {/* Indikator Sumber API Key yang sedang digunakan */}
              <div
                className={`mt-2 text-xs font-medium flex items-center justify-center sm:justify-start gap-1 
              ${
                apiSource === "system"
                  ? darkMode
                    ? "text-blue-400"
                    : "text-blue-600"
                  : darkMode
                  ? "text-yellow-400"
                  : "text-yellow-700"
              }`}
              >
                <Settings className="w-3 h-3" />
                API Source:{" "}
                {apiSource === "system"
                  ? "System"
                  : `User (${uploadedApiKeys.length} keys)`}
              </div>
            </div>

            {/* Buttons: API Key & Dark Mode Toggle - Menggunakan flex untuk mengatur posisi berdampingan */}
            <div className="flex gap-2 self-center sm:self-start">
              {/* API Key Button (PERBAIKAN STYLING) */}
              <button
                onClick={() => setShowApiKeyModal(true)}
                className={`p-3 rounded-xl transition-all duration-300 border-2 flex items-center gap-2 text-sm font-semibold 
                    ${
                      darkMode
                        ? "bg-gray-700 hover:bg-gray-600 border-gray-600 text-blue-300"
                        : "bg-blue-50 hover:bg-blue-100 border-blue-300 text-blue-700"
                    } 
                `}
                title="Lihat API Keys yang digunakan"
              >
                {/* Menggunakan ikon Settings untuk efek roda gigi */}
                <Settings className="w-5 h-5" />
                <span className="hidden sm:inline">API Key</span>
                <span className="sm:hidden">Key</span>
              </button>

              {/* Dark Mode Toggle */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`${
                  darkMode
                    ? "bg-gray-800 hover:bg-gray-700 border-gray-700"
                    : "bg-gray-200 hover:bg-gray-300"
                } p-3 rounded-full transition-all duration-300 border-2`}
                title={darkMode ? "Light Mode" : "Dark Mode"}
              >
                {darkMode ? (
                  <Sun className="w-6 h-6 text-yellow-400" />
                ) : (
                  <Moon className="w-6 h-6 text-gray-700" />
                )}
              </button>
            </div>
          </div>

          {/* NEW TAB BAR - Diposisikan terpisah di atas kartu konten, tidak ada shadow inner */}
          <div
            className={`flex w-full overflow-hidden rounded-t-xl ${tabContainerClasses}`}
          >
            {/* Tab 1: Prompt Generator */}
            <button
              onClick={() => setActiveTab("prompt")}
              className={getTabClasses("prompt")}
            >
              <Wand2 className="w-4 h-4" />
              Prompt Generator
            </button>

            {/* Tab 2: Image Generator */}
            <button
              onClick={() => setActiveTab("image")}
              className={getTabClasses("image")}
            >
              <Image className="w-4 h-4" />
              Image Generator
            </button>
          </div>

          {/* CONTAINER KONTEN UTAMA (Body Card) */}
          <div
            className={`${contentCardClasses} rounded-b-2xl rounded-t-none p-6 sm:p-8 shadow-2xl border-2 border-t-0 transition-colors duration-300`}
          >
            {/* ---------------------------------------------------- */}
            {/* CONTENT AREA 1: PROMPT GENERATOR (ACTIVE: 'prompt') */}
            {/* ---------------------------------------------------- */}
            {activeTab === "prompt" && (
              <div className="animate-fade-in-quick">
                {/* Input Ide Content */}
                <div className="mb-6">
                  <label
                    className={`block font-semibold mb-2 ${
                      darkMode ? "text-gray-200" : "text-gray-800"
                    }`}
                  >
                    Ide Konten
                  </label>
                  <textarea
                    value={ideaContent}
                    onChange={(e) => {
                      setIdeaContent(e.target.value);
                      setError("");
                    }}
                    placeholder="Contoh: A futuristic cyberpunk city at night with neon lights, flying cars, realistic style, dramatic and mysterious atmosphere..."
                    className={`w-full px-4 py-3 rounded-xl ${
                      darkMode
                        ? "bg-[#333333] text-white placeholder-gray-400 border-[#404040]" // Input di dark mode
                        : "bg-gray-50 text-gray-900 placeholder-gray-400 border-gray-300"
                    } border focus:border-blue-500 focus:ring-2 focus:ring-blue-400 outline-none transition resize-y text-sm sm:text-base`}
                    rows={5}
                  />
                  <p
                    className={`text-xs sm:text-sm mt-2 ${
                      darkMode ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    💡 Jelaskan secara detail: konsep, style, mood, dan elemen
                    yang diinginkan dalam satu deskripsi
                  </p>
                </div>

                {/* Jumlah Prompt */}
                <div className="mb-6">
                  <label
                    className={`block font-semibold mb-2 ${
                      darkMode ? "text-gray-200" : "text-gray-800"
                    }`}
                  >
                    Jumlah Prompt
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={promptCount}
                    onChange={(e) =>
                      setPromptCount(
                        Math.max(1, Math.min(20, Number(e.target.value)))
                      )
                    }
                    className={`w-full px-4 py-3 rounded-xl ${
                      darkMode
                        ? "bg-[#333333] text-white placeholder-gray-400 border-[#404040]" // Input di dark mode
                        : "bg-gray-50 text-gray-900 placeholder-gray-400 border-gray-300"
                    } border focus:border-blue-500 focus:ring-2 focus:ring-blue-400 outline-none transition text-sm sm:text-base`}
                    placeholder="Masukkan jumlah prompt (1-20)"
                  />
                  <p
                    className={`text-xs sm:text-sm mt-2 ${
                      darkMode ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    💡 Masukkan angka 1-20 untuk jumlah variasi prompt yang
                    ingin di-generate
                  </p>
                </div>

                {/* Buttons - Layout diperbaiki untuk mobile: semua tombol di satu kolom pada layar kecil */}
                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                  {/* Primary Generate Button (Ambil lebar penuh di mobile) */}
                  <button
                    onClick={generatePrompt}
                    disabled={loading}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 px-6 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg transform active:scale-95 duration-150 text-sm sm:text-base"
                  >
                    <Wand2 className="w-5 h-5" />
                    {loading ? "Generating..." : "Generate Prompt"}
                  </button>

                  {/* Secondary Regenerate Button (Ambil proporsi yang lebih kecil di desktop) */}
                  <button
                    onClick={randomize}
                    disabled={loading || generatedPrompts.length === 0}
                    className={`${regenerateClasses} font-semibold py-3 px-6 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg transform active:scale-95 duration-150 sm:w-1/4 text-sm sm:text-base`}
                    title="Regenerate dengan lighting dan komposisi berbeda"
                  >
                    <RefreshCw className="w-5 h-5" />
                    <span className="hidden sm:inline">Regenerate</span>
                    <span className="sm:hidden">Regenerate</span>
                  </button>

                  {/* Tertiary Reset Button (Ambil proporsi yang lebih kecil di desktop) */}
                  <button
                    onClick={resetApp}
                    disabled={loading}
                    className={`${
                      darkMode
                        ? "bg-red-800/50 hover:bg-red-800 border-red-700 text-red-200"
                        : "bg-red-100 hover:bg-red-200 border-red-300 text-red-800"
                    } font-semibold py-3 px-6 rounded-xl transition flex items-center justify-center gap-2 border-2 disabled:opacity-50 shadow-md transform active:scale-95 duration-150 sm:w-1/4 text-sm sm:text-base`}
                    title="Reset semua input dan hasil"
                  >
                    <Trash2 className="w-5 h-5" />
                    <span className="hidden sm:inline">Reset</span>
                    <span className="sm:hidden">Reset</span>
                  </button>
                </div>

                {/* Progress Bar */}
                {loading && (
                  <div className="mb-6 animate-fade-in">
                    <p
                      className={`text-sm font-medium mb-1 ${
                        darkMode ? "text-blue-300" : "text-blue-600"
                      } flex items-center justify-between`}
                    >
                      <span className="flex items-center gap-2 text-xs sm:text-sm">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Processing prompts mohon ditunggu.
                      </span>
                      <span className="font-bold">{progressPercent}%</span>
                    </p>
                    <div
                      className={`w-full ${
                        darkMode ? "bg-gray-700" : "bg-gray-200"
                      } rounded-full h-2.5 overflow-hidden`}
                    >
                      <div
                        className="bg-blue-500 h-full rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${progressPercent}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Success Alert */}
                {showSuccessMessage && (
                  <div
                    className={`rounded-xl p-4 flex items-start gap-3 mb-6 animate-fade-in ${
                      darkMode
                        ? "bg-green-800/50 border border-green-700"
                        : "bg-green-50 border border-green-200"
                    }`}
                  >
                    <Check
                      className="text-green-500 flex-shrink-0 mt-0.5"
                      size={20}
                    />
                    <div className="flex-1">
                      <p
                        className={`text-sm font-medium ${
                          darkMode ? "text-green-200" : "text-green-800"
                        }`}
                      >
                        Generate prompt berhasil! Ditemukan{" "}
                        {generatedPrompts.length} prompt unik siap digunakan.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowSuccessMessage(false)}
                      className={`text-sm font-bold ${
                        darkMode
                          ? "text-green-300 hover:text-green-100"
                          : "text-green-600 hover:text-green-800"
                      }`}
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Error Alert - Muncul di bawah tombol */}
                {error && (
                  <div
                    className={`rounded-xl p-4 flex items-start gap-3 mb-6 animate-shake ${
                      darkMode
                        ? "bg-red-900/50 border border-red-700"
                        : "bg-red-50 border border-red-200"
                    }`}
                  >
                    <AlertCircle
                      className="text-red-500 flex-shrink-0 mt-0.5"
                      size={20}
                    />
                    <div className="flex-1">
                      <p
                        className={`text-sm font-medium ${
                          darkMode ? "text-red-200" : "text-red-800"
                        }`}
                      >
                        {error}
                      </p>
                    </div>
                    <button
                      onClick={() => setError("")}
                      className={`text-sm font-bold ${
                        darkMode
                          ? "text-red-300 hover:text-red-100"
                          : "text-red-600 hover:text-red-800"
                      }`}
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Generated Prompt Display */}
                {generatedPrompts.length > 0 && (
                  <div className="space-y-4">
                    {/* Copy All Button */}
                    <div className="flex justify-between items-center pt-4 border-t border-dashed border-gray-600/30 flex-col sm:flex-row gap-4 sm:gap-0">
                      <h3
                        className={`font-semibold text-lg sm:text-xl ${
                          darkMode ? "text-gray-200" : "text-gray-800"
                        }`}
                      >
                        Generated Prompts ({generatedPrompts.length}):
                      </h3>
                      <button
                        onClick={copyAllPrompts}
                        className={`${
                          copiedAll
                            ? "bg-green-600 hover:bg-green-700"
                            : "bg-blue-600 hover:bg-blue-700"
                        } text-white px-4 py-2 rounded-xl transition flex items-center gap-2 font-semibold shadow-lg transform active:scale-95 duration-150 w-full sm:w-auto text-sm sm:text-base`}
                      >
                        {copiedAll ? (
                          <>
                            <Check className="w-5 h-5" />
                            <span>Semua Tersalin!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-5 h-5" />
                            <span>Copy All Prompts</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Individual Prompt Cards */}
                    {generatedPrompts.map((prompt: string, index: number) => (
                      <div
                        key={index}
                        className={`${
                          darkMode
                            ? "bg-[#333333] border-[#404040]" // Card prompt di dark mode
                            : "bg-blue-50 border-blue-300"
                        } border-2 rounded-xl p-4 sm:p-6 transition-colors duration-300 hover:shadow-xl`}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <p
                            className={`font-mono text-xs font-bold ${
                              darkMode ? "text-blue-300" : "text-blue-600"
                            }`}
                          >
                            Prompt {index + 1}
                          </p>
                          <button
                            onClick={() => copyToClipboard(prompt, index)}
                            className={`${
                              copiedIndex === index
                                ? "bg-green-600 hover:bg-green-700"
                                : darkMode
                                ? "bg-gray-700 hover:bg-gray-600 border-gray-600"
                                : "bg-blue-200 hover:bg-blue-300 border-blue-300"
                            } text-white px-3 py-2 rounded-xl transition flex items-center gap-2 border-2 shadow-md transform active:scale-95 duration-150`}
                            title={
                              copiedIndex === index
                                ? "Tersalin!"
                                : "Copy prompt"
                            }
                          >
                            {copiedIndex === index ? (
                              <>
                                <Check className="w-5 h-5" />
                                <span className="text-sm font-medium">
                                  Tersalin!
                                </span>
                              </>
                            ) : (
                              <Copy className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                        <p
                          className={`text-sm sm:text-base leading-relaxed ${
                            darkMode ? "text-gray-200" : "text-gray-800"
                          }`}
                        >
                          {prompt}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* -------------------------------------------------- */}
            {/* CONTENT AREA 2: IMAGE GENERATOR (ACTIVE: 'image') */}
            {/* -------------------------------------------------- */}
            {activeTab === "image" && (
              <div className="animate-fade-in-quick">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* CARD 1: INPUT GAMBAR (Upload) */}
                  <div
                    className={`${contentCardClasses.replace(
                      "bg-white",
                      "bg-gray-50"
                    )} flex flex-col h-full p-6 rounded-xl shadow-lg border-2 border-dashed border-gray-300/50`}
                  >
                    <h3
                      className={`text-lg font-bold mb-4 flex items-center gap-2 ${
                        darkMode ? "text-gray-200" : "text-gray-800"
                      }`}
                    >
                      <UploadCloud className="w-5 h-5 text-pink-500" />
                      Upload Gambar (Input)
                    </h3>

                    <label
                      className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 cursor-pointer transition-all duration-200 flex-grow
                                hover:border-blue-500 hover:shadow-md h-full min-h-[200px] ${
                                  darkMode
                                    ? "border-gray-600 bg-[#333333] text-gray-400"
                                    : "border-gray-300 bg-white text-gray-600"
                                }`}
                    >
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/jpg"
                        className="absolute w-full h-full opacity-0 cursor-pointer"
                        onChange={handleImageUpload}
                      />
                      {uploadedImageFile ? (
                        <div className="text-center w-full">
                          <Image className="w-8 h-8 mx-auto mb-2 text-green-500" />
                          <p className="text-sm font-semibold text-green-500 max-w-full truncate">
                            Gambar berhasil di-upload
                          </p>
                          <p className="text-xs max-w-full truncate">
                            {uploadedImageFile.name}
                          </p>
                        </div>
                      ) : (
                        <div className="text-center">
                          <UploadCloud className="w-8 h-8 mx-auto mb-2 text-blue-400" />
                          <p className="text-sm font-semibold">
                            Click atau drag file gambar (.jpg, .png)
                          </p>
                          <p className="text-xs mt-1">
                            Ini akan menjadi gambar dasar untuk dimanipulasi.
                          </p>
                        </div>
                      )}
                    </label>
                    {/* Tampilkan pesan error jika ada */}
                    {imageError && (
                      <div
                        className={`mt-3 p-3 rounded-xl flex items-start gap-2 text-sm ${
                          darkMode
                            ? "bg-red-900/40 text-red-300 border-red-800"
                            : "bg-red-100 text-red-800 border-red-300"
                        }`}
                      >
                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <p>{imageError}</p>
                      </div>
                    )}
                  </div>

                  {/* CARD 2: PREVIEW GAMBAR UPLOAD (Preview) */}
                  <div
                    className={`${contentCardClasses.replace(
                      "bg-white",
                      "bg-gray-50"
                    )} flex flex-col h-full p-6 rounded-xl shadow-lg border-2 border-dashed border-gray-300/50`}
                  >
                    <h3
                      className={`text-lg font-bold mb-4 flex items-center gap-2 ${
                        darkMode ? "text-gray-200" : "text-gray-800"
                      }`}
                    >
                      <Image className="w-5 h-5 text-purple-500" />
                      Preview Gambar Input
                    </h3>

                    <div
                      className={`relative w-full flex-grow rounded-lg overflow-hidden border-4 border-dashed ${
                        uploadedImageUrl
                          ? "border-transparent"
                          : "border-gray-400/50"
                      }`}
                    >
                      {uploadedImageUrl ? (
                        <img
                          src={uploadedImageUrl}
                          alt="Uploaded Preview"
                          className="w-full h-full object-contain" // object-contain: Memastikan seluruh gambar terlihat, tidak terpotong.
                        />
                      ) : (
                        <div
                          className={`flex items-center justify-center w-full h-full text-center ${
                            darkMode ? "bg-[#333333]" : "bg-gray-200"
                          }`}
                        >
                          <div
                            className={`${
                              darkMode ? "text-gray-500" : "text-gray-700"
                            }`}
                          >
                            <Image className="w-10 h-10 mx-auto mb-2" />
                            <p className="text-sm">
                              Gambar akan muncul di sini setelah di-upload.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        {/* Custom CSS untuk background #1f1f1f dan styling tab kustom */}
        <style jsx global>{`
          .dark-mode-bg {
            background-color: #1f1f1f;
          }
          /* Custom styles for tab appearance */
          .tab-active-style {
            /* Menghilangkan border bawah pada tab aktif */
            border-bottom-color: transparent !important;
            box-shadow: 0 -4px 6px -1px rgba(0, 0, 0, 0.1),
              0 -2px 4px -2px rgba(0, 0, 0, 0.06);
          }

          /* LIGHT MODE: Tab aktif mengikuti warna kartu (Putih) */
          .light-mode-tab-active {
            background-color: #fff; /* Warna kartu utama light mode */
            border-left: 1px solid #e5e7eb; /* border-gray-200 */
            border-right: 1px solid #e5e7eb; /* border-gray-200 */
            border-top: 1px solid #e5e7eb; /* border-gray-200 */
            margin-bottom: -2px; /* Menarik tab agar menimpa border atas kartu konten */
          }

          /* DARK MODE: Tab aktif mengikuti warna kartu (Abu-abu gelap) */
          .dark-mode-tab-active {
            background-color: #292929; /* Warna kartu utama dark mode */
            border-left: 1px solid #404040; /* border-[#404040] */
            border-right: 1px solid #404040; /* border-[#404040] */
            border-top: 1px solid #404040; /* border-[#404040] */
            margin-bottom: -2px; /* Menarik tab agar menimpa border atas kartu konten */
          }

          /* Animasi standar yang sudah ada */
          @keyframes shake {
            0%,
            100% {
              transform: translateX(0);
            }
            25% {
              transform: translateX(-5px);
            }
            75% {
              transform: translateX(5px);
            }
          }
          .animate-shake {
            animation: shake 0.3s ease-in-out;
          }
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          .animate-fade-in {
            animation: fadeIn 0.5s ease-out forwards;
          }
          /* New custom animation for quick tab transition */
          .animate-fade-in-quick {
            animation: fadeIn 0.3s ease-out forwards;
          }

          /* NEW: Animasi untuk Modal */
          @keyframes fadeInQuickOpacity {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }
          .animate-fade-in-quick-opacity {
            animation: fadeInQuickOpacity 0.2s ease-out forwards;
          }
          @keyframes scaleIn {
            from {
              transform: scale(0.95);
              opacity: 0;
            }
            to {
              transform: scale(1);
              opacity: 1;
            }
          }
          .animate-scale-in {
            animation: scaleIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
              forwards;
          }
        `}</style>
      </div>
    </>
  );
}
