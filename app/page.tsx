import CinematicScene from "@/components/CinematicScene";
import SelectedWork from "@/components/SelectedWork";
import ReferencesArchive from "@/components/ReferencesArchive";
import ContactSection from "@/components/ContactSection";

export default function Home() {
  return (
    <main>
      <CinematicScene />
      <SelectedWork />
      <ReferencesArchive />
      <ContactSection />
    </main>
  );
}
