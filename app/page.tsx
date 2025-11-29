import ImagePromptGeneratorApp from "../components/ImagePromptGenerator";

// Ini adalah Server Component, yang kemudian me-render Client Component
// Next.js akan secara otomatis melakukan tree-shaking dan optimizing
export default function Home() {
  return (
    <main>
      <ImagePromptGeneratorApp />
    </main>
  );
}
